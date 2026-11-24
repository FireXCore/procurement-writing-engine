import { codePointOffset, validRange } from '../regions.mjs';

export function languageToolAdapter(check) {
  if (typeof check !== 'function') throw new TypeError('Explicit self-hosted LanguageTool transport required');
  return Object.freeze({id:'languagetool',languages:['en','fa'],async check(text,language,signal) {
    const result = await check(text,language,signal);
    if (!Array.isArray(result?.matches)) throw new Error('Invalid LanguageTool response');
    return result.matches.flatMap(m=>{
      if (!Number.isSafeInteger(m?.offset) || !Number.isSafeInteger(m?.length) || m.length<0) return [];
      const start=m.offset,end=start+m.length;
      if (!validRange(text,start,end)) return [];
      const context=m.context;
      if (typeof context?.text!=='string'||!Number.isSafeInteger(context.offset)||context.offset<0||context.length!==m.length||
          context.offset+context.length>context.text.length||context.text.slice(context.offset,context.offset+context.length)!==text.slice(start,end)) return [];
      const base={start,end,original:text.slice(start,end),rule:m.rule?.id,category:m.rule?.issueType==='misspelling'?'spelling':'grammar',message:m.message};
      const suggestions=(Array.isArray(m.replacements)?m.replacements:[]).slice(0,5).filter(x=>typeof x?.value==='string');
      return suggestions.length?suggestions.map(x=>({...base,replacement:x.value})):[base];
    });
  }});
}

// STE100 is advisory, not a claim of official ASD conformance. Its Python offsets are code points.
export function ste100Adapter(check) {
  if (typeof check !== 'function') throw new TypeError('STE100 runner required');
  return Object.freeze({id:'ste100',languages:['en'],async check(text,_language,signal) {
    const report=await check(text,signal);
    if (!Array.isArray(report?.violations)) throw new Error('Invalid STE100 report');
    return report.violations.flatMap(v=>{
      const start=codePointOffset(text,v.start),end=codePointOffset(text,v.end);
      if (!validRange(text,start,end) || text.slice(start,end)!==v.text) return [];
      // Upstream suggestions may be explanatory guidance rather than literal replacement text.
      return [{start,end,original:v.text,rule:v.rule,category:'technical-writing',message:v.message}];
    });
  }});
}

// Vale columns can depend on parser/encoding. Use an unambiguous exact match on the reported line.
// Never use heuristic global search or a repeated match. Keep findings advisory.
export function valeAdapter(check) {
  if (typeof check !== 'function') throw new TypeError('Vale runner required');
  return Object.freeze({id:'vale',languages:['en'],async check(text,_language,signal) {
    const report=await check(text,signal);
    if (!report || typeof report!=='object'||Array.isArray(report)) throw new Error('Invalid Vale report');
    const groups=Object.values(report);
    if (groups.length>1 || groups.some(g=>!Array.isArray(g))) throw new Error('Expected one Vale document');
    const lines=text.split('\n'), offsets=[];
    let offset=0; for (const line of lines) {offsets.push(offset);offset+=line.length+1;}
    return groups.flat().flatMap(a=>{
      if (!Number.isSafeInteger(a?.Line)||a.Line<1||a.Line>lines.length||typeof a.Match!=='string'||!a.Match) return [];
      const line=lines[a.Line-1], i=line.indexOf(a.Match);
      if (i<0||line.indexOf(a.Match,i+1)!==-1) return [];
      const start=offsets[a.Line-1]+i,end=start+a.Match.length;
      return [{start,end,original:a.Match,rule:a.Check,category:'terminology',message:a.Message}];
    });
  }});
}
