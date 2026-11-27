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

test('domain prior and repeat recovery are bounded, retain alternatives, and never override source evidence',()=>{
 const words=['تاخیر','تاخیری','تاسیسات','تاسسیسات','تاکید','بررسی','بریسی','استعلام','سفارش'];
 const p=createPersianLexiconProvider({words,preferredSpellings:[['تاخیر','تأخیر'],['تاسیسات','تأسیسات'],['تاکید','تأکید']],preferredWords:['تأخیر','تأسیسات','تأکید','بررسی','استعلام','سفارش','ناشناخته'],isKnownSource:w=>['استعلامم','سفارشش'].includes(w)});
 for(const [a,b] of [['تاخییر','تأخیر'],['تاسیسسات','تأسیسات'],['تاککیید','تأکید'],['برریسی','بررسی']]){
  const r=p.check(a,'fa');assert.equal(r[0]?.replacement,b,a);assert.ok(r.every(f=>f.original===a&&f.start===0&&f.end===a.length));
 }
 for(const word of ['تاخیری','بریسی','استعلامم','سفارشش','تاخیر','تأخیر'])assert.deepEqual(p.check(word,'fa'),[],word);
 assert.ok(p.check('ناشناختت','fa').every(f=>f.replacement!=='ناشناخته'));
 assert.throws(()=>createPersianLexiconProvider({words,preferredWords:['ABC123']}));
});

test('keyboard proximity and omitted repeated letters rank existing candidates, not arbitrary corrections',()=>{
 const p=createPersianLexiconProvider({words:['جمله','جمعه','جرقه','برنامه','برننه','پوییدی','پوسیدی'],isKnownSource:w=>w==='برنامه'});
 const a=p.check('جمقه','fa');assert.ok(a.some(f=>f.replacement==='جمله'));assert.ok(a.every(f=>f.original==='جمقه'));
 const q=createPersianLexiconProvider({words:['پوییدی','پوسیدی','پوشیدی']});
 assert.equal(q.check('پویدی','fa')[0]?.replacement,'پوییدی');
 assert.deepEqual(p.check('برنامه','fa'),[]);
 const z=createPersianLexiconProvider({words:['کلاه','کلام','کلاغ']});
 assert.deepEqual(z.check('کلاه','fa'),[]);
 assert.ok(z.check('کلاهک','fa').every(f=>['کلاه','کلام','کلاغ'].includes(f.replacement)));
});

test('context ranking changes ordering per occurrence without leaking across punctuation or cache',()=>{
 const words=['دانشگاه','دانشکده','بازدید','رئیس','کتابخانه'];
 const p=createPersianLexiconProvider({words,rankingCorpus:['بازدید دانشگاه','رئیس دانشکده']});
 const top=s=>p.check(s,'fa').filter(f=>f.original==='دانشکاه')[0]?.replacement;
 const neutral=top('دانشکاه');
 for(let i=0;i<50;i++){
  assert.equal(top('بازدید دانشکاه'),'دانشگاه');
  assert.equal(top('رئیس دانشکاه'),'دانشکده');
  assert.equal(top('بازدید. دانشکاه'),neutral);
  assert.equal(top('رئیس\nدانشکاه'),neutral);
  assert.equal(top('دانشکاه'),neutral);
 }
 assert.deepEqual(p.check('بازدید دانشگاه','fa'),[]);
 assert.deepEqual(p.check('رئیس دانشکده','fa'),[]);
 const r=p.check('بازدید دانشکاه. رئیس دانشکاه','fa');
 const starts=[...new Set(r.filter(f=>f.original==='دانشکاه').map(f=>f.start))];
 assert.equal(starts.length,2);
 assert.equal(r.find(f=>f.start===starts[0]).replacement,'دانشگاه');
 assert.equal(r.find(f=>f.start===starts[1]).replacement,'دانشکده');
});
test('frequency evidence is bounded and cannot add dictionary candidates or alter valid source',()=>{
 const words=['دانشگاه','دانشکده'];
 const p=createPersianLexiconProvider({words,wordFrequencies:[['دانشگاه',1000000],['دانشکده',1],['دانشکاه',999999]]});
 const r=p.check('دانشکاه','fa');
 assert.ok(r.length>0);assert.ok(r.every(f=>words.includes(f.replacement)));
 assert.deepEqual(p.check('دانشگاه','fa'),[]);
 assert.throws(()=>createPersianLexiconProvider({words,wordFrequencies:[['دانشگاه',-1]]}));
 assert.throws(()=>createPersianLexiconProvider({words,wordFrequencies:[['دانشگاه',1],['دانشگاه',2]]}));
 assert.throws(()=>createPersianLexiconProvider({words,rankingCorpus:['ABC 123']}));
 const q=createPersianLexiconProvider({words,isKnownSource:w=>w==='دانشکاه',rankingCorpus:['بازدید دانشگاه']});
 assert.deepEqual(q.check('دانشکاه','fa'),[]);
});
