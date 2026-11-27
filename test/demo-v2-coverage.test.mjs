import test from 'node:test';
import assert from 'node:assert/strict';
import {buildResearchSnapshot} from '../demo/routing-v2.mjs';
import {runChallenge} from '../benchmarks/challenge-routing.mjs';
import {validateDocument,eligible} from '../src/regions.mjs';

const cases=[
  {
    "input": "Please chek the WIKA quotation.",
    "name": "WIKA",
    "typo": "chek",
    "language": "en"
  },
  {
    "input": "Please chek the Rotork offer.",
    "name": "Rotork",
    "typo": "chek",
    "language": "en"
  },
  {
    "input": "Please chek the Emerson Electric quotation.",
    "name": "Emerson Electric",
    "typo": "chek",
    "language": "en"
  },
  {
    "input": "لطفا قیمت Swagelok را اعلام کنید.",
    "name": "Swagelok",
    "typo": "لطفا",
    "language": "fa"
  },
  {
    "input": "Please chek the quote for 45 N·m and 8 m³/h.",
    "name": "45 N·m",
    "typo": "chek",
    "language": "en"
  },
  {
    "input": "لطفا مبلغ ۳۵ میلیون ریال را اعلام کنید.",
    "name": "۳۵ میلیون ریال",
    "typo": "لطفا",
    "language": "fa"
  },
  {
    "input": "Please chek the quotation.",
    "name": null,
    "typo": "chek",
    "language": "en"
  },
  {
    "input": "Please send the Commerical Offer.",
    "name": null,
    "typo": "Commerical",
    "language": "en"
  }
];
test('demo candidate-name quarantine without host catalog, and exact coverage accounting',()=>{
 for(const c of cases){
  const p=buildResearchSnapshot(c.input,'LOCKED 9876','new');
  const prose=p.document.regions.filter(r=>r.kind==='prose');
  assert.ok(validateDocument(p.document));
  assert.ok(prose.every(r=>r.end<=c.input.length&&eligible(p.document.text.slice(r.start,r.end),r.language)));
  const t=c.input.indexOf(c.typo);assert.ok(prose.some(r=>r.language===c.language&&r.start<=t&&r.end>=t+c.typo.length),c.input);
  if(c.name){const a=c.input.indexOf(c.name);assert.ok(!prose.some(r=>r.start<a+c.name.length&&r.end>a),c.name);}
  const {total,reviewable,recognized,suspected,unreviewed}=p.coverage;
  assert.equal(total,c.input.replace(/\s/gu,'').length);assert.equal(total,reviewable+recognized+suspected+unreviewed);assert.equal(reviewable,p.reviewedUnits);
 }
});
test('demo preserves structural invariants on previous challenge set',()=>{
 const result=runChallenge(buildResearchSnapshot);assert.ok(result.every(x=>x.valid));assert.ok(result.filter(x=>x.pass).length>=22);
});
test('bidi abstention counts all source units as unreviewed, never recognized',()=>{
 const input='Please chek ABC\u202e123.',p=buildResearchSnapshot(input,'LOCKED','bidi');
 assert.equal(p.coverage.total,p.coverage.unreviewed);assert.equal(p.coverage.recognized,0);assert.equal(p.reviewedUnits,0);assert.deepEqual(p.languages,[]);
});
