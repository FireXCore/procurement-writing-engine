import test from 'node:test';
import assert from 'node:assert/strict';
import {corpus,models,scoreCase} from '../demo/neural-fixtures.mjs';
import {eligible} from '../src/regions.mjs';
test('fixed neural corpus is eligible and model revisions are pinned',()=>{
  assert.equal(corpus.length,5);
  assert.equal(corpus.reduce((n,c)=>n+c.expected.length,0),4);
  assert.ok(corpus.every(c=>eligible(c.text,c.language)));
  assert.ok(Object.values(models).every(m=>/^[a-f0-9]{40}$/u.test(m.revision)));
});
test('exact edit score separates misses and unexpected output',()=>{
  assert.deepEqual(scoreCase(corpus[0],[{original:'chek',replacement:'check'}]),{matched:1,missing:0,unexpected:0});
  assert.deepEqual(scoreCase(corpus[0],[]),{matched:0,missing:1,unexpected:0});
  assert.deepEqual(scoreCase(corpus[2],[{original:'approved',replacement:'accepted'}]),{matched:0,missing:0,unexpected:1});
});
