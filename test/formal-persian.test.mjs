import test from 'node:test';
import assert from 'node:assert/strict';
import {formalPersianOrthography} from '../src/adapters/formal-persian.mjs';
import {normalizerAdapter,createEngine} from '../src/index.mjs';
test('formal Persian policy adds tanwin only to reviewed complete words',()=>{
 const words=['لطفا','حتما','قطعا','واقعا','تقریبا','فورا','قبلا','بعدا','موقتا','رسما','صرفا','مستقیما','ترجیحا','ضمنا'];
 for(const word of words){assert.equal(formalPersianOrthography(word),word+'\u064b');assert.equal(formalPersianOrthography(word+'\u064b'),word+'\u064b');}
 assert.equal(formalPersianOrthography('لطفا، حتما و قبلا.'),'لطفاً، حتماً و قبلاً.');
 assert.equal(formalPersianOrthography('اینجا شما کالا فردا امضا رضا زیبا لطفاً لطفًا لطفاها لطفا‌نامه'), 'اینجا شما کالا فردا امضا رضا زیبا لطفاً لطفًا لطفاها لطفا‌نامه');
});
test('formal policy is idempotent and preserves whitespace and other marks',()=>{
 const text='لطفا\nکالا\tحتما، لطفاً و لُطفا';
 const result=formalPersianOrthography(text);
 assert.equal(result,'لطفاً\nکالا\tحتماً، لطفاً و لُطفا');
 assert.equal(formalPersianOrthography(result),result);
});
test('formal policy remains review-only and does not reach protected ranges',async()=>{
 const text='لطفا ارسال کنید. لطفا',start=text.lastIndexOf('لطفا');
 const calls=[];
 const p=normalizerAdapter(s=>{calls.push(s);return formalPersianOrthography(s);});
 const r=await createEngine([p]).analyze({text,snapshotId:'formal',regions:[{start:0,end:start,kind:'prose',language:'fa'},{start,end:text.length,kind:'protected'}]});
 assert.equal(r.status,'complete');assert.equal(r.apply,false);
 assert.deepEqual(calls,[text.slice(0,start)]);
 assert.equal(r.findings.length,1);assert.equal(r.findings[0].original,'لطفا');assert.equal(r.findings[0].replacement,'لطفاً');
});

test('formal procurement compound is bounded and idempotent',()=>{
 assert.equal(formalPersianOrthography('ترجیحا پیش فاکتور؛ ضمنا پیش‌فاکتور'),'ترجیحاً پیش‌فاکتور؛ ضمناً پیش‌فاکتور');
 assert.equal(formalPersianOrthography('پیش فاکتورها و پیش‌فاکتور'),'پیش فاکتورها و پیش‌فاکتور');
});
