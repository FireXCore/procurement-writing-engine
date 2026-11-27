import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import dictionary from 'dictionary-fa';
import nspell from 'nspell';
import {prepareLilakDictionary,createLilakProvider} from '../../src/index.mjs';
import {validReplacement,eligible} from '../../src/regions.mjs';
import {parseFaSpell,summarizeCases} from './evaluation.mjs';

const require=createRequire(import.meta.url);
assert.equal(require('nspell/package.json').version,'2.1.5');
assert.equal(require('is-buffer/package.json').version,'2.0.5');
const manifest=JSON.parse(readFileSync(new URL('./sources.json',import.meta.url),'utf8'));
const input=process.argv[2];if(!input)throw new Error('Explicit evaluation input directory required');
const dict=prepareLilakDictionary(dictionary.dic.toString('utf8'),dictionary.aff.toString('utf8'));
const start=performance.now(),pwe=createLilakProvider(dict),pweSetupMs=performance.now()-start;
const nsStart=performance.now(),ns=nspell(dictionary),nspellSetupMs=performance.now()-nsStart;
function pweReview(source){
 if(!eligible(source,'fa'))return {candidates:[],partial:true};
 try{
  const findings=pwe.check(source,'fa');
  assert.ok(findings.every(f=>f.start===0&&f.end===source.length&&f.original===source&&validReplacement(source,f.replacement,'fa')));
  return {candidates:[...new Set(findings.map(f=>f.replacement))].slice(0,4),partial:false};
 }catch(error){if(error instanceof RangeError)return {candidates:[],partial:true};throw error;}
}
function nspellReview(source){
 if(!eligible(source,'fa'))return {candidates:[],partial:true};
 if(ns.correct(source))return {candidates:[],partial:false};
 // Evaluation only. Never expose unchecked suggestions as PWE findings.
 const candidates=[...new Set(ns.suggest(source))].filter(x=>typeof x==='string'&&/^[آابتثجحخدذرزژسشصضطظعغفقکگلمنوهیپچئءؤأإ]{1,24}$/u.test(x)&&validReplacement(source,x,'fa')&&ns.correct(x)).slice(0,4);
 return {candidates,partial:false};
}
const report={schema:1,source:manifest.source,attribution:manifest.attribution,license:manifest.license,kind:'evaluation-only; isolated word pairs, not sentence grammar or overall accuracy',versions:{dictionary:'2.0.0',nspell:'2.1.5',isBuffer:'2.0.5',node:process.version,commit:process.env.GITHUB_SHA??null},setupMs:{pwe:pweSetupMs,nspell:nspellSetupMs},datasets:{}};
for(const f of manifest.files){
 const raw=readFileSync(resolve(input,f.id+'.txt'));
 assert.equal(raw.length,f.bytes);
 assert.equal(createHash('sha256').update(raw).digest('hex'),f.sha256);
 const data=parseFaSpell(new TextDecoder('utf-8',{fatal:true}).decode(raw),f.rows);
 report.datasets[f.id]={sha256:f.sha256,selection:data.counts,pwe:summarizeCases(data.cases,pweReview),nspell:summarizeCases(data.cases,nspellReview)};
 console.log('PWE_FASPELL '+JSON.stringify({dataset:f.id,...report.datasets[f.id]}));
}
mkdirSync('qualification-artifacts',{recursive:true});writeFileSync('qualification-artifacts/faspell-comparison.json',JSON.stringify(report,null,2));
// Diagnostic only. No promotion based on this single benchmark.
