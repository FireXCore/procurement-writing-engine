import { validRange } from '../regions.mjs';
const category = kind => ['Spelling','Typo'].includes(kind) ? 'spelling' : ['Grammar','Agreement','WordOrder'].includes(kind) ? 'grammar' : 'style';

export function harperAdapter(linter) {
  if (!linter || typeof linter.organizedLints !== 'function') throw new TypeError('Harper linter required');
  return Object.freeze({id:'harper',languages:['en'],async check(text) {
    const rules = await linter.organizedLints(text,{language:'plaintext',dedup:true,isolateEnglish:false});
    const output = [];
    // WASM bindings are owned by this adapter and released even on malformed results.
    for (const [rule,lints] of Object.entries(rules)) {
      for (const lint of lints) {
        let span, suggestions = [];
        try {
          span = lint.span(); const {start,end} = span;
          if (!validRange(text,start,end) || text.slice(start,end) !== lint.get_problem_text()) continue;
          const common = {rule,category:category(lint.lint_kind()),start,end,original:text.slice(start,end),message:lint.message()};
          suggestions = lint.suggestions();
          if (!suggestions.length) output.push(common);
          for (const s of suggestions) {
            const kind = s.kind();
            if (kind === 0 || kind === 1) output.push({...common,replacement:s.get_replacement_text()});
            else if (kind === 2) output.push({...common,replacement:common.original+s.get_replacement_text()});
          }
        } finally {
          for (const s of suggestions) s.free?.();
          span?.free?.(); lint.free?.();
        }
      }
    }
    return output;
  }});
}

// Explicit setup, never on page load. Host must bundle/self-host the WASM artifact.
export async function createHarper({binary, worker = true, dialect} = {}) {
  if (!binary) throw new TypeError('Explicit local Harper binary required');
  const sdk = await import('harper.js');
  const linter = new (worker ? sdk.WorkerLinter : sdk.LocalLinter)({binary,dialect});
  try { await linter.setup(); } catch (error) { await linter.dispose(); throw error; }
  return {provider:harperAdapter(linter),dispose:() => linter.dispose()};
}
