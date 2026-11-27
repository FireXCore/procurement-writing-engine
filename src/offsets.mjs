import { boundaries, validRange, LIMITS } from './regions.mjs';

// All offsets are half-open and refer to exact original source, not normalized text.
export function resolveSourceRange(source,span) {
  if(typeof source!=='string'||!source.isWellFormed()||source.length>LIMITS.text||
     !span||!Number.isSafeInteger(span.start)||!Number.isSafeInteger(span.end)||
     span.start<0||span.end<span.start||typeof span.original!=='string'||
     !['utf16','codepoint','utf8'].includes(span.unit))throw new TypeError('Invalid source span');
  let start=span.start,end=span.end;
  if(span.unit!=='utf16'){
    let units=0,pos=0,a=-1,z=-1;
    for(const cp of source){
      if(units===start)a=pos;
      if(units===end)z=pos;
      const n=cp.codePointAt(0);
      units+=span.unit==='codepoint'?1:n<0x80?1:n<0x800?2:n<0x10000?3:4;
      pos+=cp.length;
      if(units>end)break;
    }
    if(units===start)a=pos;
    if(units===end)z=pos;
    start=a;end=z;
  }
  if(!validRange(source,start,end,boundaries(source))||source.slice(start,end)!==span.original)
    throw new RangeError('Source span mismatch');
  return Object.freeze({start,end,original:span.original});
}
