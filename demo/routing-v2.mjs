import { boundaries, eligible, validateDocument, LIMITS } from '../src/regions.mjs';

// EXPERIMENT ONLY. Not an authoritative production region map.
// Recognizers propose protection; never authorize review. Unknown tokens are quarantined.
// Original UTF-16 offsets are used throughout. Host literals are explicit, not inferred.
const patterns = [
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
const latin = /\p{Script=Latin}/u, arabic = /\p{Script=Arabic}/u;
const forbiddenControl = /[\p{Cc}\p{Cf}]/u;
function language(s) {
  const en=latin.test(s), fa=arabic.test(s);
  return en===fa ? null : en?'en':'fa';
}
export function buildResearchSnapshot(input,locked,snapshotId,{hostLiterals=[]}={}) {
  if(typeof input!=='string'||typeof locked!=='string'||!input.isWellFormed()||!locked.isWellFormed()||input.length>1500||!Array.isArray(hostLiterals)||hostLiterals.length>128||hostLiterals.some(s=>typeof s!=='string'||!s.trim()||s.length>128||!s.isWellFormed()))throw new TypeError('Invalid research input');
  const text=input+'\n'+locked, b=boundaries(text);
  const fallback=()=>({document:{text,snapshotId,regions:[{start:0,end:text.length,kind:'protected'}]},languages:[],skipped:1,reviewedUnits:0});
  if(forbiddenControl.test(input.replace(/[\t\r\n\u200c]/gu,''))||!b.has(input.length))return fallback();
  const spans=[];
  function add(start,end) {
    // Accept only complete lexical spans. Sentence punctuation may delimit entities.
    const left=input.slice(0,start).match(/\S+$/u)?.[0]??'';
    const right=input.slice(end).match(/^\S+/u)?.[0]??'';
    if((!left||/^[([{,"'“‘;]+$/u.test(left))&&(!right||/^[.,;:!?)}\]"'”’]+$/u.test(right))&&b.has(start)&&b.has(end))spans.push({start,end});
  }
  for(const p of patterns)for(const m of input.matchAll(p))add(m.index,m.index+m[0].length);
  for(const term of hostLiterals) {
    // Literal matching without regex construction or Unicode normalization.
    let from=0, at;
    while((at=input.indexOf(term,from))!==-1){add(at,at+term.length);from=at+term.length;}
  }
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
  return {document,languages:[...languages],skipped,reviewedUnits:regions.filter(r=>r.kind==='prose').reduce((n,r)=>n+text.slice(r.start,r.end).replace(/\s/gu,'').length,0)};
}
