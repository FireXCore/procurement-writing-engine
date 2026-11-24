import test from 'node:test';
import assert from 'node:assert/strict';
import {rankSpellingAlternatives} from '../src/adapters/procurement-ranking.mjs';
test('contextual ranking is deterministic and does not generate candidates',()=>{
 for(const [source,original,alternatives,expected] of [
 ['Please provde ', 'provde',['prove','provide','proved'],'provide'],
 ['We have recieved your qoutation.','recieved',['relieved','received','receive'],'received'],
 ['We will proced with the review.','proced',['priced','probed','proceed'],'proceed'],
 ['Please pruve that the claim is valid.','pruve',['provide','prove'],'prove'],
 ['They request teh material.','teh',['ten','the'],'ten']
 ]){
 const start=source.indexOf(original),end=start+original.length;
 const input=alternatives.map(replacement=>({start,end,replacement}));
 const output=rankSpellingAlternatives(input,source);
 assert.equal(output[0].replacement,expected);
 assert.deepEqual(output.map(x=>x.replacement).sort(),[...alternatives].sort());
 assert.deepEqual(input.map(x=>x.replacement),alternatives);
 }
});
