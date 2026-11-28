import { LIMITS, validateDocument, eligible, boundaries, validRange, validReplacement } from './regions.mjs';

import { preservesCriticalMeaning } from './critical-meaning.mjs';

const providerId = /^[a-z][a-z0-9-]{0,47}$/;
const ruleId = /^[a-zA-Z0-9_.:/-]{1,100}$/;
const categories = new Set(['spelling','grammar','orthography','terminology','style','technical-writing']);
const by = (a,b) => a < b ? -1 : a > b ? 1 : 0;
const plainMessage = x => typeof x === 'string' && x.length > 0 && x.length <= LIMITS.message && !/[<>\p{Cc}\p{Cf}]/u.test(x);
const frozen = x => Object.freeze(x);

function report(snapshotId, status, findings, diagnostics) {
  return frozen({ snapshotId, status, findings: frozen(findings.map(frozen)), diagnostics: frozen(diagnostics.map(frozen)), apply: false });
}

export function createEngine(providers) {
  if (!Array.isArray(providers) || !providers.length || providers.length > LIMITS.providers) throw new TypeError('Invalid provider set');
  const ids = new Set();
  const configured = providers.map(p => {
    if (!p || typeof p.id !== 'string' || !providerId.test(p.id) || ids.has(p.id) || typeof p.check !== 'function' ||
        !Array.isArray(p.languages) || !p.languages.length || p.languages.some(l => !['en','fa'].includes(l))) throw new TypeError('Invalid provider');
    ids.add(p.id);
    return frozen({id:p.id, languages:frozen([...p.languages]), check:p.check.bind(p)});
  });
  let running = false, retired = false;
  // Cancellation is cooperative. Stop waiting for noncooperative asynchronous providers,
  // retire the engine rather than overlap calls. The host must terminate a worker that hangs.
  async function boundedCheck(p, source, language, signal, remaining) {
    const controller = new AbortController();
    let timer, onAbort;
    const pending = Promise.resolve().then(()=>{if(controller.signal.aborted)throw new Error('Cancelled');return p.check(source,language,controller.signal);})
      .then(value=>({kind:'result',value}),()=>({kind:'failed'}));
    const stop = new Promise(resolve=>{
      onAbort=()=>{controller.abort();resolve({kind:'cancelled'});};
      if (signal?.aborted) onAbort();
      else signal?.addEventListener('abort',onAbort,{once:true});
      timer=setTimeout(()=>{controller.abort();resolve({kind:'timeout'});},Math.max(1,Math.min(remaining,LIMITS.providerMs)));
    });
    try { return await Promise.race([pending,stop]); }
    finally { clearTimeout(timer);signal?.removeEventListener('abort',onAbort); }
  }
  return frozen({ async analyze(document, { signal } = {}) {
    if (retired) return report(null,'blocked',[],[{code:'engine-retired'}]);
    if (running) return report(null,'busy',[],[]);
    // Capture before first await. No source text or raw exception appears in diagnostics.
    if (!validateDocument(document)) return report(null,'blocked',[],[{code:'invalid-region-map'}]);
    const { text, snapshotId } = document;
    const regions = document.regions.map(r => frozen({...r}));
    if (signal?.aborted) return report(snapshotId,'cancelled',[],[]);
    running = true;
    try {
      const findings = [], diagnostics = [];
      const seen = new Set();
      let partial = false, calls = 0;
      const deadline = performance.now() + LIMITS.elapsedMs;
      regionLoop: for (const region of regions) {
        if (region.kind === 'protected') continue;
        const source = text.slice(region.start,region.end);
        if (!eligible(source,region.language)) {
          partial = true; diagnostics.push({code:'unsafe-region',start:region.start}); continue;
        }
        const enabled = configured.filter(p => p.languages.includes(region.language));
        if (!enabled.length) { partial = true; diagnostics.push({code:'no-provider',start:region.start}); continue; }
        const b = boundaries(source);
        for (const p of enabled) {
          if (signal?.aborted) return report(snapshotId,'cancelled',[],[]);
          if (++calls > LIMITS.calls || performance.now() >= deadline) {
            partial = true; diagnostics.push({code:'budget-exhausted'}); break regionLoop;
          }
          const checked = await boundedCheck(p,source,region.language,signal,deadline-performance.now());
          if (checked.kind === 'cancelled' || signal?.aborted) {
            if (checked.kind === 'cancelled') retired = true;
            return report(snapshotId,'cancelled',[],[]);
          }
          if (checked.kind === 'timeout') {
            retired = true; partial = true; diagnostics.push({code:'provider-timeout',provider:p.id,start:region.start}); break regionLoop;
          }
          if (checked.kind === 'failed') {partial=true;diagnostics.push({code:'provider-failed',provider:p.id,start:region.start});continue;}
          const raw = checked.value;
          if (!Array.isArray(raw)) { partial = true; diagnostics.push({code:'invalid-provider-result',provider:p.id}); continue; }
          if (raw.length > LIMITS.providerFindings) { partial = true; diagnostics.push({code:'provider-limit',provider:p.id}); }
          let rejected = false, limited = false;
          for (const f of raw.slice(0,LIMITS.providerFindings)) {
            if (!f || typeof f.rule !== 'string' || !ruleId.test(f.rule) || !categories.has(f.category) ||
                !validRange(source,f.start,f.end,b) || source.slice(f.start,f.end) !== f.original ||
                !plainMessage(f.message) || (f.replacement === undefined && f.start === f.end)) {
              partial = true; rejected = true; continue;
            }
            // Inserts on a protected-region boundary are rejected; do not guess where they belong.
            if (f.start === f.end && (f.start === 0 || f.start === source.length)) { partial = true; rejected = true; continue; }
            if (f.replacement !== undefined && (!validReplacement(f.original,f.replacement,region.language) ||
                !preservesCriticalMeaning(source,f.start,f.end,f.replacement,region.language))) { partial = true; rejected = true; continue; }
            const start = region.start + f.start, end = region.start + f.end;
            const key = JSON.stringify([p.id,f.rule,start,end,f.replacement ?? null]);
            if (seen.has(key)) continue;
            seen.add(key);
            if (findings.length >= LIMITS.findings) { partial = true; limited = true; continue; }
            findings.push({provider:p.id, rule:f.rule, category:f.category, start,end,original:f.original,
              ...(f.replacement === undefined ? {} : {replacement:f.replacement}), message:f.message});
          }
          if (rejected) diagnostics.push({code:'rejected-finding',provider:p.id,start:region.start});
          if (limited) diagnostics.push({code:'finding-limit',provider:p.id,start:region.start});
        }
      }
      if (signal?.aborted) return report(snapshotId,'cancelled',[],[]);
      // Stable sort: do not alphabetize competing replacements from the same rule.
      findings.sort((a,b) => a.start-b.start || a.end-b.end || by(a.provider,b.provider) || by(a.rule,b.rule));
      return report(snapshotId,partial?'partial':'complete',findings,diagnostics);
    } finally { running = false; }
  }});
}
