// Evaluation-only parser, not a dictionary builder. Strict schema and counts.
const simple=/^[آابتثجحخدذرزژسشصضطظعغفقکگلمنوهیپچئءؤأإ]{1,24}$/u;
const norm=s=>s.trim().normalize('NFC').replace(/[يك]/gu,c=>c==='ي'?'ی':'ک');
export function parseFaSpell(raw,expectedRows){
 if(typeof raw!=='string'||!raw.isWellFormed()||raw.length>2000000||!Number.isSafeInteger(expectedRows)||expectedRows<1||expectedRows>20000)throw new TypeError('Invalid benchmark input');
 const lines=raw.replace(/^\uFEFF/u,'').split(/\r?\n/u);
 while(lines.at(-1)==='')lines.pop();
 const header=lines.shift().split('\t').map(s=>s.trim());
 const bad=header.indexOf('#misspelt'),good=header.indexOf('corrected');
 if(bad<0||good<0||new Set(header).size!==header.length||lines.length!==expectedRows)throw new Error('Benchmark schema/count mismatch');
 const counts={rows:lines.length,unchanged:0,normalizedEqual:0,boundary:0,unsupported:0,duplicates:0,eligible:0};
 const unique=new Map();
 for(const line of lines){
  const row=line.split('\t');if(row.length!==header.length||!row[bad]?.trim()||!row[good]?.trim())throw new Error('Malformed benchmark row');
  const source=norm(row[bad]),target=norm(row[good]);
  if(row[bad]===row[good]){counts.unchanged++;continue;}
  if(source===target){counts.normalizedEqual++;continue;}
  if(/[\s\u200c]/u.test(source)||/[\s\u200c]/u.test(target)){counts.boundary++;continue;}
  if(!simple.test(source)||!simple.test(target)){counts.unsupported++;continue;}
  const key=source+'\t'+target;
  if(unique.has(key)){counts.duplicates++;continue;}
  unique.set(key,{source,target});counts.eligible++;
 }
 if(Object.entries(counts).filter(([k])=>k!=='rows').reduce((n,[,v])=>n+v,0)!==counts.rows)throw new Error('Benchmark accounting mismatch');
 return {counts,cases:[...unique.values()]};
}
export function summarizeCases(cases,review){
 const result={pairs:0,top1:0,top4:0,abstained:0,wrongWithSuggestion:0,correctWithSuggestion:0,pairedSuccess:0,partial:0};
 const durations=[];
 for(const {source,target} of cases){
  const t=performance.now(),a=review(source),b=review(target);durations.push(performance.now()-t);
  if(!a||!b||!Array.isArray(a.candidates)||!Array.isArray(b.candidates)||a.candidates.length>4||b.candidates.length>4)throw new Error('Invalid comparator output');
  result.pairs++;
  if(a.candidates[0]===target)result.top1++;
  if(a.candidates.includes(target))result.top4++;
  if(!a.candidates.length)result.abstained++;else result.wrongWithSuggestion++;
  if(b.candidates.length)result.correctWithSuggestion++;
  if(a.candidates.includes(target)&&!b.candidates.length&&!a.partial&&!b.partial)result.pairedSuccess++;
  if(a.partial||b.partial)result.partial++;
 }
 durations.sort((a,b)=>a-b);
 return {...result,pairLatencyMsP50:durations[Math.max(0,Math.ceil(durations.length*.5)-1)]??0,pairLatencyMsP95:durations[Math.max(0,Math.ceil(durations.length*.95)-1)]??0};
}
