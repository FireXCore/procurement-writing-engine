// Explicit host-reviewed corpus only. No learning from document content,
// no external calls, no persisted text, no modification to candidate validity.
import {eligible} from '../regions.mjs';
const word=/^[آابتثجحخدذرزژسشصضطظعغفقکگلمنوهیپچئءؤأإ]{1,24}$/u;
const norm=w=>w.normalize('NFC').replace(/[يك]/gu,c=>c==='ي'?'ی':'ک');
const tokens=/[\p{L}\p{M}\u200c]+/gu;
export function buildPersianRanking({corpus=[],frequencies=[],hasWord}){
  if(typeof hasWord!=='function'||!Array.isArray(corpus)||corpus.length>2000||!Array.isArray(frequencies)||frequencies.length>100000)throw new TypeError('Invalid ranking evidence');
  const frequency=new Map(),pairs=new Map(),seen=new Set();
  let units=0;
  for(const entry of frequencies){
    if(!Array.isArray(entry)||entry.length!==2||typeof entry[0]!=='string'||!entry[0].isWellFormed()||!word.test(norm(entry[0]))||!Number.isSafeInteger(entry[1])||entry[1]<1||entry[1]>1000000000)throw new TypeError('Invalid frequency entry');
    const key=norm(entry[0]);if(seen.has(key))throw new TypeError('Duplicate normalized frequency');seen.add(key);
    if(hasWord(key))frequency.set(key,entry[1]);
  }
  const pairKey=(a,b)=>a+'\t'+b;
  for(const line of corpus){
    if(typeof line!=='string'||!line.isWellFormed()||line.length>1000||!eligible(line,'fa'))throw new TypeError('Invalid ranking corpus line');
    units+=line.length;if(units>200000)throw new RangeError('Ranking corpus size');
    let previous=null,end=0;
    for(const m of line.matchAll(tokens)){
      const w=norm(m[0]),valid=word.test(w);
      if(previous&&valid&&/^[ \t]+$/u.test(line.slice(end,m.index))){
        const k=pairKey(previous,w);pairs.set(k,Math.min(32,(pairs.get(k)??0)+1));
      }
      previous=valid?w:null;end=m.index+m[0].length;
    }
  }
  // A frequency prior only breaks near ties; exact local bigrams may have
  // more weight but cannot promote an unvalidated spelling target.
  const scorePair=(a,b)=>a&&b?Math.min(1.5,Math.log2(1+(pairs.get(pairKey(a,b))??0))):0;
  return Object.freeze({
    neighbors(text,start,end){
      const l=text.slice(Math.max(0,start-100),start).match(/([\p{L}\p{M}\u200c]+)[ \t]+$/u);
      const r=text.slice(end,end+100).match(/^[ \t]+([\p{L}\p{M}\u200c]+)/u);
      const a=l?norm(l[1]):'',b=r?norm(r[1]):'';
      // Never infer a token from a truncated slice at the search boundary.
      return [l&&l.index===0&&start>100?'':word.test(a)?a:'',r&&r[0].length===100&&end+100<text.length?'':word.test(b)?b:''];
    },
    score(candidate,left,right){
      const count=frequency.get(candidate)??0;
      return Math.min(.24,Math.log10(1+count)*.04)+scorePair(left,candidate)+scorePair(candidate,right);
    }
  });
}
