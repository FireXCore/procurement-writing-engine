import { LIMITS, boundaries, validRange, validReplacement } from '../regions.mjs';

// Align exact unchanged words, not guessed linguistic rules. Bounded matrix.
const MAX_CELLS=1_000_000;
const words=text=>Array.from(text.matchAll(/\S+/gu),m=>({text:m[0],start:m.index,end:m.index+m[0].length}));

export function orthographyEdits(source,target){
  if(typeof source!=='string'||typeof target!=='string'||!source.isWellFormed()||!target.isWellFormed()||
    source.length>LIMITS.region||target.length>LIMITS.region*2)throw new Error('Invalid orthography input');
  if(source===target)return [];
  const a=words(source),b=words(target),stride=b.length+1,cells=(a.length+1)*stride;
  if(cells>MAX_CELLS)throw new Error('Orthography alignment budget exceeded');
  const matrix=new Uint16Array(cells);
  for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--){
    matrix[i*stride+j]=a[i].text===b[j].text?1+matrix[(i+1)*stride+j+1]:
      Math.max(matrix[(i+1)*stride+j],matrix[i*stride+j+1]);
  }
  const edits=[],sourceBoundaries=boundaries(source),targetBoundaries=boundaries(target);
  function add(start,end,bs,be){
    const original=source.slice(start,end),replacement=target.slice(bs,be);
    if(original===replacement)return;
    if(!validRange(source,start,end,sourceBoundaries)||!validRange(target,bs,be,targetBoundaries)||
      (start===end&&(start===0||start===source.length))||!validReplacement(original,replacement,'fa')||
      edits.length>=LIMITS.providerFindings)throw new Error('Unsafe or excessive orthography edits');
    edits.push({start,end,original,replacement});
  }
  function gap(start,end,bs,be){
    const left=source.slice(start,end),right=target.slice(bs,be);
    if(left===right)return;
    const x=words(left),y=words(right);
    // Equal word counts and identical separators permit individual word patches.
    if(x.length&&x.length===y.length){
      let prev=0,next=0,aligned=true;
      for(let k=0;k<x.length;k++){
        if(left.slice(prev,x[k].start)!==right.slice(next,y[k].start)){aligned=false;break;}
        prev=x[k].end;next=y[k].end;
      }
      if(aligned&&left.slice(prev)===right.slice(next)){
        for(let k=0;k<x.length;k++)add(start+x[k].start,start+x[k].end,bs+y[k].start,bs+y[k].end);
        return;
      }
    }
    // Merged/split words stay together; exclude identical outer whitespace.
    const prefix=left.match(/^\s+/u)?.[0]??'',otherPrefix=right.match(/^\s+/u)?.[0]??'';
    if(prefix===otherPrefix){start+=prefix.length;bs+=prefix.length;}
    const suffix=source.slice(start,end).match(/\s+$/u)?.[0]??'',otherSuffix=target.slice(bs,be).match(/\s+$/u)?.[0]??'';
    if(suffix===otherSuffix){end-=suffix.length;be-=suffix.length;}
    add(start,end,bs,be);
  }
  let i=0,j=0,sourceEnd=0,targetEnd=0;
  while(i<a.length&&j<b.length){
    if(a[i].text===b[j].text){
      gap(sourceEnd,a[i].start,targetEnd,b[j].start);
      sourceEnd=a[i++].end;targetEnd=b[j++].end;
    }else if(matrix[(i+1)*stride+j]>=matrix[i*stride+j+1])i++;
    else j++;
  }
  gap(sourceEnd,source.length,targetEnd,target.length);
  let rebuilt='',cursor=0;
  for(const edit of edits){
    if(edit.start<cursor)throw new Error('Overlapping orthography edits');
    rebuilt+=source.slice(cursor,edit.start)+edit.replacement;cursor=edit.end;
  }
  if(rebuilt+source.slice(cursor)!==target)throw new Error('Orthography reconstruction mismatch');
  return edits;
}
