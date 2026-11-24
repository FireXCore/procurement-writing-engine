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
  const f=r.findings[0], result=text.slice(0,f.start)+f.replacement+text.slice(f.end);
  assert.ok(result.includes('فارسی')&&result.includes('کمی'));
});
test('real textlint kernel + plaintext plugin + procurement delivery advisory',async()=>{
  const p=await createTextlint([procurementDeliveryRule]);
  const r=await createEngine([p]).analyze(snap('Please send as soon as possible.','en'));
  assert.equal(r.status,'complete');
  assert.ok(r.findings.some(x=>x.original==='as soon as possible'&&x.replacement===undefined));
});
