import test from 'node:test';
import assert from 'node:assert/strict';
import {extractSentenceEdits,createSentenceProvider} from '../demo/neural-sentence.mjs';
test('sentence protocol derives exact source anchors without JSON',()=>{
  for(const [source,target,lang,pairs] of [
    ['Please chek the quotation.','Please check the quotation.','en',[['chek','check']]],
    ['The information are incomplete.','The information is incomplete.','en',[['are','is']]],
    ['لطفا مشخصات فنی را مجددا ارسال کنید.','لطفاً مشخصات فنی را مجدداً ارسال کنید.','fa',[['لطفا','لطفاً'],['مجددا','مجدداً']]],
    ['The quotation is not approved.','The quotation is not approved.','en',[]],
    ['Please chek and chek.','Please check and check.','en',[['chek','check'],['chek','check']]]
  ]){
    const r=extractSentenceEdits(source,target,lang);
    assert.deepEqual(r.map(x=>[x.original,x.replacement]),pairs);
    assert.ok(r.every(x=>source.slice(x.start,x.end)===x.original));
  }
});
test('sentence protocol rejects rewrites, names, negation and punctuation',()=>{
  for(const [a,b,l] of [
    ['The quotation is not approved.','The quotation is approved.','en'],
    ['The quotation is not approved.','The quotation is now approved.','en'],
    ['Please chek the offer.','Please check the offer!','en'],
    ['Please chek the offer.','Please  check the offer.','en'],
    ['Please chek the offer.','Please check the offer. Explanation','en'],
    ['Please contact Rotork.','Please contact Rotor.','en'],
    ['Please chek.','Please check.\n','en'],
    ['Please chek.','Please check ABC123.','en'],
    ['The offer is approved.','The offer is rejected.','en'],
    ['لطفا ارسال نکنید.','لطفاً ارسال کنید.','fa']
  ])assert.throws(()=>extractSentenceEdits(a,b,l),undefined,a+' => '+b);
});
test('sentence provider retains contextual guard',async()=>{
 const p=createSentenceProvider({generator:async()=> 'Please check the quotation.'});
 const r=await p.check('Please chek the quotation.','en');
 assert.equal(r.length,1);assert.equal(r[0].replacement,'check');
 const bad=createSentenceProvider({generator:async()=> 'Please check the quotation!'});
 await assert.rejects(()=>bad.check('Please chek the quotation.','en'));
});
