import { validateDocument, LIMITS } from './regions.mjs';
import { resolveSourceRange } from './offsets.mjs';

// Only add protection to the host partition; invalid batches reject atomically.
export function protectEntitySpans(document,batch) {
  if(!validateDocument(document)||!batch||batch.snapshotId!==document.snapshotId||
     !Array.isArray(batch.spans)||batch.spans.length>LIMITS.regions)throw new TypeError('Invalid entity batch');
  const {text,snapshotId}=document;
  const ranges=batch.spans.map(s=>{
    const r=resolveSourceRange(text,s);
    if(r.start===r.end)throw new RangeError('Empty entity span');
    return r;
  }).sort((a,b)=>a.start-b.start||a.end-b.end);
  const merged=[];
  for(const r of ranges){const p=merged.at(-1);if(p&&r.start<=p.end)p.end=Math.max(p.end,r.end);else merged.push({start:r.start,end:r.end});}
  const regions=[];
  function emit(start,end,kind,language){
    if(start>=end)return;
    const p=regions.at(-1);
    if(p&&p.end===start&&kind==='protected'&&p.kind==='protected')p.end=end;
    else regions.push(kind==='protected'?{start,end,kind}:{start,end,kind,language});
  }
  let i=0;
  for(const region of document.regions){
    while(i<merged.length&&merged[i].end<=region.start)i++;
    if(region.kind==='protected'){emit(region.start,region.end,'protected');continue;}
    let cursor=region.start,j=i;
    while(j<merged.length&&merged[j].start<region.end){
      const a=Math.max(region.start,merged[j].start),z=Math.min(region.end,merged[j].end);
      emit(cursor,a,'prose',region.language);
      emit(a,z,'protected');cursor=z;j++;
    }
    emit(cursor,region.end,'prose',region.language);
  }
  const refined={text,snapshotId,regions};
  if(!validateDocument(refined))throw new RangeError('Refined map exceeds limits');
  return Object.freeze({...refined,regions:Object.freeze(regions.map(Object.freeze))});
}
