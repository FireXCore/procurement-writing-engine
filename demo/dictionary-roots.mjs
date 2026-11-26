// Lilak Hunspell root extraction for the optional demo, not a Hunspell parser.
// Reject NEEDAFFIX, ONLYINCOMPOUND, NOSUGGEST and non-simple surface words.
// No affix expansion, stripping of joiners, or inference of valid morphology.
const simple=/^[آابتثجحخدذرزژسشصضطظعغفقکگلمنوهیپچئءؤأإ]{3,24}$/u;
export function parseDictionaryRoots(raw){
  if(typeof raw!=='string'||!raw.isWellFormed()||raw.length>8000000)throw new TypeError('Invalid dictionary asset');
  const lines=raw.replace(/^\uFEFF/u,'').split(/\r?\n/u),header=lines.shift()?.trim();
  if(!/^[0-9]{1,7}$/u.test(header??''))throw new TypeError('Missing Hunspell count');
  const words=new Set();let entries=0;
  for(const line of lines){
    if(!line.trim()||line.startsWith('#'))continue;
    entries++;
    const field=line.trim().split(/\s+/u)[0],parts=field.split('/');
    if(parts.length>2)continue;
    const [surface,flags='']=parts;
    if(flags.length%2!==0||/[\p{Cc}\p{Cf}]/u.test(flags))continue;
    const flagSet=new Set(flags.match(/.{2}/gu)??[]);
    if(['AA','OO','!!'].some(f=>flagSet.has(f)))continue;
    const word=surface.normalize('NFC').replace(/[يك]/gu,c=>c==='ي'?'ی':'ک');
    if(simple.test(word))words.add(word);
  }
  if(entries!==Number(header))throw new RangeError('Dictionary entry count mismatch');
  if(!words.size||words.size>250000)throw new RangeError('Unsupported dictionary size');
  return [...words].sort();
}

// Source-only evidence: retain explicit simple surfaces even with restrictive
// flags. They are abstention evidence, never spelling replacement targets.
// Only the pinned Lilak long-flag, zero-strip, unconditional suffix subset is
// recognized. No claim of complete Hunspell morphology or source correctness.
const simpleEvidence=/^[آابتثجحخدذرزژسشصضطظعغفقکگلمنوهیپچئءؤأإ]{1,24}$/u;
const normalizeEvidence=x=>x.normalize('NFC').replace(/[يك]/gu,c=>c==='ي'?'ی':'ک');
export function parseDictionaryEvidence(raw,aff){
  const words=parseDictionaryRoots(raw);
  if(typeof aff!=='string'||aff.length>50000||!/^FLAG\s+long\s*$/mu.test(aff))throw new TypeError('Unsupported affix format');
  const suffixes=new Map(),surfaces=new Map();
  for(const line of aff.split(/\r?\n/u)){
    const p=line.trim().split(/\s+/u);
    if(p[0]!=='SFX'||p.length!==5||p[2]!=='0'||p[4]!=='.'||!/^[a-z]{2}$/u.test(p[1]))continue;
    const suffix=normalizeEvidence(p[3].split('/')[0]);
    if(!simpleEvidence.test(suffix)||suffix.length>12)continue;
    if(!suffixes.has(suffix))suffixes.set(suffix,new Set());
    suffixes.get(suffix).add(p[1]);
  }
  if(!suffixes.size||suffixes.size>128)throw new RangeError('Invalid suffix evidence');
  for(const line of raw.replace(/^\uFEFF/u,'').split(/\r?\n/u).slice(1)){
    const parts=line.trim().split(/\s+/u)[0].split('/');
    if(parts.length>2)continue;
    const [surface,flags='']=parts,w=normalizeEvidence(surface);
    if(!simpleEvidence.test(w)||flags.length%2!==0||flags.length>256||!/^[A-Za-z!]*$/u.test(flags))continue;
    const prior=surfaces.get(w)??new Set();
    for(const f of flags.match(/.{2}/gu)??[])prior.add(f);
    surfaces.set(w,prior);
  }
  if(surfaces.size>250000)throw new RangeError('Source evidence limit');
  return {words,surfaces:[...surfaces].map(([w,f])=>[w,[...f]]),suffixes:[...suffixes].map(([s,f])=>[s,[...f]])};
}
export function createSourceAbstainer(evidence){
  const surfaces=new Map(evidence.surfaces.map(([w,f])=>[w,new Set(f)]));
  const suffixes=evidence.suffixes.map(([s,f])=>[s,new Set(f)]);
  return word=>{
    if(surfaces.has(word))return true;
    for(const [suffix,flags] of suffixes){
      if(word.length<=suffix.length||!word.endsWith(suffix))continue;
      const stem=surfaces.get(word.slice(0,-suffix.length));
      if(stem&&[...flags].some(f=>stem.has(f)))return true;
    }
    return false;
  };
}

// Keep the browser artifact as two flat strings, rather than thousands of
// nested arrays and per-word Sets. Exact binary search, no hash collisions.
export function packDictionaryEvidence(evidence){
  const rows=evidence.surfaces.map(([w,f])=>w+'\t'+f.join('')).sort((a,b)=>a<b?-1:a>b?1:0);
  return {version:1,words:evidence.words.join('\n'),surfaces:rows.join('\n'),suffixes:evidence.suffixes};
}
export function unpackDictionaryEvidence(packed){
  if(!packed||packed.version!==1||typeof packed.words!=='string'||typeof packed.surfaces!=='string'||packed.words.length>8000000||packed.surfaces.length>16000000||!Array.isArray(packed.suffixes)||packed.suffixes.length>128)throw new TypeError('Invalid packed dictionary');
  const words=packed.words.split('\n'),rows=packed.surfaces.split('\n');
  if(!words.length||words.length>250000||rows.length>250000)throw new RangeError('Packed dictionary size');
  const suffixes=packed.suffixes;
  function lookup(word){
    let lo=0,hi=rows.length-1;
    while(lo<=hi){
      const mid=(lo+hi)>>>1,row=rows[mid],tab=row.indexOf('\t'),key=row.slice(0,tab);
      if(key===word)return row.slice(tab+1);
      if(key<word)lo=mid+1;else hi=mid-1;
    }
    return undefined;
  }
  return {words,isKnownSource(word){
    if(lookup(word)!==undefined)return true;
    for(const [suffix,flags] of suffixes){
      if(word.length<=suffix.length||!word.endsWith(suffix))continue;
      const stem=lookup(word.slice(0,-suffix.length));
      if(stem!==undefined){
        for(let i=0;i<stem.length;i+=2)if(flags.includes(stem.slice(i,i+2)))return true;
      }
    }
    return false;
  }};
}
