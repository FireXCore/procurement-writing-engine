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
