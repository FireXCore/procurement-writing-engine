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
import {createCascade} from './cascade.mjs';
import {unpackDictionaryEvidence} from '../../src/lilak-dictionary.mjs';
import {formalSpellings} from '../../src/persian-procurement-profile.mjs';

const require=createRequire(import.meta.url);
assert.equal(require('nspell/package.json').version,'2.1.5');
assert.equal(require('is-buffer/package.json').version,'2.0.5');
const manifest=JSON.parse(readFileSync(new URL('./sources.json',import.meta.url),'utf8'));
const input=process.argv[2];if(!input)throw new Error('Explicit evaluation input directory required');
const dict=prepareLilakDictionary(dictionary.dic.toString('utf8'),dictionary.aff.toString('utf8'));
const start=performance.now(),pwe=createLilakProvider(dict),pweSetupMs=performance.now()-start;
const frequencyPath=process.argv[3];
const fullFrequencyPath=process.argv[4];
const frequencyAsset=frequencyPath?JSON.parse(readFileSync(frequencyPath,'utf8')):null;
const frequencyProvider=frequencyAsset?createLilakProvider(dict,{wordFrequencies:frequencyAsset.wordFrequencies}):null;
const fullAsset=fullFrequencyPath?JSON.parse(readFileSync(fullFrequencyPath,'utf8')):null;
const fullProvider=fullAsset?createLilakProvider(dict,{wordFrequencies:fullAsset.wordFrequencies}):null;
const frequencyOnly=process.env.PWE_COMPARE_PROFILE==='frequency';
const nsStart=performance.now(),ns=frequencyOnly?null:nspell(dictionary),nspellSetupMs=frequencyOnly?null:performance.now()-nsStart;
function pweReview(source,provider=pwe){
 if(!eligible(source,'fa'))return {candidates:[],partial:true};
 try{
  const findings=provider.check(source,'fa');
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
const evidence=unpackDictionaryEvidence(dict),roots=new Set(evidence.words),aliases=new Set();
for(const [a,b] of formalSpellings)if(roots.has(a)||roots.has(b)){aliases.add(a);aliases.add(b);}
const knownSource=w=>roots.has(w)||aliases.has(w)||evidence.isKnownSource(w);
const modes={primary:pweReview,secondary:nspellReview,knownSource,secondaryCorrect:w=>ns.correct(w)};
const cascade=createCascade(modes),vetoCascade=createCascade({...modes,vetoPrimary:true});
const report={schema:2,source:manifest.source,attribution:manifest.attribution,license:manifest.license,kind:'evaluation-only; isolated word pairs, not sentence grammar or overall accuracy',versions:{dictionary:'2.0.0',nspell:'2.1.5',isBuffer:'2.0.5',node:process.version,commit:process.env.GITHUB_SHA??null},setupMs:{pwe:pweSetupMs,nspell:nspellSetupMs},datasets:{}};
for(const f of manifest.files){
 const raw=readFileSync(resolve(input,f.id+'.txt'));
 assert.equal(raw.length,f.bytes);
 assert.equal(createHash('sha256').update(raw).digest('hex'),f.sha256);
 const data=parseFaSpell(new TextDecoder('utf-8',{fatal:true}).decode(raw),f.rows);
 report.datasets[f.id]={sha256:f.sha256,selection:data.counts,pwe:summarizeCases(data.cases,pweReview)};
 if(!frequencyOnly)Object.assign(report.datasets[f.id],{nspell:summarizeCases(data.cases,nspellReview),cascade:summarizeCases(data.cases,cascade)});
 if(frequencyProvider)report.datasets[f.id].manaSample=summarizeCases(data.cases,w=>pweReview(w,frequencyProvider));
 if(fullProvider)report.datasets[f.id].manaFull=summarizeCases(data.cases,w=>pweReview(w,fullProvider));
 console.log('PWE_FASPELL '+JSON.stringify({dataset:f.id,...report.datasets[f.id]}));
}
if(fullProvider){
 const h=report.datasets.human,o=report.datasets.ocr;
 const reasons=[];
 if(h.manaFull.top1-h.pwe.top1<Math.ceil(h.pwe.pairs*.02))reasons.push('human-top1-gain-below-2pp');
 for(const [id,d] of Object.entries({human:h,ocr:o})){
  if(d.manaFull.top4<d.pwe.top4)reasons.push(id+'-top4-regression');
  if(d.manaFull.correctWithSuggestion>d.pwe.correctWithSuggestion)reasons.push(id+'-gold-control-regression');
  if(d.manaFull.partial>0)reasons.push(id+'-partial');
 }
 report.researchDecision={status:reasons.length?'DEFER':'CANDIDATE',reasons,criteria:'human top1 +2 percentage points, no top4/control/partial regression in either set; separate document/mobile/package gate required'};
 console.log('PWE_FREQUENCY_DECISION '+JSON.stringify(report.researchDecision));
}
mkdirSync('qualification-artifacts',{recursive:true});writeFileSync('qualification-artifacts/faspell-comparison.json',JSON.stringify(report,null,2));
// Diagnostic only. No promotion based on this single benchmark.
