import test from 'node:test';
import assert from 'node:assert/strict';
import {eligible,validReplacement} from '../src/regions.mjs';
import {createEngine} from '../src/engine.mjs';
import {createAdaptiveReview} from '../src/adaptive-review.mjs';
import {protectEntitySpans} from '../src/protection.mjs';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
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
 for(const [original,replacement,language] of [['teh','the','en'],['delivrey','delivery','en'],['لطفا','لطفاً','fa'],['تاییید','تأیید','fa'],['تاییید','تایید','fa'],['تایید','تأیید','fa']]){
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

test('invisible Unicode and English joiners never reach providers or replacements',async()=>{
 for(const text of ['te\u034fh','te\uFE0Fh','te\u200ch','te\u2060h','te\u00adh']){
   assert.equal(eligible(text,'en'),false);
   assert.equal(validReplacement('teh',text,'en'),false);
   const r=await createEngine([provider(()=>{throw Error('provider must not be called');})]).analyze(doc(text));
   assert.equal(r.diagnostics[0].code,'unsafe-region');
 }
 assert.equal(eligible('می‌رود','fa'),true);
 assert.equal(validReplacement('می رود','می‌رود','fa'),true);
});
test('adversarial edits cannot consume a separator at protected region edges',async()=>{
 const cases=[
   {text:'Acme teh',regions:[{start:0,end:4,kind:'protected'},{start:4,end:8,kind:'prose',language:'en'}],original:' teh',replacement:'the',start:4,end:8},
   {text:'teh Acme',regions:[{start:0,end:4,kind:'prose',language:'en'},{start:4,end:8,kind:'protected'}],original:'teh ',replacement:'the',start:0,end:4},
   {text:'Acmeteh',regions:[{start:0,end:4,kind:'protected'},{start:4,end:7,kind:'prose',language:'en'}],original:'teh',replacement:'the',start:4,end:7}
 ];
 for(const c of cases){
   const document={text:c.text,regions:c.regions,snapshotId:'edge'};
   const region=c.regions.find(r=>r.kind==='prose');
   const candidate={...finding(c.original,c.replacement),start:c.start-region.start,end:c.end-region.start};
   const r=await createEngine([provider(()=>[candidate])]).analyze(document);
   assert.equal(r.status,'partial');assert.deepEqual(r.findings,[]);
   assert.throws(()=>createAdaptiveReview().prepare(document,{snapshotId:'edge',status:'complete',apply:false,findings:[{...candidate,provider:'fixture',start:c.start,end:c.end}]}));
 }
 const document={text:'Acme teh',regions:cases[0].regions,snapshotId:'edge-ok'};
 const r=await createEngine([provider(()=>[{...finding('teh','the'),start:1,end:4}])]).analyze(document);
 assert.equal(r.status,'complete');assert.equal(r.findings[0].replacement,'the');
});


test('dedicated worker handlers reject foreign, synthetic and non-parent messages before processing',async()=>{
  for(const name of ['worker.mjs','neural-lab-worker.mjs']){
    const sent=[];
    const self={location:{origin:'https://demo.example'},postMessage:value=>sent.push(value)};
    const source=readFileSync(new URL('../demo/'+name,import.meta.url),'utf8').replace(/^import .*;\r?$/gmu,'');
    runInNewContext(source,{self});
    const event={origin:'',isTrusted:true,source:null,data:null};
    await self.onmessage({...event,origin:'https://foreign.example'});
    await self.onmessage({...event,isTrusted:false});
    await self.onmessage({...event,source:{}});
    assert.equal(sent.length,0,name);
    await self.onmessage(event);
    assert.equal(sent.length,1,name);
    assert.ok(sent[0].type==='error'||sent[0].ok===false,name);
    await self.onmessage(event);
    assert.equal(sent.length,1,name+' must accept only one request');
  }
});
