import {LIMITS,validateDocument,eligible,validRange,validReplacement,boundaries} from './regions.mjs';

const MAX_RECORDS=512, MAX_VOTES=32;
const token=/^[\p{L}\p{M}]+(?:\u200c[\p{L}\p{M}]+)*$/u;
const provider=/^[a-z][a-z0-9-]{0,47}$/u, rule=/^[a-zA-Z0-9_.:/-]{1,100}$/u;
const kinds=new Set(['spelling','orthography','grammar','terminology','style','technical-writing']);
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join(',')===keys;
const plain=x=>typeof x==='string'&&x.length>0&&x.length<=LIMITS.message&&!/[<>\p{Cc}\p{Cf}]/u.test(x);
const word=x=>typeof x==='string'&&x.length<=48&&x.isWellFormed()&&token.test(x);
function learnable(language,f){
  return ['en','fa'].includes(language)&&f.category==='spelling'&&word(f.original)&&word(f.replacement)&&
    eligible(f.original,language)&&validReplacement(f.original,f.replacement,language);
}
const keyOf=(language,f)=>JSON.stringify([language,f.original,f.replacement]);
function load(profile){
  const map=new Map();
  if(profile===undefined)return map;
  if(!exact(profile,'records,version')||profile.version!==1||!Array.isArray(profile.records)||profile.records.length>MAX_RECORDS)throw new TypeError('Invalid preference profile');
  for(const r of profile.records){
    if(!exact(r,'accepted,language,original,rejected,replacement')||
      !learnable(r.language,{...r,category:'spelling'})||
      ![r.accepted,r.rejected].every(x=>Number.isSafeInteger(x)&&x>=0&&x<=MAX_VOTES)||
      r.accepted+r.rejected<1||r.accepted+r.rejected>MAX_VOTES)throw new TypeError('Invalid preference record');
    const key=keyOf(r.language,r);if(map.has(key))throw new TypeError('Duplicate preference record');
    map.set(key,{language:r.language,original:r.original,replacement:r.replacement,accepted:r.accepted,rejected:r.rejected});
  }
  return map;
}
// Review-only preference state. No network, storage, document history, or
// automatic learning. Host owns scope and persistence, including consent.
export function createAdaptiveReview({profile}={}){
  const records=load(profile);let epoch=0;
  const invalidate=()=>{epoch++;};
  function exportProfile(){
    return Object.freeze({version:1,records:Object.freeze([...records.values()].map(r=>Object.freeze({...r})))});
  }
  function prepare(document,analysis){
    invalidate();
    if(!validateDocument(document)||!analysis||analysis.snapshotId!==document.snapshotId||analysis.apply!==false||
      !['complete','partial'].includes(analysis.status)||!Array.isArray(analysis.findings)||analysis.findings.length>LIMITS.findings)throw new TypeError('Invalid review snapshot');
    const current=epoch,b=boundaries(document.text),groups=new Map();
    for(const f of analysis.findings){
      if(!f||!provider.test(f.provider??'')||!rule.test(f.rule??'')||!kinds.has(f.category)||!plain(f.message)||
        !validRange(document.text,f.start,f.end,b)||document.text.slice(f.start,f.end)!==f.original)throw new TypeError('Invalid review finding');
      const region=document.regions.find(r=>r.kind==='prose'&&f.start>=r.start&&f.end<=r.end&&
        (f.start!==f.end||f.start>r.start&&f.end<r.end));
      if(!region||!eligible(document.text.slice(region.start,region.end),region.language)||
        (f.replacement===undefined?f.start===f.end:!validReplacement(f.original,f.replacement,region.language)))throw new TypeError('Finding outside authorized prose');
      // Exact-span fusion only. Never discard competing overlapping ranges.
      // Advisory messages remain separate, including provider provenance.
      const groupKey=JSON.stringify([f.start,f.end,f.category,f.replacement===undefined?f.provider:null,f.replacement===undefined?f.rule:null]);
      let g=groups.get(groupKey);
      if(!g){g={language:region.language,choices:new Map()};groups.set(groupKey,g);}
      const candidateKey=JSON.stringify(f.replacement===undefined?[null,f.message]:[f.replacement]);
      let c=g.choices.get(candidateKey);
      const copy=Object.freeze({provider:f.provider,rule:f.rule,category:f.category,start:f.start,end:f.end,original:f.original,message:f.message,...(f.replacement===undefined?{}:{replacement:f.replacement})});
      if(!c){c={finding:copy,sources:[],ordinal:g.choices.size};g.choices.set(candidateKey,c);}
      if(!c.sources.some(s=>s.provider===f.provider&&s.rule===f.rule&&s.message===f.message))c.sources.push(Object.freeze({provider:f.provider,rule:f.rule,message:f.message}));
    }
    const view=Object.freeze([...groups.values()].map(g=>{
      const choices=[...g.choices.values()].map(c=>{
        const canLearn=learnable(g.language,c.finding),r=canLearn?records.get(keyOf(g.language,c.finding)):undefined;
        const n=r?r.accepted+r.rejected:0;
        // A single observation cannot override baseline order. Smoothed bounded
        // preference, not calibrated linguistic confidence. Never hide an edit.
        const preference=n>=2?(r.accepted-r.rejected)/(n+4):0;
        return {ordinal:c.ordinal,score:preference-c.ordinal*0.03,candidate:Object.freeze({finding:c.finding,sources:Object.freeze(c.sources),learnable:canLearn,preference})};
      }).sort((a,b)=>b.score-a.score||a.ordinal-b.ordinal).map(c=>c.candidate);
      return Object.freeze({language:g.language,candidates:Object.freeze(choices)});
    }));
    const voted=new Set();
    return Object.freeze({groups:view,record(groupIndex,candidateIndex,decision){
      if(current!==epoch||!Number.isSafeInteger(groupIndex)||!Number.isSafeInteger(candidateIndex)||!['prefer','reject'].includes(decision)||voted.has(groupIndex))return false;
      const g=view[groupIndex],c=g?.candidates[candidateIndex];if(!c?.learnable)return false;
      const key=keyOf(g.language,c.finding);
      let r=records.get(key)??{language:g.language,original:c.finding.original,replacement:c.finding.replacement,accepted:0,rejected:0};
      if(r.accepted+r.rejected>=MAX_VOTES){r={...r,accepted:Math.floor(r.accepted/2),rejected:Math.floor(r.rejected/2)};}
      r={...r,[decision==='prefer'?'accepted':'rejected']:r[decision==='prefer'?'accepted':'rejected']+1};
      records.delete(key);records.set(key,r);if(records.size>MAX_RECORDS)records.delete(records.keys().next().value);
      voted.add(groupIndex);return true;
    }});
  }
  return Object.freeze({prepare,invalidate,exportProfile,clear(){invalidate();records.clear();}});
}
