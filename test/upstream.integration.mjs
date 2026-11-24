// Deliberately not part of the dependency-free contract suite.
// This test fails, rather than silently skipping, if any required upstream package is missing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, createHarper, createVirastar, createTextlint, procurementDeliveryRule } from '../src/index.mjs';
const snap=(text,language)=>({text,snapshotId:'synthetic:upstream',regions:[{start:0,end:text.length,kind:'prose',language}]});
test('real Harper WASM: English grammar and original offsets', {timeout:30000}, async()=>{
  const {binaryInlined}=await import('harper.js/binaryInlined');
  const harper=await createHarper({binary:binaryInlined,worker:false});
  try {
    const text='This is teh quotation.';
    const r=await createEngine([harper.provider]).analyze(snap(text,'en'));
    assert.ok(['complete','partial'].includes(r.status));
    assert.ok(r.findings.some(f=>f.original==='teh'&&f.replacement==='the'));
    for(const f of r.findings)assert.equal(text.slice(f.start,f.end),f.original);
  } finally {await harper.dispose();}
});
test('real Virastar: Persian characters and half-space',async()=>{
  const p=await createVirastar();
  const text='فارسي را كمی درست تر می نويسيم';
  const r=await createEngine([p]).analyze(snap(text,'fa'));
  assert.equal(r.status,'complete');
  assert.ok(r.findings.length);
  let result=text;
  for(const f of [...r.findings].sort((a,b)=>b.start-a.start))result=result.slice(0,f.start)+f.replacement+result.slice(f.end);
  assert.ok(result.includes('فارسی')&&result.includes('کمی'));
});
test('real textlint kernel + plaintext plugin + procurement delivery advisory',async()=>{
  const p=await createTextlint([procurementDeliveryRule]);
  const r=await createEngine([p]).analyze(snap('Please send as soon as possible.','en'));
  assert.equal(r.status,'complete');
  assert.ok(r.findings.some(x=>x.original==='as soon as possible'&&x.replacement===undefined));
});

import { procurementPolicyRules, procurementAgreementRule } from '../src/index.mjs';
import { buildDemoSnapshot } from '../demo/regions.mjs';
import { cases, locked, extendedCases } from './acceptance-fixtures.mjs';

test('real engines: all human acceptance examples and source protection', {timeout:120000}, async t=>{
  const {binaryInlined}=await import('harper.js/binaryInlined');
  const harper=await createHarper({binary:binaryInlined,worker:false});
  try{
    const virastar=await createVirastar(),policy=await createTextlint(procurementPolicyRules);
    for(const c of cases)await t.test(c.id,async()=>{
      const p=buildDemoSnapshot(c.text,locked,c.id);
      assert.deepEqual(p.languages,[c.language]);assert.equal(p.skipped,0);
      const calls=[];
      const providers=(c.language==='fa'?[virastar]:[harper.provider,policy]).map(provider=>({...provider,check:(text,lang,signal)=>{calls.push(text);return provider.check(text,lang,signal);}}));
      const result=await createEngine(providers).analyze(p.document);
      assert.ok(['complete','partial'].includes(result.status),JSON.stringify(result.diagnostics));
      assert.equal(result.apply,false);
      for(const text of calls)for(const token of [...(c.protected??[]),locked])assert.ok(!text.includes(token));
      for(const finding of result.findings){
        assert.equal(p.document.text.slice(finding.start,finding.end),finding.original);
        assert.ok(p.document.regions.some(r=>r.kind==='prose'&&finding.start>=r.start&&finding.end<=r.end));
      }
      for(const [original,replacement] of c.pairs??[])assert.ok(result.findings.some(f=>f.original===original&&f.replacement===replacement),JSON.stringify(result));
      if(c.first)assert.equal(result.findings.find(f=>f.original===c.first[0])?.replacement,c.first[1]);
      if(c.message)assert.ok(result.findings.some(f=>f.message.includes(c.message)&&f.replacement===undefined));
      if(c.clean){assert.equal(result.status,'complete');assert.equal(result.findings.length,0,JSON.stringify(result));}
      if(c.expectedText){
        let actual=c.text;
        const fixes=result.findings.filter(f=>f.replacement!==undefined).sort((a,b)=>b.start-a.start);
        assert.ok(fixes.length,JSON.stringify(result));
        for(const f of fixes)actual=actual.slice(0,f.start)+f.replacement+actual.slice(f.end);
        assert.equal(actual,c.expectedText);
        if(c.id==='fa-halfspace'){assert.equal(fixes.length,2);assert.ok(fixes.every(f=>f.original.includes('می کنیم')&&f.replacement.includes('می‌کنیم')&&f.original.length<=8));}
      }
    });
  }finally{await harper.dispose();}
});
test('real Textlint limited agreement policy has no false positives on reviewed controls',async()=>{
 const p=await createTextlint([procurementAgreementRule]);
 for(const text of ['The suppliers have confirmed the quotation.','The goods are available.','The supplier has confirmed the quotation.','Please ask the supplier to have confirmed the quote.','The phrase "the supplier have confirmed" is quoted.']){
  const r=await createEngine([p]).analyze(snap(text,'en'));assert.equal(r.status,'complete');assert.deepEqual(r.findings,[],text);
 }
});

test('real engines: mixed languages, lower-case identifiers and contextual first choice',{timeout:120000},async t=>{
 const {binaryInlined}=await import('harper.js/binaryInlined');
 const harper=await createHarper({binary:binaryInlined,worker:false});
 try{
  const virastar=await createVirastar(),policy=await createTextlint(procurementPolicyRules);
  for(const c of extendedCases)await t.test(c.id,async()=>{
   const p=buildDemoSnapshot(c.text,locked,c.id);assert.deepEqual(p.languages,c.languages);
   const calls=[];
   const providers=[harper.provider,virastar,policy].map(provider=>({...provider,check:(text,lang,signal)=>{calls.push(text);return provider.check(text,lang,signal);}}));
   const report=await createEngine(providers).analyze(p.document);
   assert.equal(report.apply,false);assert.ok(['complete','partial'].includes(report.status));
   for(const text of calls)for(const token of [...(c.protected??[]),locked])assert.ok(!text.includes(token),token);
   for(const [original,replacement] of c.pairs)assert.ok(report.findings.some(f=>f.original===original&&f.replacement===replacement),JSON.stringify(report));
   if(c.first)assert.equal(report.findings.find(f=>f.original===c.first[0])?.replacement,c.first[1]);
   if(c.clean){assert.equal(report.status,'complete');assert.equal(report.findings.length,0);}
  });
 }finally{await harper.dispose();}
});
