import {LIMITS,eligible,validReplacement,boundaries,validRange} from '../regions.mjs';

// Host-owned dictionary: no third-party data is bundled. Exact membership,
// one grapheme insertion/deletion/substitution/transposition. No text upload.
const alphabet=[...'آابتثجحخدذرزژسشصضطظعغفقکگلمنوهیپچئءؤأإ'];
const graphemes=new Intl.Segmenter('fa',{granularity:'grapheme'});
const split=x=>[...graphemes.segment(x)].map(s=>s.segment);
const letters=/^[آابتثجحخدذرزژسشصضطظعغفقکگلمنوهیپچئءؤأإ]{3,24}$/u;
const normalize=x=>x.normalize('NFC').replace(/[يك]/gu,c=>c==='ي'?'ی':'ک');
const MAX_WORDS=250000, MAX_TOKENS=100, MAX_CANDIDATES=4;
export function createPersianLexiconProvider({words}={}){
  if(!Array.isArray(words)||!words.length||words.length>MAX_WORDS)throw new TypeError('Invalid Persian lexicon');
  const dictionary=new Set();
  for(const w of words){
    if(typeof w!=='string'||!w.isWellFormed()||!letters.test(normalize(w)))throw new TypeError('Invalid Persian lexeme');
    dictionary.add(normalize(w));
  }
  const cache=new Map();
  function candidates(source){
    if(cache.has(source))return cache.get(source);
    const a=split(source),found=new Map();
    function add(parts,weight){
      const w=parts.join('');
      if(w!==source&&dictionary.has(w)&&(!found.has(w)||found.get(w)<weight))found.set(w,weight);
    }
    for(let i=0;i<a.length;i++){
      add([...a.slice(0,i),...a.slice(i+1)],a[i]===a[i-1]||a[i]===a[i+1]?4:2);
      if(i+1<a.length)add([...a.slice(0,i),a[i+1],a[i],...a.slice(i+2)],5);
      for(const ch of alphabet)if(ch!==a[i])add([...a.slice(0,i),ch,...a.slice(i+1)],1);
    }
    for(let i=0;i<=a.length;i++)for(const ch of alphabet)add([...a.slice(0,i),ch,...a.slice(i)],2);
    const result=[...found].sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:a[0]>b[0]?1:0)).slice(0,MAX_CANDIDATES).map(x=>x[0]);
    if(cache.size>=512)cache.delete(cache.keys().next().value);cache.set(source,result);return result;
  }
  return Object.freeze({id:'fa-lexicon',languages:Object.freeze(['fa']),check(text,language,signal){
    if(language!=='fa'||typeof text!=='string'||text.length>LIMITS.region||!text.isWellFormed()||!eligible(text,'fa'))throw new TypeError('Invalid lexicon input');
    if(signal?.aborted)throw new Error('Cancelled');
    const b=boundaries(text),out=[];let count=0;
    // Whole lexical tokens only: never review fragments of ZWNJ words, names
    // supplied as protected regions, words with marks, or unsupported scripts.
    for(const m of text.matchAll(/[\p{L}\p{M}\u200c]+/gu)){
      if(signal?.aborted)throw new Error('Cancelled');
      if(++count>MAX_TOKENS)throw new RangeError('Lexicon token budget');
      const original=m[0],source=normalize(original),start=m.index,end=start+original.length;
      if(!letters.test(source)||dictionary.has(source)||!validRange(text,start,end,b))continue;
      for(const replacement of candidates(source)){
        if(!validReplacement(original,replacement,'fa'))continue;
        if(out.length>=LIMITS.providerFindings)throw new RangeError('Lexicon finding budget');
        out.push({start,end,original,replacement,category:'spelling',rule:'fa-lexicon-one-edit',message:'Review this dictionary-based spelling candidate; verify technical names and meaning.'});
      }
    }
    return out;
  }});
}
