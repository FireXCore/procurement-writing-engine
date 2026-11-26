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
