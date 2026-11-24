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
 for(const text of ['Please send teh quote for abc999.','نامه ۱۲۳','سلام valve','please see api/v1','hello\u202Eworld']){
  const p=buildDemoSnapshot(text,locked,'unknown');assert.equal(p.skipped,1,text);assert.deepEqual(p.languages,[]);assert.ok(p.document.regions.every(x=>x.kind==='protected'));
 }
});
test('known ranges do not authorize an unsafe surrounding gap',()=>{
 const p=buildDemoSnapshot('Unknown API#999 Rosemount 3051, please send teh quote.',locked,'unknown-gap');
 assert.equal(p.skipped,1);assert.ok(p.document.regions.some(x=>x.kind==='prose'));assert.ok(p.document.regions.filter(x=>x.kind==='protected').some(x=>p.document.text.slice(x.start,x.end).includes('API#999')));
});
test('malformed or unaligned input remains fail closed',()=>{
 assert.throws(()=>buildDemoSnapshot('\ud800',locked,'bad'));
 const p=buildDemoSnapshot('hello\r',locked,'cr');assert.equal(p.skipped,1);assert.deepEqual(p.languages,[]);assert.ok(validateDocument(p.document));
});

test('isolated inferred identifier protects exactly its span and admits surrounding prose',()=>{
 for(const id of ['ABC999','AB-123','7MF4433-1DA22-2AB1','A1/B2']){
  const p=buildDemoSnapshot('Please send teh quote for '+id+'.',locked,'id');
  assert.equal(p.inferredProtected,1);assert.equal(p.inlineProtected,1);assert.equal(p.skipped,0);assert.deepEqual(p.languages,['en']);
  assert.ok(p.document.regions.some(r=>r.kind==='protected'&&p.document.text.slice(r.start,r.end)===id));
  assert.ok(p.document.regions.some(r=>r.kind==='prose'&&p.document.text.slice(r.start,r.end).includes('teh')));
 }
});
test('ambiguous identifiers and mixed scripts still fail closed',()=>{
 for(const input of ['Please send teh quote for abc999.','Please send teh quote for xABC999.','Please send teh quote for ABC999@example.com.','Please send teh quote for ABC999_XX.','لطفا ABC999نام را بررسی کنید.']){
  const p=buildDemoSnapshot(input,locked,'ambiguous');assert.equal(p.skipped,1,input);assert.equal(p.inferredProtected,0,input);assert.deepEqual(p.languages,[],input);
 }
});
