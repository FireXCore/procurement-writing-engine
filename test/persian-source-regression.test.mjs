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
