import { boundaries, eligible, validateDocument, LIMITS } from '../src/regions.mjs';

// Synthetic demo classifier ONLY. The SDK still requires an authoritative host region map.
// Recognize explicit fixture terms and a small set of well-bounded quantity/identifier shapes.
// Unknown tokens fail closed; only separated, grapheme-aligned language runs are reviewed.
const shapes=[
  /\bASTM[ \t]+[A-Z]\d{2,5}(?:[ \t]+[A-Z]{2,5})?(?=$|[\s,;.)])/gu,
  /\bRosemount[ \t]+3051\b/giu,
  /\b(?:PN|P\/N|Part[ \t]+Number):[ \t]*[A-Z0-9]+(?:[-./][A-Z0-9]+)*(?=$|[\s,;.)])/gu,
  /(?<![\p{L}\p{N}])\d+[ \t]+(?:PCS|EA|NO)\b/gu,
  /(?<![\p{L}\p{N}])\d+(?:[–-]\d+)?[ \t]*mA\b/gu,
  /(?<![\p{L}\p{N}])[\u06f0-\u06f9\u0660-\u0669]+[ \t]+عدد(?![\p{L}\p{M}])/gu
];
// Whole, whitespace-delimited ASCII alphanumeric identifiers; preserve original case.
// Never infer that surrounding words are technical data or that this is a production map.
const identifier=/(?<!\S)(?=[A-Za-z0-9./-]*[A-Za-z])(?=[A-Za-z0-9./-]*[0-9])[A-Za-z0-9]+(?:[-./][A-Za-z0-9]+)*(?=$|\s|[.,;:!?)](?=$|\s))/gu;
function detectLanguage(text){
  const latin=/\p{Script=Latin}/u.test(text), arabic=/\p{Script=Arabic}/u.test(text);
  if(latin===arabic)return null;
  return latin?'en':'fa';
}
export function buildDemoSnapshot(input,locked,snapshotId){
  if(typeof input!=='string'||typeof locked!=='string'||!input.isWellFormed()||input.length>1500)throw new TypeError('Invalid synthetic input');
  const text=input+'\n'+locked, b=boundaries(text);
  const known=shapes.flatMap(pattern=>Array.from(input.matchAll(pattern),m=>({start:m.index,end:m.index+m[0].length})));
  const inferred=Array.from(input.matchAll(identifier),m=>({start:m.index,end:m.index+m[0].length})).filter(r=>!known.some(k=>r.start>=k.start&&r.end<=k.end));
  const ranges=[...known,...inferred].sort((a,b)=>a.start-b.start||a.end-b.end);
  const merged=[];
  for(const r of ranges){
    const prev=merged.at(-1);
    if(prev&&r.start<=prev.end)prev.end=Math.max(prev.end,r.end);
    else merged.push({...r});
  }
  const regions=[], languages=new Set();
  let skipped=0;
  function protect(start,end){if(start<end)regions.push({start,end,kind:'protected'});}
  function gap(start,end){
    if(start>=end)return;
    const source=text.slice(start,end);
    const mixed=/\p{Script=Latin}/u.test(source)&&/\p{Script=Arabic}/u.test(source);
    if(!mixed){classify(start,end);return;}
    // Split only at whitespace-delimited token boundaries. A mixed-script token,
    // controls, digits, URLs or unknown technical punctuation make the whole gap unsafe.
    const tokens=[...source.matchAll(/\S+/gu)];
    const runs=[];
    for(const token of tokens){
      const language=detectLanguage(token[0]);
      if(!language||!eligible(token[0],language)){classify(start,end);return;}
      const offset=start+token.index;
      if(!b.has(offset)){classify(start,end);return;}
      if(runs.at(-1)?.language!==language)runs.push({start:offset,language});
    }
    if(!runs.length){classify(start,end);return;}
    runs[0].start=start;
    for(let i=0;i<runs.length;i++)classify(runs[i].start,runs[i+1]?.start??end);
  }
  function classify(start,end){
    if(start>=end)return;
    const source=text.slice(start,end),language=detectLanguage(source);
    if(language&&eligible(source,language)){
      regions.push({start,end,kind:'prose',language});languages.add(language);
    }else{
      if(/[\p{L}\p{N}\p{Cf}\p{Cc}]/u.test(source.trim()))skipped++;
      protect(start,end);
    }
  }
  // If any boundaries are not grapheme-aligned, skip the whole editable region.
  const invalid=merged.some(r=>!b.has(r.start)||!b.has(r.end))||!b.has(input.length);
  if(invalid){
    skipped=1;protect(0,text.length);
    return {document:{text,snapshotId,regions},languages:[],inlineProtected:0,inferredProtected:0,skipped};
  }
  let cursor=0;
  for(const r of merged){gap(cursor,r.start);protect(r.start,r.end);cursor=r.end;}
  gap(cursor,input.length);
  protect(input.length,text.length);
  const document={text,snapshotId,regions};
  // Bound highly alternating input without weakening the host validation.
  if(regions.length>LIMITS.regions)return {document:{text,snapshotId,regions:[{start:0,end:text.length,kind:'protected'}]},languages:[],inlineProtected:0,inferredProtected:0,skipped:1};
  if(!validateDocument(document))throw new Error('Invalid synthetic region partition');
  return {document,languages:[...languages],inlineProtected:merged.length,inferredProtected:inferred.length,skipped};
}
