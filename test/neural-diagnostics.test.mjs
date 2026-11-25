import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectGeneration,rejectionStage,firstCandidates} from '../demo/neural-diagnostics.mjs';
test('classifies generated response without repairing it',()=>{
  for(const [value,kind] of [['[]','empty-array'],['[{"original":"chek"}]','nonempty-array'],['\x60\x60\x60json\n[]\n\x60\x60\x60','non-json'],['{}','non-array'],['x'.repeat(8193),'invalid-size-or-unicode']]){
    const r=inspectGeneration([{generated_text:value}]);
    assert.equal(r.kind,kind);assert.ok(r.preview.length<=1200);
  }
  assert.equal(inspectGeneration([]).kind,'invalid-envelope');
  assert.equal(inspectGeneration([{generated_text:[{role:'assistant',content:'[]'}]}]).kind,'empty-array');
  assert.equal(inspectGeneration([{generated_text:'\u202eabc'}]).preview,'�abc');
});
test('distinguishes transport from downstream validator rejection',()=>{
  assert.equal(rejectionStage(null,false),'inference-or-template-error');
  assert.equal(rejectionStage({kind:'non-json'},true),'non-json');
  assert.equal(rejectionStage({kind:'nonempty-array'},true),'candidate-schema-anchor-or-safety-rejected');
});
test('baseline uses top-ranked candidate per issue',()=>{
  const p={start:0,end:4,provider:'harper',rule:'spell',category:'spelling',original:'chek'};
  assert.deepEqual(firstCandidates([{...p,replacement:'check'},{...p,replacement:'cheek'},{...p,start:5,end:6,rule:'advice'}]).map(f=>f.replacement),['check']);
});
