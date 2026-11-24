import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, harperAdapter, normalizerAdapter, experimentalVirastarAdapter, languageToolAdapter, ste100Adapter, valeAdapter, textlintAdapter, VIRASTAR_OPTIONS, procurementDeliveryRule } from '../src/index.mjs';
import { contiguousDiff, codePointOffset, validateDocument, boundaries } from '../src/regions.mjs';
import { createLocalLanguageTool, createVale, createSTE100 } from '../src/node/index.mjs';
const snap=(text,language='en',snapshotId='fixture:1')=>({text,snapshotId,regions:text.length?[{start:0,end:text.length,kind:'prose',language}]:[]});
const proposal=(text,start=0,end=text.length,replacement='the')=>({start,end,original:text.slice(start,end),replacement,category:'spelling',rule:'test',message:'Review spelling.'});
const provider=(check,id='fixture',languages=['en','fa'])=>({id,languages,check});

test('only approved prose is sent to providers; protected text not copied into report',async()=>{
 const prefix='Please send teh quotation. ', locked='VALVE 3 PCS, 4–20 mA, 3051', suffix=' Thank you.';
 const text=prefix+locked+suffix,calls=[];
 const doc={text,snapshotId:'r1',regions:[{start:0,end:prefix.length,kind:'prose',language:'en'},{start:prefix.length,end:prefix.length+locked.length,kind:'protected'},{start:prefix.length+locked.length,end:text.length,kind:'prose',language:'en'}]};
 const engine=createEngine([provider(s=>{calls.push(s);return s.includes('teh')?[proposal(s,12,15)]:[];})]);
 const r=await engine.analyze(doc);assert.equal(r.status,'complete');assert.deepEqual(calls,[prefix,suffix]);assert.equal(r.findings[0].original,'teh');assert.equal(r.findings[0].start,12);assert.equal(r.apply,false);assert.ok(!JSON.stringify(r).includes(locked));assert.ok(Object.isFrozen(r.findings));assert.ok(Object.isFrozen(r.findings[0]));
});
test('missing or invalid region maps block without calls',async()=>{
 let calls=0;const e=createEngine([provider(()=>{calls++;return [];})]);
 const s=snap('Please send it.');for(const regions of [undefined,[],[{...s.regions[0],start:1}],[{...s.regions[0],end:s.text.length+1}],[{...s.regions[0],language:'auto'}],[{...s.regions[0],kind:'unknown'}],[{...s.regions[0],end:5},{...s.regions[0],start:4}]]){assert.equal((await e.analyze({...s,regions})).status,'blocked');}assert.equal(calls,0);
});
test('numerals, identifiers, mixed script, control and technical symbols skip entire suspicious region',async()=>{
 let calls=0;const e=createEngine([provider(()=>{calls++;return [];})]);
 for(const text of ['3 PCS','Rosemount 3051','AISI valve','quote#value','test@sample','please see api/v1','price $','hello\u202Eworld','یک valve','نامه ۱۲۳','part-number','x=y']) assert.equal((await e.analyze(snap(text))).status,'partial',text);
 assert.equal(calls,0);
});
test('protected-only and empty snapshots are complete with no provider invocation',async()=>{
 const e=createEngine([provider(()=>{throw Error('must not run')})]);
 assert.equal((await e.analyze({text:'API 600',snapshotId:'a',regions:[{kind:'protected',start:0,end:7}]})).status,'complete');
 assert.equal((await e.analyze(snap(''))).status,'complete');
});
test('UTF-16 and grapheme boundaries prevent splitting emoji and combining marks',async()=>{
 const text='😀 cafe\u0301 teh';const b=boundaries(text);assert.ok(!b.has(1));assert.ok(!b.has(7));
 const e=createEngine([provider(s=>[proposal(s,0,1),proposal(s,6,7),proposal(s,s.indexOf('teh'),s.length)])]);const r=await e.analyze(snap(text));assert.equal(r.status,'partial');assert.equal(r.findings.length,1);assert.equal(r.findings[0].original,'teh');
 assert.equal(validateDocument({text:'😀a',snapshotId:'a',regions:[{start:0,end:1,kind:'protected'},{start:1,end:3,kind:'prose',language:'en'}]}),false);
 assert.equal(validateDocument(snap('\ud800')),false);
});
test('invalid offsets, source text, injected markup, numbers, technical tokens and boundary inserts rejected',async()=>{
 const text='teh sample';const good=proposal(text,0,3);const e=createEngine([provider(()=>[{...good,original:'bad'},{...good,start:-1},{...good,end:999},{...good,replacement:'316'},{...good,replacement:'HART'},{...good,replacement:'<script>'},{...good,message:'<img>'},{...good,replacement:'\ud800'},proposal(text,0,0,'new'),proposal(text,text.length,text.length,'new'),good])]);const r=await e.analyze(snap(text));assert.equal(r.findings.length,1);assert.equal(r.status,'partial');
});
test('provider failure isolated; no exception content in diagnostics',async()=>{
 const e=createEngine([provider(()=>{throw Error('secret payload')},'broken'),provider(s=>[proposal(s,0,3)],'working')]);const r=await e.analyze(snap('teh'));assert.equal(r.status,'partial');assert.equal(r.findings.length,1);assert.equal(r.diagnostics[0].code,'provider-failed');assert.ok(!JSON.stringify(r).includes('secret payload'));
});
test('provider dedup, stable ordering and competing edits remain separate',async()=>{
 const text='teh';const a=proposal(text);const e=createEngine([provider(()=>[a,a,{...a,replacement:'tea'}],'b'),provider(()=>[a],'a')]);const r=await e.analyze(snap(text));assert.deepEqual(r.findings.map(f=>[f.provider,f.replacement]),[['a','the'],['b','the'],['b','tea']]);assert.equal(r.apply,false);
});
test('cancellation retires noncooperative engine, prevents stale results and concurrent requests',async()=>{
 let complete;const pending=new Promise(r=>{complete=r});const e=createEngine([provider(()=>pending)]);const ac=new AbortController();const first=e.analyze(snap('teh'),{signal:ac.signal});assert.equal((await e.analyze(snap('other'))).status,'busy');ac.abort();const r=await first;assert.equal(r.status,'cancelled');assert.deepEqual(r.findings,[]);complete([proposal('teh')]);assert.equal((await e.analyze(snap('teh'))).status,'blocked');
});
test('pre-cancelled request never invokes provider',async()=>{
 const ac=new AbortController();ac.abort();let n=0;const e=createEngine([provider(()=>{n++;return []})]);assert.equal((await e.analyze(snap('teh'),{signal:ac.signal})).status,'cancelled');assert.equal(n,0);
});
test('snapshot copied before async provider; consumer must check exact live revision',async()=>{
 let resolve;const p=new Promise(r=>resolve=r);const document=snap('teh','en','original');const e=createEngine([provider(()=>p)]);const promise=e.analyze(document);document.text='new';document.snapshotId='new';document.regions[0].end=1;resolve([proposal('teh')]);const r=await promise;assert.equal(r.snapshotId,'original');assert.equal(r.findings[0].original,'teh');
});
test('malformed provider result is partial; provider registration validates',async()=>{
 assert.throws(()=>createEngine([]));assert.throws(()=>createEngine([provider(()=>[]),provider(()=>[])]));assert.throws(()=>createEngine([provider(()=>[],'bad id')]));const e=createEngine([provider(()=>({}))]);assert.equal((await e.analyze(snap('hello'))).status,'partial');
});
test('provider and global finding/call limits',async()=>{
 const e=createEngine([provider(s=>Array.from({length:110},(_,i)=>({...proposal(s),rule:`rule-${i}`})))]);const r=await e.analyze(snap('teh'));assert.equal(r.status,'partial');assert.equal(r.findings.length,100);
 let n=0;const a=createEngine([provider(()=>{n++;return []})]);const regions=Array.from({length:70},(_,i)=>({start:i*4,end:(i+1)*4,kind:'prose',language:'en'}));const q=await a.analyze({text:'test'.repeat(70),snapshotId:'limits',regions});assert.equal(n,64);assert.equal(q.status,'partial');
});
test('grapheme diff derives original source range without inventing a grammar rule',()=>{
 for(const [a,b] of [['فارسي','فارسی'],['می نویسم','می‌نویسم'],['abc😀','a😀'],['😀a','😀ab'],['hello',''],['','hello']]){const d=contiguousDiff(a,b);assert.equal(a.slice(0,d.start)+d.replacement+a.slice(d.end),b);assert.ok(boundaries(a).has(d.start)&&boundaries(a).has(d.end));}
 assert.equal(contiguousDiff('same','same'),null);
});
test('Harper adapter maps replace, remove, insert-after and frees WASM wrappers',async()=>{
 let frees=0;const free=()=>frees++;const lint={span:()=>({start:0,end:3,free}),get_problem_text:()=> 'teh',lint_kind:()=> 'Spelling',message:()=> 'Review spelling.',suggestions:()=>[{kind:()=>0,get_replacement_text:()=> 'the',free},{kind:()=>1,get_replacement_text:()=>'',free},{kind:()=>2,get_replacement_text:()=> 're',free}],free};
 const e=createEngine([harperAdapter({organizedLints:async()=>({Spell:[lint]})})]);const r=await e.analyze(snap('teh'));assert.deepEqual(r.findings.map(x=>x.replacement),['the','','tehre']);assert.equal(frees,5);
});
test('Virastar opts disable number/date normalization; experimental fork advisory only',async()=>{
 assert.equal(VIRASTAR_OPTIONS.fix_english_numbers,false);assert.equal(VIRASTAR_OPTIONS.normalize_dates,false);assert.equal(VIRASTAR_OPTIONS.fix_numeral_symbols,false);
 const s=snap('فارسي','fa');let r=await createEngine([normalizerAdapter(()=> 'فارسی')]).analyze(s);assert.equal(r.findings[0].replacement,'ی');r=await createEngine([experimentalVirastarAdapter({process:()=> 'فارسی'})]).analyze(s);assert.equal(r.findings[0].replacement,undefined);
});
test('language routing avoids sending Persian to English engine',async()=>{
 let called=0;const e=createEngine([provider(()=>{called++;return []},'english',['en']),normalizerAdapter(x=>x)]);assert.equal((await e.analyze(snap('سلام','fa'))).status,'complete');assert.equal(called,0);
});
test('LanguageTool verified context maps offsets; mismatched context rejected',async()=>{
 const t='A teh example';const m={offset:2,length:3,context:{text:t,offset:2,length:3},message:'Review spelling.',rule:{id:'SPELL',issueType:'misspelling'},replacements:[{value:'the'}]};const e=createEngine([languageToolAdapter(async()=>({matches:[m,{...m,context:{...m.context,offset:0}}]}))]);const r=await e.analyze(snap(t));assert.equal(r.findings.length,1);assert.equal(r.findings[0].replacement,'the');
});
test('STE100 codepoint offsets and exact spans; explanatory suggestions stay advisory',async()=>{
 const t='😀 use tool';assert.equal(codePointOffset(t,2),3);const e=createEngine([ste100Adapter(async()=>({violations:[{rule:'L1',start:2,end:5,text:'use',message:'Review term.',suggestion:'Use a different verb'},{rule:'L1',start:0,end:1,text:'wrong',message:'Wrong'}]}))]);const r=await e.analyze(snap(t));assert.equal(r.findings[0].start,3);assert.equal(r.findings[0].replacement,undefined);assert.equal(r.findings.length,1);
});
test('Vale uniquely anchors a line match and rejects repeated or missing terms',async()=>{
 const t='Please send\nsoon soon\nwhen ready';const e=createEngine([valeAdapter(async()=>({'stdin.txt':[{Line:2,Match:'soon',Check:'Procurement.A',Message:'Review.'},{Line:3,Match:'ready',Check:'Procurement.B',Message:'Review.'},{Line:99,Match:'ready',Check:'Procurement.C',Message:'Review.'}]}))]);const r=await e.analyze(snap(t));assert.equal(r.findings.length,1);assert.equal(r.findings[0].start,t.indexOf('ready'));assert.equal(r.findings[0].replacement,undefined);
});
test('textlint fixes use explicit range; advisory uses explicit nonempty range',async()=>{
 const e=createEngine([textlintAdapter({lintText:async()=>({messages:[{ruleId:'rule',message:'Review.',index:99,fix:{range:[0,3],text:'the'}},{ruleId:'policy',message:'Review.',range:[4,7]},{ruleId:'point',message:'Review.',index:1}]})},{plugins:[],rules:[]})]);const r=await e.analyze(snap('teh box'));assert.equal(r.findings.length,2);assert.equal(r.findings[0].start,0);assert.equal(r.findings[1].original,'box');assert.equal(r.findings[1].replacement,undefined);
});
test('procurement-specific Textlint policy is advisory without guessing a date',()=>{
 const reports=[];const c={Syntax:{Document:'Document'},getSource:()=> 'Please ship as soon as possible.',report:(_node,error)=>reports.push(error),RuleError:class extends Error{constructor(message,details){super(message);this.details=details;}},locator:{range:r=>r}};procurementDeliveryRule.rule(c).Document({});assert.deepEqual(reports[0].details.padding,[12,31]);assert.equal(reports[0].details.fix,undefined);
});
test('external provider factories reject public or arbitrary destinations',()=>{
 for(const endpoint of ['https://api.languagetool.org/v2/check','http://localhost:8081/v2/check','http://127.0.0.1:8081/v2/check?x=y','http://127.0.0.1:8081/other'])assert.throws(()=>createLocalLanguageTool({endpoint}));assert.throws(()=>createVale({executable:'vale',config:'.vale.ini'}));assert.throws(()=>createSTE100({executable:'ste100'}));assert.equal(createLocalLanguageTool().id,'languagetool');
});
test('property checks: every accepted proposal reconstructs only its source span',async()=>{
 let seed=17;const rng=()=>((seed=(seed*48271)%2147483647)/2147483647);
 for(let n=0;n<150;n++){const prefix='Please ',prose='send teh quotation',suffix=' now.',text=prefix+prose+suffix;const start=prefix.length,end=start+prose.length;const findings=Array.from({length:20},()=>{const s=Math.floor(rng()*(prose.length+5))-2,e=s+Math.floor(rng()*8);return {...proposal(prose,s,e,'the'),start:s,end:e};});const r=await createEngine([provider(()=>findings)]).analyze({text,snapshotId:`fuzz:${n}`,regions:[{start:0,end:start,kind:'protected'},{start,end,kind:'prose',language:'en'},{start:end,end:text.length,kind:'protected'}]});for(const f of r.findings){assert.ok(f.start>=start&&f.end<=end);assert.equal(f.original,text.slice(f.start,f.end));const edited=text.slice(0,f.start)+f.replacement+text.slice(f.end);assert.ok(edited.startsWith(prefix)&&edited.endsWith(suffix));}}
});

test('Harper ranks a reviewed procurement word ahead of unrelated alternatives without adding candidates',async()=>{
 const lint={span:()=>({start:0,end:9}),get_problem_text:()=> 'quatation',lint_kind:()=> 'Spelling',message:()=> 'Review spelling.',suggestions:()=>['equitation','quotation','quotations'].map(word=>({kind:()=>0,get_replacement_text:()=>word}))};
 const e=createEngine([harperAdapter({organizedLints:async()=>({Spell:[lint]})})]);const r=await e.analyze(snap('quatation'));assert.deepEqual(r.findings.map(x=>x.replacement),['quotation','equitation','quotations']);
});
test('rejected findings produce a bounded, non-sensitive diagnostic',async()=>{
 const p=proposal('teh');
 const r=await createEngine([provider(()=>[{...p,original:'invalid'},{...p,replacement:'123'},p])]).analyze(snap('teh'));
 assert.equal(r.status,'partial');assert.equal(r.findings.length,1);assert.deepEqual(r.diagnostics,[{code:'rejected-finding',provider:'fixture',start:0}]);
});
