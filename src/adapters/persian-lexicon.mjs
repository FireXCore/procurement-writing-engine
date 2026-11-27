import {LIMITS,eligible,validReplacement,boundaries,validRange} from '../regions.mjs';

// Host-owned dictionary: no third-party data is bundled. Exact membership,
// one grapheme insertion/deletion/substitution/transposition. No text upload.
const alphabet=[...'آابتثجحخدذرزژسشصضطظعغفقکگلمنوهیپچئءؤأإ'];
const graphemes=new Intl.Segmenter('fa',{granularity:'grapheme'});
const split=x=>[...graphemes.segment(x)].map(s=>s.segment);
const letters=/^[آابتثجحخدذرزژسشصضطظعغفقکگلمنوهیپچئءؤأإ]{3,24}$/u;
const normalize=x=>x.normalize('NFC').replace(/[يك]/gu,c=>c==='ي'?'ی':'ک');
// Common Persian standard keyboard letter positions. Approximate physical
// adjacency is weak evidence, not a lexical or semantic rule.
const keyboardRows=['ضصثقفغعهخحجچ','شسیبلاتنمکگ','ظطزرذدپو'];
const positions=new Map();
for(const [y,row] of keyboardRows.entries())for(const [x,ch] of [...row].entries())positions.set(ch,[x+[0,0.25,0.75][y],y]);
function keyboardNeighbor(a,b){
  const p=positions.get(a),q=positions.get(b);
  return !!p&&!!q&&a!==b&&Math.abs(p[1]-q[1])<=1&&Math.abs(p[0]-q[0])<=1.25;
}
const MAX_WORDS=250000, MAX_TOKENS=100, MAX_CANDIDATES=4;
export function createPersianLexiconProvider({words,isKnownSource=()=>false,preferredSpellings=[],preferredWords=[]}={}){
  if(!Array.isArray(words)||!words.length||words.length>MAX_WORDS)throw new TypeError('Invalid Persian lexicon');
  if(typeof isKnownSource!=='function')throw new TypeError('Invalid source evidence');
  const dictionary=new Set();
  for(const w of words){
    if(typeof w!=='string'||!w.isWellFormed()||!letters.test(normalize(w)))throw new TypeError('Invalid Persian lexeme');
    dictionary.add(normalize(w));
  }
  // Host-approved orthographic aliases, not an arbitrary synonym map.
  // Only hamza placement variants of known words may influence candidates.
  // Already-valid spellings are never reported merely for using an alias.
  if(!Array.isArray(preferredSpellings)||preferredSpellings.length>128)throw new TypeError('Invalid preferred spellings');
  const preferred=new Map(),canonical=new Set();
  const fold=w=>w.replace(/[أإ]/gu,'ا').replace(/ؤ/gu,'و').replace(/ئ/gu,'ی');
  for(const pair of preferredSpellings){
    if(!Array.isArray(pair)||pair.length!==2||pair.some(w=>typeof w!=='string'||!w.isWellFormed()||!letters.test(w)))throw new TypeError('Invalid orthographic alias');
    const [alias,target]=pair.map(normalize);
    if(alias===target||fold(alias)!==fold(target)||preferred.has(alias)||canonical.has(alias)||preferred.has(target))throw new TypeError('Conflicting orthographic alias');
    preferred.set(alias,target);canonical.add(target);
  }
  for(const [alias,target] of preferred){
    if(dictionary.has(alias)||dictionary.has(target)){
      dictionary.add(alias);dictionary.add(target);
    }else preferred.delete(alias);
  }
  // Optional domain prior ranks existing valid candidates only. It cannot
  // override exact source evidence or make an unknown target valid.
  if(!Array.isArray(preferredWords)||preferredWords.length>512||preferredWords.some(w=>typeof w!=='string'||!w.isWellFormed()||!letters.test(w)))throw new TypeError('Invalid preferred words');
  const domain=new Set(preferredWords.map(normalize).filter(w=>dictionary.has(w)));
  const cache=new Map();
  function candidates(source){
    if(cache.has(source))return cache.get(source);
    const a=split(source),found=new Map();
    function add(parts,weight){
      const w=parts.join('');
      if(w===source||!dictionary.has(w))return;
      if(!found.has(w)||found.get(w)<weight)found.set(w,weight);
      const target=preferred.get(w);
      if(target&&target!==source&&(!found.has(target)||found.get(target)<weight+0.25))found.set(target,weight+0.25);
    }
    for(let i=0;i<a.length;i++){
      add([...a.slice(0,i),...a.slice(i+1)],a[i]===a[i-1]||a[i]===a[i+1]?6:2);
      if(i+1<a.length)add([...a.slice(0,i),a[i+1],a[i],...a.slice(i+2)],5);
      for(const ch of alphabet)if(ch!==a[i])add([...a.slice(0,i),ch,...a.slice(i+1)],keyboardNeighbor(a[i],ch)?1.25:1);
    }
    for(let i=0;i<=a.length;i++)for(const ch of alphabet)add([...a.slice(0,i),ch,...a.slice(i)],ch===a[i-1]||ch===a[i]?2.25:2);
    // Fallback only for two distinct adjacent-repeat runs. Never general
    // two-edit search, never override a valid source, and abstain if there
    // is no known dictionary word after both deletions.
    if(!found.size){
      const repeats=[];
      for(let i=1;i<a.length;i++)if(a[i]===a[i-1]&&(i<2||a[i]!==a[i-2]))repeats.push(i);
      for(let i=0;i<repeats.length;i++)for(let j=i+1;j<repeats.length;j++)add(a.filter((_,k)=>k!==repeats[i]&&k!==repeats[j]),1);
    }
    const rank=([word,weight])=>weight+(domain.has(word)?5:0);
    const result=[...found].sort((a,b)=>rank(b)-rank(a)||(a[0]<b[0]?-1:a[0]>b[0]?1:0)).slice(0,MAX_CANDIDATES).map(x=>x[0]);
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
      // Short unknown forms are ambiguous (e.g. فنی). Abstain rather than guessing.
      if(!letters.test(source)||source.length<=3||dictionary.has(source)||isKnownSource(source)===true||!validRange(text,start,end,b))continue;
      for(const replacement of candidates(source)){
        if(!validReplacement(original,replacement,'fa'))continue;
        if(out.length>=LIMITS.providerFindings)throw new RangeError('Lexicon finding budget');
        out.push({start,end,original,replacement,category:'spelling',rule:'fa-lexicon-one-edit',message:'Review this dictionary-based spelling candidate; verify technical names and meaning.'});
      }
    }
    return out;
  }});
}
