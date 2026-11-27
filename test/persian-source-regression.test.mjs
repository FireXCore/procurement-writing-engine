import test from 'node:test';
import assert from 'node:assert/strict';
import {createPersianLexiconProvider} from '../src/index.mjs';
test('short unknown words and source-only evidence never yield speculative corrections',()=>{
 const p=createPersianLexiconProvider({words:['فین','مشخصات','تجهیزات','دستگاه'],isKnownSource:w=>w==='دستگاهها'});
 assert.deepEqual(p.check('فنی','fa'),[]);
 assert.deepEqual(p.check('دستگاهها','fa'),[]);
 const r=p.check('مشخسات فنی تجیهزات','fa');
 assert.ok(r.some(f=>f.replacement==='مشخصات'));assert.ok(r.some(f=>f.replacement==='تجهیزات'));assert.ok(r.every(f=>f.original!=='فنی'));
});

test('approved hamza variants improve typo candidates without rewriting valid forms',()=>{
 const p=createPersianLexiconProvider({words:['تایید','تامین','تاخیر'],preferredSpellings:[['تایید','تأیید'],['تامین','تأمین'],['تاخیر','تأخیر']]});
 for(const [a,b,c] of [['تاییید','تأیید','تایید'],['تاممین','تأمین','تامین'],['تاخییر','تأخیر','تاخیر']]){
  const r=p.check(a,'fa');assert.equal(r[0]?.replacement,b);
  assert.ok(r.some(f=>f.replacement===c));assert.ok(r.every(f=>f.original===a));
  assert.deepEqual(p.check(b,'fa'),[]);assert.deepEqual(p.check(c,'fa'),[]);
 }
 assert.throws(()=>createPersianLexiconProvider({words:['تایید'],preferredSpellings:[['تایید','لغو']]}));
 assert.throws(()=>createPersianLexiconProvider({words:['تایید'],preferredSpellings:[['تایید','تأیید'],['تأیید','تایید']]}));
 const q=createPersianLexiconProvider({words:['مشخصات'],preferredSpellings:[['تایید','تأیید']]});
 assert.deepEqual(q.check('تاییید','fa'),[]);
});
