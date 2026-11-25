import { boundaries, eligible, validateDocument, LIMITS } from '../src/regions.mjs';

// EXPERIMENT ONLY. Not an authoritative production region map.
// Recognizers propose protection; never authorize review. Unknown tokens are quarantined.
// Original UTF-16 offsets are used throughout. Host literals are explicit, not inferred.
const patterns = [
  /(?:RFQ|RFP|RFI|PO|MOQ|ETA|ETD|EXW|FCA|CPT|CIP|DAP|DPU|DDP|FAS|FOB|CFR|CIF)(?![\p{L}\p{N}])/gu,
  /[+-]?\p{Nd}+(?:[.٫]\p{Nd}+)?[ \t]*(?:Nm|N·m|m³\/h|m3\/h|kg\/m³|kg\/m3|rpm|L\/min|l\/min)/gu,
  /\p{Nd}+(?:[,.٬٫]\p{Nd}+)*(?:[ \t]+(?:هزار|میلیون|میلیارد))?[ \t]+(?:تومان|ریال)/gu,
  /\d+(?:\.\d+)?[ \t]*#/gu,
  /(?=[A-Za-z0-9._/-]*[A-Za-z])(?=[A-Za-z0-9._/-]*[0-9])[A-Za-z0-9]+(?:[._/-][A-Za-z0-9]+)*/gu,
  /[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9]+(?:[-.][A-Za-z0-9]+)*\.[A-Za-z]{2,63}/gu,
  /https?:\/\/[^\s<>"'()[\]{}]+/gu,
  /(?:[A-Za-z]:\\|\/)[A-Za-z0-9_.-]+(?:[\\/][A-Za-z0-9_.-]+)*/gu,
  /(?:API|IEC|ISO|DIN|EN|ANSI|IEEE|NACE)[ \t]+\d+(?:[-.]\d+)*/gu,
  /(?:ASME|ASTM)[ \t]+[A-Z]\d+(?:\.\d+)*(?:[ \t]+[A-Z]{2,5})?/gu,
  /(?:USD|EUR|GBP|JPY|CNY|AED|CHF|CAD|AUD|IRR)[ \t]+[+-]?\p{Nd}+(?:[,.٬٫]\p{Nd}+)*/gu,
  /[$€£¥][ \t]*[+-]?\p{Nd}+(?:[,.٬٫]\p{Nd}+)*/gu,
  /\p{Nd}+(?:[.,٫]\p{Nd}+)?[ \t]*%[ \t]*(?:T\/T|L\/C)?/gu,
  /Incoterms[ \t]+\d{4}/gu,
  /[+-]?\p{Nd}+(?:[.٫]\p{Nd}+)?(?:[–-][+-]?\p{Nd}+(?:[.٫]\p{Nd}+)?)?[ \t]*(?:°[CF]|VDC|VAC|mA|MPa|kPa|mbar|bar|psi|mm|cm|kg|Hz|kW|V|A|PCS|EA|NO|عدد)/gu,
  /\d+(?:\/\d+)?-inch/gu,
  /M\d+(?:[×x]\d+(?:\.\d+)?)?/gu,
  /(?:DN|PN|IP)\d+/gu
];

// These are deliberately uncertain, context-limited name candidates, not NER.
// No brand dictionary is used. A suspected name is quarantined, never asserted.
const namePatterns=[
  /(?:\b(?:the|from|by|brand|manufacturer|supplier|vendor)[ \t]+)(?<name>\p{Lu}[\p{L}\p{M}]*(?:[ \t]+\p{Lu}[\p{L}\p{M}]*){0,3})(?=[ \t]+(?:quotation|offer|proposal|valve|pump|equipment|model)\b)/dgu,
  /(?<name>\p{Lu}[\p{L}\p{M}]*(?:[ \t]+\p{Lu}[\p{L}\p{M}]*){0,2}[ \t]+(?:Industries|Corporation|Incorporated|Limited|GmbH|Ltd|Inc|Group))(?=[ \t.,;!?)]|$)/dgu,
  /(?:قیمت|تجهیز|برند|سازنده|شرکت)[ \t]+(?<name>\p{Lu}[\p{Script=Latin}\p{M}]*(?:[ \t]+\p{Lu}[\p{Script=Latin}\p{M}]*){0,3})(?=[ \t]+(?:را|مدل|با|از)(?=[ \t،؛.]|$)|[ \t]+[A-Za-z]+\d|[.,،؛!?]|$)/dgu,
  /(?<name>شرکت[ \t]+[\p{Script=Arabic}\p{M}\u200c]+(?:[ \t]+[\p{Script=Arabic}\p{M}\u200c]+){0,3})(?=[ \t]+(?:تماس|مکاتبه|همکاری|مذاکره|استعلام)(?=[ \t،؛.]|$))/dgu,
  /(?:EXW|FCA|CPT|CIP|DAP|DPU|DDP|FAS|FOB|CFR|CIF)[ \t]+(?<name>\p{Lu}[\p{L}\p{M}]*(?:[ \t]+(?!Incoterms\b)\p{Lu}[\p{L}\p{M}]*){0,3})(?=[ \t]+Incoterms\b|[.,;!?)]|$)/dgu
];

