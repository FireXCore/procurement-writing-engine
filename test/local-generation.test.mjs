import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalGenerationProvider,createContextualProvider,createEngine} from '../src/index.mjs';
const wrap=edits=>[{generated_text:JSON.stringify(edits)}];
const item=(original,replacement,category='spelling')=>({original,replacement,category});
const gen=edits=>createLocalGenerationProvider({generator:()=>wrap(edits)});
test('generation bridge returns exact source offsets and bounded generation parameters',async()=>{
 let received;const source='Please chek the quotation.';
 const p=createLocalGenerationProvider({generator:(messages,opts)=>{received={messages,opts};return wrap([item('chek','check')]);}});
 const r=await p.check(source,'en');
 assert.equal(JSON.parse(received.messages[1].content).text,source);
 assert.deepEqual(received.opts,{do_sample:false,max_new_tokens:384,num_return_sequences:1,return_full_text:false});
 assert.deepEqual(r.map(x=>[x.start,x.end,x.original,x.replacement]),[[7,11,'chek','check']]);assert.ok(Object.isFrozen(r));
});
test('assistant chat output supports Persian orthography',async()=>{
 const p=createLocalGenerationProvider({generator:()=>[{generated_text:[{role:'assistant',content:JSON.stringify([item('لطفا','لطفاً','orthography'),item('می رود','می‌رود','orthography')])}]}]});
 assert.deepEqual((await p.check('لطفا می رود.','fa')).map(x=>x.replacement),['لطفاً','می‌رود']);
});
test('invalid ambiguous overlapping nonlocal edits reject atomically',async()=>{
 for(const [source,edits] of [
 ['Please chek chek.',[item('chek','check')]],
 ['Please check it.',[item('heck','hec')]],
 ['Please chek the quotation.',[item('chek','check'),item('chek the','check the','grammar')]],
 ['Please chek the quotation.',[item('quotation','invoice')]],
 ['Please chek the quotation.',[item('chek','check','style')]],
 ['Please chek the quotation.',[item('chek','check'),item('missing','word')]],
 ['Please chek the quotation.',[item('Please chek the quotation.','Send it.','grammar')]]
 ])await assert.rejects(()=>gen(edits).check(source,'en'),source);
});
test('rejects selected contract and polarity changes in both languages',async()=>{
 for(const [source,original,replacement,lang] of [
 ['The supplier shall not deliver.','shall not','shall','en'],
 ['The quotation is not approved.','not approved','approved','en'],
 ['The supplier must deliver.','must','may','en'],
 ['The quotation is approved.','approved','rejected','en'],
 ['The order is paid.','paid','unpaid','en'],
 ['The supplier shall deliver.','shall','will','en'],
 ['پرداخت مجاز نیست.','مجاز نیست','مجاز است','fa'],
 ['تجهیز نباید ارسال شود.','نباید','باید','fa'],
 ['پرداخت قبل از بازرسی است.','قبل','بعد','fa']
 ])await assert.rejects(()=>gen([item(original,replacement,'grammar')]).check(source,lang),source);
});
test('rejects malformed generation envelopes and output beyond budget',async()=>{
 for(const out of [[],[{generated_text:'not JSON'}],[{generated_text:'x'.repeat(9000)}],[{generated_text:'[{"original":"chek","replacement":"check","category":"spelling","extra":1}]'}],[{generated_text:[{role:'user',content:'[]'}]}]])
 await assert.rejects(()=>createLocalGenerationProvider({generator:()=>out}).check('Please chek.','en'));
});
test('real engine excludes protected region from model input',async()=>{
 const text='Please chek. LOCKED 99',seen=[];
 const p=createLocalGenerationProvider({generator:messages=>{seen.push(JSON.parse(messages[1].content).text);return wrap([item('chek','check')]);}});
 const r=await createEngine([p]).analyze({text,snapshotId:'local',regions:[{start:0,end:12,kind:'prose',language:'en'},{start:12,end:text.length,kind:'protected'}]});
 assert.equal(r.status,'complete');assert.equal(r.apply,false);assert.deepEqual(seen,['Please chek.']);assert.equal(r.findings[0].replacement,'check');
});
test('direct contextual adapter rejects critical changes; cancelled model not called',async()=>{
 const p=createContextualProvider({infer:()=>[{unit:'utf16',start:0,end:4,original:'must',replacement:'may',category:'grammar'}]});
 await assert.rejects(()=>p.check('must deliver','en'));
 const c=new AbortController();c.abort();let called=0;
 await assert.rejects(()=>createLocalGenerationProvider({generator:()=>{called++;return wrap([]);}}).check('Please chek.','en',c.signal));assert.equal(called,0);
});
