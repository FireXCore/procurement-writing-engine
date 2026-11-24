import { boundaries, eligible, validateDocument } from '../src/regions.mjs';

// Synthetic demo classifier ONLY. The SDK still requires an authoritative host region map.
// Recognize explicit fixture terms and a small set of well-bounded quantity/identifier shapes.
// Unknown or mixed-script gaps fail closed; do not treat this as a production industrial parser.
const shapes=[
  /\bRosemount[ \t]+3051\b/giu,
  /\b(?:PN|P\/N|Part[ \t]+Number):[ \t]*[A-Z0-9]+(?:[-./][A-Z0-9]+)*(?=$|[\s,;.)])/gu,
  /(?<![\p{L}\p{N}])\d+[ \t]+(?:PCS|EA|NO)\b/gu,
  /(?<![\p{L}\p{N}])\d+(?:[–-]\d+)?[ \t]*mA\b/gu,
  /(?<![\p{L}\p{N}])[\u06f0-\u06f9\u0660-\u0669]+[ \t]+عدد(?![\p{L}\p{M}])/gu
];
function detectLanguage(text){
  const latin=/\p{Script=Latin}/u.test(text), arabic=/\p{Script=Arabic}/u.test(text);
  if(latin===arabic)return null;
  return latin?'en':'fa';
}
export function buildDemoSnapshot(input,locked,snapshotId){
  if(typeof input!=='string'||typeof locked!=='string'||!input.isWellFormed()||input.length>1500)throw new TypeError('Invalid synthetic input');
  const text=input+'\n'+locked, b=boundaries(text);
  const ranges=shapes.flatMap(pattern=>Array.from(input.matchAll(pattern),m=>({start:m.index,end:m.index+m[0].length}))).sort((a,b)=>a.start-b.start||a.end-b.end);
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
    return {document:{text,snapshotId,regions},languages:[],inlineProtected:0,skipped};
  }
  let cursor=0;
  for(const r of merged){gap(cursor,r.start);protect(r.start,r.end);cursor=r.end;}
  gap(cursor,input.length);
  protect(input.length,text.length);
  const document={text,snapshotId,regions};
  if(!validateDocument(document))throw new Error('Invalid synthetic region partition');
  return {document,languages:[...languages],inlineProtected:merged.length,skipped};
}
