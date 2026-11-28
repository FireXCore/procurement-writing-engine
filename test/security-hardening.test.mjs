import test from 'node:test';
import assert from 'node:assert/strict';
import {eligible,validReplacement} from '../src/regions.mjs';
import {createEngine} from '../src/engine.mjs';
import {createAdaptiveReview} from '../src/adaptive-review.mjs';
import {protectEntitySpans} from '../src/protection.mjs';
import {readFileSync} from 'node:fs';
const doc=(text,language='en')=>({text,snapshotId:'security-fixture',regions:[{start:0,end:text.length,kind:'prose',language}]});
const provider=(check)=>({id:'fixture',languages:['en','fa'],check});
const finding=(text,replacement)=>({start:0,end:text.length,original:text,replacement,category:'spelling',rule:'fixture',message:'Review candidate.'});
test('unsupported scripts do not reach providers or enter suggestions',async()=>{
 for(const [text,language] of [['Аcme','en'],['Acme Ω','en'],['hello 中文','en'],['سلام Ω','fa'],['سلام А','fa'],['hello क','en']]){
   assert.equal(eligible(text,language),false);
   let called=false;const r=await createEngine([provider(()=>{called=true;return []})]).analyze(doc(text,language));
   assert.equal(r.status,'partial');assert.equal(called,false);
 }
 for(const [text,language] of [['Café','en'],['Cafe\u0301','en'],['😀 use tool','en'],['لطفاً بررسی کنید','fa'],['می‌رود','fa']])assert.equal(eligible(text,language),true);
 assert.equal(validReplacement('Acme','Аcme','en'),false);
 assert.equal(validReplacement('سلام','سلΩم','fa'),false);
});
test('critical lexical changes rejected at core and adaptive boundaries',async()=>{
 for(const [original,replacement,language] of [['safe','unsafe','en'],['must','may','en'],['not approved','approved','en'],['paid','unpaid','en'],['مجاز','غیرمجاز','fa'],['باید','نباید','fa']]){
   const candidate=finding(original,replacement);const document=doc(original,language);
   const result=await createEngine([provider(()=>[candidate])]).analyze(document);
   assert.equal(result.status,'partial');assert.equal(result.findings.length,0);assert.equal(result.apply,false);
   assert.throws(()=>createAdaptiveReview().prepare(document,{snapshotId:document.snapshotId,status:'complete',apply:false,findings:[{...candidate,provider:'fixture'}]}));
 }
 for(const [original,replacement,language] of [['teh','the','en'],['delivrey','delivery','en'],['لطفا','لطفاً','fa']]){
   const r=await createEngine([provider(()=>[finding(original,replacement)])]).analyze(doc(original,language));
   assert.equal(r.status,'complete');assert.equal(r.findings[0].replacement,replacement);
 }
});
test('host-defined plain-letter names remain protected and never reach providers',async()=>{
 const text='Please chek Acme';const document=protectEntitySpans(doc(text),{snapshotId:'security-fixture',spans:[{unit:'utf16',start:12,end:16,original:'Acme'}]});
 const sent=[];const r=await createEngine([provider(t=>{sent.push(t);return []})]).analyze(document);
 assert.equal(r.apply,false);assert.deepEqual(sent,['Please chek ']);
});
test('public worker has no external runtime import; release actions use immutable commits',()=>{
 const worker=readFileSync(new URL('../demo/neural-lab-worker.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(worker,/https?:\/\/|import\([^'"]/u);
 for(const name of ['ci.yml','npm-publish.yml','mana-full-experiment.yml','persian-qualification.yml']){
   const workflow=readFileSync(new URL('../.github/workflows/'+name,import.meta.url),'utf8');
   for(const match of workflow.matchAll(/uses:\s+actions\/[^\s@]+@([^\s]+)/g))assert.match(match[1],/^[0-9a-f]{40}$/);
 }
});
