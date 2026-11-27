import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdaptiveReview,createPersianLexiconProvider,createEngine} from '../src/index.mjs';
const text='Please chek. LOCKED 123',doc={text,snapshotId:'one',regions:[{start:0,end:12,kind:'prose',language:'en'},{start:12,end:text.length,kind:'protected'}]};
const finding=(replacement,provider='harper',rule='spelling')=>({start:7,end:11,original:'chek',replacement,provider,rule,category:'spelling',message:'Review spelling.'});
const report=(findings=[finding('check'),finding('cheek'),finding('check','other','spell')])=>({snapshotId:'one',status:'complete',apply:false,findings,diagnostics:[]});
test('exact-span fusion preserves provenance and original order; explicit feedback adapts only after repeated votes',()=>{
 const p=createAdaptiveReview();let r=p.prepare(doc,report());
 assert.deepEqual(r.groups[0].candidates.map(c=>c.finding.replacement),['check','cheek']);
 assert.equal(r.groups[0].candidates[0].sources.length,2);
 assert.equal(r.record(0,1,'prefer'),true);assert.equal(r.record(0,1,'prefer'),false);
 r=p.prepare(doc,report());assert.equal(r.groups[0].candidates[0].finding.replacement,'check');
 assert.equal(r.record(0,1,'prefer'),true);
 r=p.prepare(doc,report());assert.equal(r.groups[0].candidates[0].finding.replacement,'cheek');
 assert.equal(r.groups[0].candidates.length,2);assert.equal(doc.text,text);
 const restored=createAdaptiveReview({profile:JSON.parse(JSON.stringify(p.exportProfile()))});
 assert.equal(restored.prepare(doc,report()).groups[0].candidates[0].finding.replacement,'cheek');
 p.clear();assert.equal(r.record(0,0,'reject'),false);
 assert.equal(p.exportProfile().records.length,0);
});
test('stale, protected, forged range, invalid import and nonspelling feedback fail closed',()=>{
 const p=createAdaptiveReview();const r=p.prepare(doc,report());p.invalidate();assert.equal(r.record(0,0,'prefer'),false);
 assert.throws(()=>p.prepare(doc,report([{...finding('check'),start:13,end:19,original:'LOCKED'}])));
 assert.throws(()=>p.prepare(doc,report([{...finding('check'),start:8}])));
 assert.throws(()=>p.prepare(doc,{...report(),snapshotId:'stale'}));
 assert.throws(()=>createAdaptiveReview({profile:{version:1,records:[{language:'en',original:'chek',replacement:'check',accepted:100,rejected:0}]}}));
 const g=p.prepare(doc,report([{...finding('check'),category:'grammar'}]));
 assert.equal(g.record(0,0,'prefer'),false);
});
test('overlap and advisory findings are not silently discarded; preference profiles are isolated',()=>{
 const p=createAdaptiveReview(),q=createAdaptiveReview();
 const r=p.prepare(doc,report([finding('check'),{...finding('check'),start:0,end:6,original:'Please',replacement:undefined,category:'style'}, {...finding('check'),start:0,end:11,original:'Please chek',replacement:'Please check',category:'grammar'}]));
 assert.equal(r.groups.length,3);assert.equal(r.record(0,0,'reject'),true);
 assert.equal(q.exportProfile().records.length,0);
});
test('Persian lexicon supports unknown one-edit candidates, exact known words, no ZWNJ fragmentation',()=>{
 const p=createPersianLexiconProvider({words:['ارسال','مشخصات','تجهیزات','معتبر','پیشنهاد','کنید']});
 const s='مشخسات را ارسال کنید.';
 const r=p.check(s,'fa');
 assert.ok(r.some(f=>f.original==='مشخسات'&&f.replacement==='مشخصات'));
 assert.ok(r.every(f=>s.slice(f.start,f.end)===f.original));
 assert.deepEqual(p.check('مشخصات را ارسال کنید.','fa'),[]);
 assert.deepEqual(p.check('ارسال‌کنید','fa'),[]);
 assert.throws(()=>createPersianLexiconProvider({words:['ABC123']}));
});
test('real engine does not expose protected Persian names to dictionary provider',async()=>{
 const p=createPersianLexiconProvider({words:['مشخصات','ارسال','کنید']});
 const s='مشخسات را ارسال کنید. مشخسات',cut=s.lastIndexOf('مشخسات');
 const a=await createEngine([p]).analyze({text:s,snapshotId:'fa',regions:[{start:0,end:cut,kind:'prose',language:'fa'},{start:cut,end:s.length,kind:'protected'}]});
 assert.equal(a.apply,false);assert.equal(a.status,'complete');
 assert.ok(a.findings.some(f=>f.replacement==='مشخصات'));assert.ok(a.findings.every(f=>f.end<=cut));
});
