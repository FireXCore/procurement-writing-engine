import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDemoSnapshot} from '../demo/regions.mjs';
import {createEngine} from '../src/index.mjs';
import {validateDocument} from '../src/regions.mjs';
import {cases,locked} from './acceptance-fixtures.mjs';

for(const c of cases)test('demo region map: '+c.id,async()=>{
 const p=buildDemoSnapshot(c.text,locked,c.id);
 assert.ok(validateDocument(p.document));assert.deepEqual(p.languages,[c.language]);assert.equal(p.skipped,0);
 const protectedText=p.document.regions.filter(x=>x.kind==='protected').map(x=>p.document.text.slice(x.start,x.end));
 for(const token of c.protected??[])assert.ok(protectedText.some(s=>s.includes(token)),token);
 assert.ok(protectedText.some(s=>s.includes(locked)));
 const calls=[];
 const engine=createEngine([{id:'fixture',languages:['en','fa'],check:(text,lang)=>{calls.push({text,lang});return [];}}]);
 const result=await engine.analyze(p.document);assert.equal(result.status,'complete');assert.equal(result.apply,false);
 for(const {text,lang} of calls){assert.equal(lang,c.language);for(const token of [...(c.protected??[]),locked])assert.ok(!text.includes(token));}
});
test('unknown technical and mixed-script input remain unreviewed',()=>{
 for(const text of ['Please send teh quote for ABC999.','نامه ۱۲۳','سلام valve','please see api/v1','hello\u202Eworld']){
  const p=buildDemoSnapshot(text,locked,'unknown');assert.equal(p.skipped,1,text);assert.deepEqual(p.languages,[]);assert.ok(p.document.regions.every(x=>x.kind==='protected'));
 }
});
test('known ranges do not authorize an unsafe surrounding gap',()=>{
 const p=buildDemoSnapshot('Unknown ABC999 Rosemount 3051, please send teh quote.',locked,'unknown-gap');
 assert.equal(p.skipped,1);assert.ok(p.document.regions.some(x=>x.kind==='prose'));assert.ok(p.document.regions.filter(x=>x.kind==='protected').some(x=>p.document.text.slice(x.start,x.end).includes('ABC999')));
});
test('malformed or unaligned input remains fail closed',()=>{
 assert.throws(()=>buildDemoSnapshot('\ud800',locked,'bad'));
 const p=buildDemoSnapshot('hello\r',locked,'cr');assert.equal(p.skipped,1);assert.deepEqual(p.languages,[]);assert.ok(validateDocument(p.document));
});
