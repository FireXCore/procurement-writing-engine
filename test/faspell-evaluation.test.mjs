import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFaSpell,summarizeCases} from '../lab/faspell/evaluation.mjs';
test('FAspell parser preserves denominators, deduplicates and records exclusions',()=>{
 const input='\uFEFF#misspelt\tcorrected\terror-category\nمشخسات\tمشخصات\t1\nمشخسات\tمشخصات\t1\nفنی\tفنی\t2\nكالا\tکالا\t2\nپیش فاکتور\tپیش‌فاکتور\t3\nabc\tکالا\t4\n';
 const r=parseFaSpell(input,6);
 assert.deepEqual(r.counts,{rows:6,unchanged:1,normalizedEqual:1,boundary:1,unsupported:1,duplicates:1,eligible:1});
 assert.deepEqual(r.cases,[{source:'مشخسات',target:'مشخصات'}]);
 assert.throws(()=>parseFaSpell(input,5));
 assert.throws(()=>parseFaSpell('#misspelt\tcorrected\nمشخسات\n',1));
 assert.throws(()=>parseFaSpell('a\tb\nc\td',1));
});
test('FAspell metrics distinguish recall, abstention, control edits and incomplete results',()=>{
 const rows=[{source:'الف',target:'کتاب'},{source:'ببب',target:'قلم'},{source:'ججج',target:'دفتر'}];
 const r=summarizeCases(rows,w=>({candidates:w==='الف'?['کتاب']:w==='ببب'?['مداد','قلم']:w==='قلم'?['قدم']:[],partial:w==='ججج'}));
 assert.equal(r.pairs,3);assert.equal(r.top1,1);assert.equal(r.top4,2);assert.equal(r.abstained,1);assert.equal(r.correctWithSuggestion,1);assert.equal(r.pairedSuccess,1);assert.equal(r.partial,1);
});
