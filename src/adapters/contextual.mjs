import { LIMITS, validReplacement, eligible } from '../regions.mjs';
import { resolveSourceRange } from '../offsets.mjs';
import { validateNeuralEdit } from './neural-safety.mjs';

const contextualCategories=new Set(['spelling','grammar','orthography','style','terminology','technical-writing']);
// Explicit host-owned inference transport. No model, download or network bundled.
export function createContextualProvider({infer,languages=['en','fa']}={}) {
  if(typeof infer!=='function'||!Array.isArray(languages)||!languages.length||
     languages.some(l=>!['en','fa'].includes(l)))throw new TypeError('Invalid contextual provider');
  const supported=Object.freeze([...new Set(languages)]);
  return Object.freeze({id:'contextual-local',languages:supported,async check(text,language,signal){
    if(typeof text!=='string'||!text.isWellFormed()||text.length>LIMITS.region||!supported.includes(language)||!eligible(text,language))throw new TypeError('Invalid contextual input');
    if(signal?.aborted)throw new Error('Cancelled');
    const raw=await infer(Object.freeze({text,language,signal}));
    if(signal?.aborted)throw new Error('Cancelled');
    if(!Array.isArray(raw)||raw.length>LIMITS.providerFindings)throw new TypeError('Invalid contextual batch');
    const out=[];
    for(const c of raw){
      if(!c||!contextualCategories.has(c.category)||typeof c.replacement!=='string'||typeof c.original!=='string')throw new TypeError('Invalid contextual candidate');
      const r=resolveSourceRange(text,c);
      if(!r.original||!validReplacement(r.original,c.replacement,language)||!validateNeuralEdit(text,{...r,replacement:c.replacement,category:c.category},language))throw new RangeError('Invalid contextual edit');
      out.push(Object.freeze({...r,replacement:c.replacement,category:c.category,rule:'contextual-candidate',message:'Review this contextual suggestion; verify meaning before use.'}));
    }
    out.sort((a,b)=>a.start-b.start||a.end-b.end);
    if(out.some((x,i)=>i>0&&x.start<out[i-1].end))throw new RangeError('Overlapping contextual edits');
    return Object.freeze(out);
  }});
}
