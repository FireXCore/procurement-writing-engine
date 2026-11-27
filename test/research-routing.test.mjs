import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResearchSnapshot } from '../benchmarks/routing-v2.mjs';
import { runChallenge } from '../benchmarks/challenge-routing.mjs';
import { runRoutingBenchmark } from '../benchmarks/routing.mjs';
import { eligible, validateDocument } from '../src/regions.mjs';

test('research challenge preserves structural invariants and intentionally abstains on bidi controls',()=>{
  const results=runChallenge();
  assert.equal(results.length,22);
  assert.ok(results.every(x=>x.valid));
  assert.equal(results.find(x=>x.id==='bidi-control').pass,true);
});
test('explicit host literals protect previously unseen names without changing source',()=>{
  const input='Please chek the Bürkert quotation. لطفا با شرکت نمونه صنعت تماس بگیرید.';
  const names=['Bürkert','شرکت نمونه صنعت'], locked='LOCKED 9876';
  const p=buildResearchSnapshot(input,locked,'host-names',{hostLiterals:names});
  assert.ok(validateDocument(p.document));
  assert.equal(p.document.text,input+'\n'+locked);
  const prose=p.document.regions.filter(r=>r.kind==='prose');
  for(const name of names){const start=input.indexOf(name);assert.ok(!prose.some(r=>r.start<start+name.length&&r.end>start));}
  for(const [lang,typo] of [['en','chek'],['fa','لطفا']]){const start=input.indexOf(typo);assert.ok(prose.some(r=>r.language===lang&&r.start<=start&&r.end>=start+typo.length));}
  assert.ok(prose.every(r=>r.end<=input.length&&eligible(p.document.text.slice(r.start,r.end),r.language)));
});
test('research synthetic corpus keeps every typo routed with no structural violations',()=>{
 const r=runRoutingBenchmark(buildResearchSnapshot).total;
 assert.equal(r.cases,10200);
 assert.equal(r.routed,r.cases);
 assert.equal(r.invalidPartitions+r.unsafeProse+r.lockedLeak,0);
});