// A capitalized Latin singleton embedded in Persian prose is ambiguous:
// it may be a proper name or a foreign term. Quarantine it without claiming
// its identity. Full English runs remain eligible. Do not cross sentences.
function embeddedLatinCandidates(input){
  const tokens=[...input.matchAll(/\S+/gu)], result=[];
  const faLetter=/[\p{Script=Arabic}&&\p{L}]/v;
  const startsName=/^\p{Lu}[\p{Script=Latin}\p{M}]*$/u;
  const trimEdges=/^[("'“‘\[]+|[.,،؛;:!?؟)"'”’\]]+$/gu;
  const sentenceEnd=/[.!?؟][)"'”’\]]*$/u;
  for(let i=1;i+1<tokens.length;i++){
    const prev=tokens[i-1],cur=tokens[i],next=tokens[i+1];
    const original=cur[0],name=original.replace(trimEdges,'');
    if(!startsName.test(name)||!faLetter.test(prev[0])||!faLetter.test(next[0])||
      /[A-Za-z]/u.test(prev[0]+next[0])||sentenceEnd.test(prev[0])||sentenceEnd.test(original)||
      /[\r\n]/u.test(input.slice(prev.index+prev[0].length,cur.index)+input.slice(cur.index+original.length,next.index)))continue;
    const start=cur.index+original.indexOf(name);
    result.push({start,end:start+name.length});
  }
  return result;
}

// Count disjoint non-whitespace UTF-16 units on the final partition.
// Recognized patterns are not proof of entity identity.
function summarize(input,regions,known,suspected,blocked=false){
  const units={total:0,reviewable:0,recognized:0,suspected:0,unreviewed:0};
  let i=0;
  for(let at=0;at<input.length;at++){
    if(/\s/u.test(input[at]))continue;
    units.total++;
    while(i<regions.length&&regions[i].end<=at)i++;
    if(regions[i]?.kind==='prose')units.reviewable++;
    else if(!blocked&&known.some(r=>r.start<=at&&at<r.end))units.recognized++;
    else if(!blocked&&suspected.some(r=>r.start<=at&&at<r.end))units.suspected++;
    else units.unreviewed++;
  }
  return Object.freeze(units);
}

const latin = /\p{Script=Latin}/u, arabic = /\p{Script=Arabic}/u;
const forbiddenControl = /[\p{Cc}\p{Cf}]/u;
function language(s) {
  const en=latin.test(s), fa=arabic.test(s);
  return en===fa ? null : en?'en':'fa';
}
export function buildResearchSnapshot(input,locked,snapshotId,{hostLiterals=[]}={}) {
  if(typeof input!=='string'||typeof locked!=='string'||!input.isWellFormed()||!locked.isWellFormed()||input.length>1500||!Array.isArray(hostLiterals)||hostLiterals.length>128||hostLiterals.some(s=>typeof s!=='string'||!s.trim()||s.length>128||!s.isWellFormed()))throw new TypeError('Invalid research input');
  const text=input+'\n'+locked, b=boundaries(text);
  const fallback=()=>({document:{text,snapshotId,regions:[{start:0,end:text.length,kind:'protected'}]},languages:[],skipped:1,suspectedRanges:0,reviewedUnits:0,coverage:summarize(input,[],[],[],true)});
  if(forbiddenControl.test(input.replace(/[\t\r\n\u200c]/gu,''))||!b.has(input.length))return fallback();
  const spans=[],suspected=[];
  function add(start,end,target=spans) {
    // Accept only complete lexical spans. Sentence punctuation may delimit entities.
    const left=input.slice(0,start).match(/\S+$/u)?.[0]??'';
    const right=input.slice(end).match(/^\S+/u)?.[0]??'';
    if((!left||/^[([{,"'“‘;]+$/u.test(left))&&(!right||/^[.,;:!?،؛؟)}\]"'”’]+$/u.test(right))&&b.has(start)&&b.has(end))target.push({start,end});
  }
  for(const p of patterns)for(const m of input.matchAll(p))add(m.index,m.index+m[0].length);
  for(const term of hostLiterals) {
    // Literal matching without regex construction or Unicode normalization.
    let from=0, at;
    while((at=input.indexOf(term,from))!==-1){add(at,at+term.length);from=at+term.length;}
  }
  for(const p of namePatterns)for(const m of input.matchAll(p)){
    const [start,end]=m.indices.groups.name;
    // Known exact data wins over overlapping guesses.
    if(!spans.some(r=>r.start<=start&&end<=r.end))add(start,end,suspected);
  }
  for(const {start,end} of embeddedLatinCandidates(input)){
    if(![...spans,...suspected].some(r=>r.start<=start&&end<=r.end))add(start,end,suspected);
  }
  const known=spans.slice();
  spans.push(...suspected);
  spans.sort((a,b)=>a.start-b.start||a.end-b.end);
  const merged=[];
  for(const s of spans){const p=merged.at(-1);if(p&&s.start<=p.end)p.end=Math.max(p.end,s.end);else merged.push({...s});}
  const regions=[], languages=new Set();let skipped=0;
  function emit(start,end,kind,lang) {
    if(start===end)return;
    const p=regions.at(-1);
    if(p&&p.end===start&&p.kind===kind&&p.language===lang)p.end=end;
    else regions.push(kind==='prose'?{start,end,kind,language:lang}:{start,end,kind});
    if(lang)languages.add(lang);
  }
  function gap(start,end) {
    const s=input.slice(start,end);let cursor=start;
    for(const m of s.matchAll(/\S+/gu)) {
      const a=start+m.index,z=a+m[0].length;
      if(!b.has(a)||!b.has(z))return false;
      const lang=language(m[0]);
      if(lang&&eligible(m[0],lang)) {
        const prev=regions.at(-1);
        if(prev?.kind==='prose'&&prev.language===lang&&prev.end===cursor&&eligible(input.slice(prev.start,z),lang))emit(cursor,z,'prose',lang);
        else {emit(cursor,a,'protected');emit(a,z,'prose',lang);}
      } else {
        if(/[\p{L}\p{N}\p{Cc}\p{Cf}]/u.test(m[0]))skipped++;
        emit(cursor,z,'protected');
      }
      cursor=z;
    }
    emit(cursor,end,'protected');return true;
  }
  let cursor=0;
  for(const span of merged){if(!gap(cursor,span.start))return fallback();emit(span.start,span.end,'protected');cursor=span.end;}
  if(!gap(cursor,input.length))return fallback();
  emit(input.length,text.length,'protected');
  const document={text,snapshotId,regions};
  if(regions.length>LIMITS.regions||!validateDocument(document)||regions.some(r=>r.kind==='prose'&&!eligible(text.slice(r.start,r.end),r.language)))return fallback();
  const coverage=summarize(input,regions,known,suspected);
  return {document,languages:[...languages],skipped,suspectedRanges:suspected.length,reviewedUnits:coverage.reviewable,coverage};
}
