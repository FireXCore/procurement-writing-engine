import test from 'node:test';
import assert from 'node:assert/strict';
import {orthographyEdits} from '../src/adapters/orthography-diff.mjs';
import {boundaries} from '../src/regions.mjs';
import {createEngine,normalizerAdapter} from '../src/index.mjs';
function verify(a,b){
 const edits=orthographyEdits(a,b),valid=boundaries(a);let cursor=0,reconstructed='';
 for(const e of edits){assert.ok(e.start>=cursor&&valid.has(e.start)&&valid.has(e.end));assert.equal(e.original,a.slice(e.start,e.end));reconstructed+=a.slice(cursor,e.start)+e.replacement;cursor=e.end;}
 assert.equal(reconstructed+a.slice(cursor),b);return edits;
}
test('two separated half-spaces are independent word-level patches',()=>{
 const edits=verify('پیشنهاد شما را بررسی می کنیم و نتیجه را اعلام می کنیم.','پیشنهاد شما را بررسی می‌کنیم و نتیجه را اعلام می‌کنیم.');
 assert.deepEqual(edits.map(e=>[e.original,e.replacement]),[['می کنیم','می‌کنیم'],['می کنیم.','می‌کنیم.']]);
});
test('adjacent Arabic glyph words are independent; punctuation and untouched words are preserved',()=>{
 const e=verify('لطفا قيمت كالا را اعلام كنيد.','لطفا قیمت کالا را اعلام کنید.');
 assert.deepEqual(e.map(x=>[x.original,x.replacement]),[['قيمت','قیمت'],['كالا','کالا'],['كنيد.','کنید.']]);
});
test('repeated words, whitespace, graphemes and unchanged lines reconstruct exactly',()=>{
 for(const [a,b] of [['فارسي فارسی فارسي','فارسی فارسی فارسی'],['فارسي\nكالا','فارسی\nکالا'],['  فارسي  ','  فارسی  '],['می نویسم و می نویسم','می‌نویسم و می‌نویسم'],['لطفاً','لطفاً'],['کالا 😀 فارسي','کالا 😀 فارسی'],['مي','می']])verify(a,b);
});
test('unsafe output rejects the full normalization rather than exposing a partial rewrite',async()=>{
 for(const target of ['قیمت ۱۲۳','قیمت <x>','قیمت\u202e','قیمت\nکالا']){
  const text='قيمت کالا',e=createEngine([normalizerAdapter(()=>target)]);
  const r=await e.analyze({text,snapshotId:'x',regions:[{start:0,end:text.length,kind:'prose',language:'fa'}]});
  assert.equal(r.status,'partial');assert.equal(r.findings.length,0);
 }
});
test('bounded input and number of edits; no unbounded matrix or output',()=>{
 assert.throws(()=>orthographyEdits('ک'.repeat(2001),'ک'));
 assert.throws(()=>orthographyEdits('ك '.repeat(101),'ک '.repeat(101)));
});
