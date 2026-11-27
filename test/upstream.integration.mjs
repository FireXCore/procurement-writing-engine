// Deliberately not part of the dependency-free contract suite.
// This test fails, rather than silently skipping, if any required upstream package is missing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, createHarper, createVirastar, createTextlint, procurementDeliveryRule } from '../src/index.mjs';
const snap=(text,language)=>({text,snapshotId:'synthetic:upstream',regions:[{start:0,end:text.length,kind:'prose',language}]});
test('real Harper WASM: English grammar and original offsets', {timeout:30000}, async()=>{
  const {binaryInlined}=await import('harper.js/binaryInlined');
  const harper=await createHarper({binary:binaryInlined,worker:false});
  try {
    const text='This is teh quotation.';
    const r=await createEngine([harper.provider]).analyze(snap(text,'en'));
    assert.ok(['complete','partial'].includes(r.status));
    assert.ok(r.findings.some(f=>f.original==='teh'&&f.replacement==='the'));
    for(const f of r.findings)assert.equal(text.slice(f.start,f.end),f.original);
  } finally {await harper.dispose();}
});
test('real Virastar: Persian characters and half-space',async()=>{
  const p=await createVirastar();
  const text='فارسي را كمی درست تر می نويسيم';
  const r=await createEngine([p]).analyze(snap(text,'fa'));
  assert.equal(r.status,'complete');
  assert.ok(r.findings.length);
  let result=text;
  for(const f of [...r.findings].sort((a,b)=>b.start-a.start))result=result.slice(0,f.start)+f.replacement+result.slice(f.end);
  assert.ok(result.includes('فارسی')&&result.includes('کمی'));
});
test('real textlint kernel + plaintext plugin + procurement delivery advisory',async()=>{
  const p=await createTextlint([procurementDeliveryRule]);
  const r=await createEngine([p]).analyze(snap('Please send as soon as possible.','en'));
  assert.equal(r.status,'complete');
  assert.ok(r.findings.some(x=>x.original==='as soon as possible'&&x.replacement===undefined));
});

import { procurementPolicyRules, procurementAgreementRule } from '../src/index.mjs';
import { buildDemoSnapshot } from '../demo/regions.mjs';
import { cases, locked, extendedCases, alpha7Cases } from './acceptance-fixtures.mjs';

test('real engines: all human acceptance examples and source protection', {timeout:120000}, async t=>{
  const {binaryInlined}=await import('harper.js/binaryInlined');
  const harper=await createHarper({binary:binaryInlined,worker:false});
  try{
    const virastar=await createVirastar(),policy=await createTextlint(procurementPolicyRules);
    for(const c of cases)await t.test(c.id,async()=>{
      const p=buildDemoSnapshot(c.text,locked,c.id);
      assert.deepEqual(p.languages,[c.language]);assert.equal(p.skipped,0);
      const calls=[];
      const providers=(c.language==='fa'?[virastar]:[harper.provider,policy]).map(provider=>({...provider,check:(text,lang,signal)=>{calls.push(text);return provider.check(text,lang,signal);}}));
      const result=await createEngine(providers).analyze(p.document);
      assert.ok(['complete','partial'].includes(result.status),JSON.stringify(result.diagnostics));
      assert.equal(result.apply,false);
      for(const text of calls)for(const token of [...(c.protected??[]),locked])assert.ok(!text.includes(token));
      for(const finding of result.findings){
        assert.equal(p.document.text.slice(finding.start,finding.end),finding.original);
        assert.ok(p.document.regions.some(r=>r.kind==='prose'&&finding.start>=r.start&&finding.end<=r.end));
      }
      for(const [original,replacement] of c.pairs??[])assert.ok(result.findings.some(f=>f.original===original&&f.replacement===replacement),JSON.stringify(result));
      if(c.first)assert.equal(result.findings.find(f=>f.original===c.first[0])?.replacement,c.first[1]);
      if(c.message)assert.ok(result.findings.some(f=>f.message.includes(c.message)&&f.replacement===undefined));
      if(c.clean){assert.equal(result.status,'complete');assert.equal(result.findings.length,0,JSON.stringify(result));}
      if(c.expectedText){
        let actual=c.text;
        const fixes=result.findings.filter(f=>f.replacement!==undefined).sort((a,b)=>b.start-a.start);
        assert.ok(fixes.length,JSON.stringify(result));
        for(const f of fixes)actual=actual.slice(0,f.start)+f.replacement+actual.slice(f.end);
        assert.equal(actual,c.expectedText);
        if(c.id==='fa-halfspace'){assert.equal(fixes.length,2);assert.ok(fixes.every(f=>f.original.includes('می کنیم')&&f.replacement.includes('می‌کنیم')&&f.original.length<=8));}
      }
    });
  }finally{await harper.dispose();}
});
test('real Textlint limited agreement policy has no false positives on reviewed controls',async()=>{
 const p=await createTextlint([procurementAgreementRule]);
 for(const text of ['The suppliers have confirmed the quotation.','The goods are available.','The supplier has confirmed the quotation.','Please ask the supplier to have confirmed the quote.','The phrase "the supplier have confirmed" is quoted.']){
  const r=await createEngine([p]).analyze(snap(text,'en'));assert.equal(r.status,'complete');assert.deepEqual(r.findings,[],text);
 }
});

test('real engines: mixed languages, lower-case identifiers and contextual first choice',{timeout:120000},async t=>{
 const {binaryInlined}=await import('harper.js/binaryInlined');
 const harper=await createHarper({binary:binaryInlined,worker:false});
 try{
  const virastar=await createVirastar(),policy=await createTextlint(procurementPolicyRules);
  for(const c of [...extendedCases,...alpha7Cases])await t.test(c.id,async()=>{
   const p=buildDemoSnapshot(c.text,locked,c.id);assert.deepEqual(p.languages,c.languages);
   const calls=[];
   const providers=[harper.provider,virastar,policy].map(provider=>({...provider,check:(text,lang,signal)=>{calls.push(text);return provider.check(text,lang,signal);}}));
   const report=await createEngine(providers).analyze(p.document);
   assert.equal(report.apply,false);assert.ok(['complete','partial'].includes(report.status));
   for(const text of calls)for(const token of [...(c.protected??[]),locked])assert.ok(!text.includes(token),token);
   for(const [original,replacement] of c.pairs)assert.ok(report.findings.some(f=>f.original===original&&f.replacement===replacement),JSON.stringify(report));
   if(c.first)assert.equal(report.findings.find(f=>f.original===c.first[0])?.replacement,c.first[1]);
   if(c.clean){assert.equal(report.status,'complete');assert.equal(report.findings.length,0);}
   if(c.noReplacement)assert.ok(report.findings.every(f=>f.replacement===undefined));
   if(c.expectedText){let actual=c.text;for(const f of report.findings.filter(f=>f.replacement!==undefined).sort((a,b)=>b.start-a.start))actual=actual.slice(0,f.start)+f.replacement+actual.slice(f.end);assert.equal(actual,c.expectedText);}
   for(const f of report.findings){assert.equal(p.document.text.slice(f.start,f.end),f.original);assert.ok(p.document.regions.some(r=>r.kind==='prose'&&r.start<=f.start&&r.end>=f.end));}
  });
 }finally{await harper.dispose();}
});

test('real Textlint mass-noun agreement and negative controls',async()=>{
 const p=await createTextlint([procurementAgreementRule]);
 const positives=[["The information are incomplete.","are","is"],["The information are available.","are","is"],["The information are not ready.","are","is"],["The information are missing.","are","is"],["The information are being verified.","are","is"],["The equipment are incomplete.","are","is"],["The equipment are available.","are","is"],["The equipment are not ready.","are","is"],["The equipment are missing.","are","is"],["The equipment are being verified.","are","is"],["The documentation are incomplete.","are","is"],["The documentation are available.","are","is"],["The documentation are not ready.","are","is"],["The documentation are missing.","are","is"],["The documentation are being verified.","are","is"],["The advice are incomplete.","are","is"],["The advice are available.","are","is"],["The advice are not ready.","are","is"],["The advice are missing.","are","is"],["The advice are being verified.","are","is"],["The feedback are incomplete.","are","is"],["The feedback are available.","are","is"],["The feedback are not ready.","are","is"],["The feedback are missing.","are","is"],["The feedback are being verified.","are","is"],["The evidence are incomplete.","are","is"],["The evidence are available.","are","is"],["The evidence are not ready.","are","is"],["The evidence are missing.","are","is"],["The evidence are being verified.","are","is"]];
 for(const [text,original,replacement] of positives){
   const r=await createEngine([p]).analyze(snap(text,'en'));
   assert.equal(r.status,'complete',text);
   assert.equal(r.findings.length,1,text);
   assert.equal(r.findings[0].original,original,text);
   assert.equal(r.findings[0].replacement,replacement,text);
   assert.equal(text.slice(r.findings[0].start,r.findings[0].end),original,text);
 }
 for(const text of ["The information is incomplete.","The documents are incomplete.","The information and documents are incomplete.","The equipment and materials are available.","Please ensure that the information is complete.","If the information were incomplete, we would ask for clarification.","The information provided by the suppliers is incomplete.","The evidence is not approved.","The phrase \"the information are incomplete\" is quoted."]){
   const r=await createEngine([p]).analyze(snap(text,'en'));
   assert.equal(r.status,'complete',text);assert.deepEqual(r.findings,[],text);
 }
});

test('real pinned Lilak dictionary root provider integration',async()=>{
 const {default:dictionary}=await import('dictionary-fa');
 const {parseDictionaryEvidence,createSourceAbstainer}=await import('../demo/dictionary-roots.mjs');
 const {createPersianLexiconProvider}=await import('../src/index.mjs');
 const evidence=parseDictionaryEvidence(dictionary.dic.toString('utf8'),dictionary.aff.toString('utf8'));
 const words=evidence.words;
 assert.ok(words.length>=1000);
 assert.ok(words.includes('مشخصات'));
 const provider=createPersianLexiconProvider({words,isKnownSource:createSourceAbstainer(evidence)});
 const text='مشخسات';
 const result=await createEngine([provider]).analyze({text,snapshotId:'lilak-real',regions:[{start:0,end:text.length,kind:'prose',language:'fa'}]});
 assert.equal(result.status,'complete');
 assert.ok(result.findings.some(f=>f.original===text&&f.replacement==='مشخصات'));
 assert.equal(result.apply,false);
 assert.deepEqual(provider.check('فنی','fa'),[]);
 const clean=provider.check('مشخصات','fa');
 assert.deepEqual(clean,[]);
 console.log('Lilak pinned simple roots:',words.length);
});

test('1024 synthetic bilingual spelling challenges with real pinned providers', {timeout:180000}, async()=>{
 const {binaryInlined}=await import('harper.js/binaryInlined');
 const {default:dictionary}=await import('dictionary-fa');
 const {parseDictionaryEvidence,packDictionaryEvidence,unpackDictionaryEvidence}=await import('../demo/dictionary-roots.mjs');
 const {createPersianLexiconProvider}=await import('../src/index.mjs');
 const {buildResearchSnapshot}=await import('../demo/routing-v2.mjs');
 const {mkdirSync,writeFileSync}=await import('node:fs');
 const en=[['quoutation','quotation'],['delivrey','delivery'],['specfication','specification'],['waranty','warranty'],['paymant','payment'],['inovice','invoice'],['certifcate','certificate'],['availablity','availability'],['manufaturer','manufacturer'],['shipmnt','shipment'],['documnt','document'],['commerical','commercial'],['techncial','technical'],['reciept','receipt'],['appruval','approval'],['suplier','supplier']];
 const fa=[['مشخسات','مشخصات'],['تجیهزات','تجهیزات'],['پشنهاد','پیشنهاد'],['مستندت','مستندات'],['قراداد','قرارداد'],['محمولهه','محموله'],['پردخات','پرداخت'],['تحویلل','تحویل'],['گزارشس','گزارش'],['تضیمین','تضمین'],['ضمانتت','ضمانت'],['تاییید','تأیید'],['دستگها','دستگاه'],['استعالام','استعلام'],['درخاست','درخواست'],['بازرسیی','بازرسی']];
 const enFrames=['Please verify the {w}.','Please confirm the {w}.','We received the {w}.','We reviewed the {w}.','The {w} is required.','The {w} was received.','Please update the {w}.','Please send the {w}.','We await the {w}.','Please check the {w}.','Please review the {w}.','Please attach the {w}.','Please provide the {w}.','We need the {w}.','Please submit the {w}.','Please prepare the {w}.'];
 const faFrames=['لطفاً {w} را بررسی کنید.','لطفاً {w} را ارسال کنید.','لطفاً {w} را تأیید کنید.','لطفاً {w} را اعلام کنید.','{w} را دریافت کردیم.','{w} را بررسی کردیم.','{w} ارسال شد.','{w} لازم است.','{w} دریافت شد.','لطفاً درباره {w} اطلاع دهید.','لطفاً {w} را پیگیری کنید.','لطفاً {w} را آماده کنید.','لطفاً {w} را ارائه کنید.','لطفاً {w} را تکمیل کنید.','لطفاً {w} را ارسال فرمایید.','لطفاً {w} را بررسی فرمایید.'];
 const counts={},failures=[],ambiguity={cases:0,abstained:0},variants={cases:0,accepted:0},novel={cases:0,positive:0,top1:0,any:0,controls:0,controlsWithEdits:0,unrelated:0,partial:0},novelFailures=[];
 let harper;
 try{
  harper=await createHarper({binary:binaryInlined,worker:false});
  const evidence=unpackDictionaryEvidence(packDictionaryEvidence(parseDictionaryEvidence(dictionary.dic.toString('utf8'),dictionary.aff.toString('utf8'))));
  const {formalSpellings,procurementWords,procurementCorpus}=await import('../src/persian-procurement-profile.mjs');
  const lexicon=createPersianLexiconProvider({...evidence,preferredSpellings:formalSpellings,preferredWords:procurementWords,rankingCorpus:procurementCorpus});
  const e=createEngine([harper.provider,await createTextlint(procurementPolicyRules),await createVirastar(),lexicon]);
  let total=0;
  for(const [lang,pairs,frames] of [['en',en,enFrames],['fa',fa,faFrames]]){
   const m=counts[lang]={cases:0,positive:0,control:0,top1:0,any:0,extraCases:0,controlWithEdits:0,partial:0};
   for(const [wrong,right] of pairs)for(const frame of frames)for(const dirty of [true,false]){
    const text=frame.replace('{w}',dirty?wrong:right),p=buildResearchSnapshot(text,'LOCKED 123','quality:'+total),r=await e.analyze(p.document);total++;m.cases++;
    assert.equal(r.apply,false);
    assert.ok(r.findings.every(f=>p.document.regions.some(x=>x.kind==='prose'&&f.start>=x.start&&f.end<=x.end)&&p.document.text.slice(f.start,f.end)===f.original));
    if(r.status!=='complete'||p.skipped||p.suspectedRanges)m.partial++;
    const edits=r.findings.filter(f=>f.replacement!==undefined),first=new Map();
    for(const f of edits){const k=JSON.stringify([f.start,f.end,f.provider,f.rule]);if(!first.has(k))first.set(k,f);}
    const top=[...first.values()],at=text.indexOf(wrong),match=f=>dirty&&f.start===at&&f.original===wrong&&f.replacement===right;
    const hit=top.some(match),extra=top.some(f=>!dirty||f.start!==at||f.end!==at+wrong.length);
    if(dirty){m.positive++;if(edits.some(match))m.any++;if(hit)m.top1++;}else{m.control++;if(edits.length)m.controlWithEdits++;}
    if(dirty&&lang==='fa'&&['مستندت','ضمانتت'].includes(wrong)){ambiguity.cases++;if(!edits.some(f=>f.start===at&&f.original===wrong))ambiguity.abstained++;}
    if(dirty&&wrong==='تاییید'){variants.cases++;if(top.some(f=>f.start===at&&f.original===wrong&&['تایید','تأیید'].includes(f.replacement)))variants.accepted++;}
    if(extra)m.extraCases++;
    if((dirty&&!hit)||extra||r.status!=='complete')failures.push({lang,text,expected:dirty?[wrong,right]:null,top:top.map(f=>[f.original,f.replacement]),status:r.status,diagnostics:r.diagnostics});
   }
  }
  assert.equal(total,1024);
  // A separate, new word-family suite. Do not alter historical exact scoring.
  const novelWords=[['تاممین','تأمین'],['تاخییر','تأخیر'],['تاسیسسات','تأسیسات'],['تاککیید','تأکید'],['برریسی','بررسی'],['ارسسال','ارسال'],['مکاتبهه','مکاتبه'],['مذاکرره','مذاکره'],['گواهینامه','گواهینامه'],['بازرگانیی','بازرگانی'],['مهندسیی','مهندسی'],['پیمانکارر','پیمانکار'],['انبارر','انبار'],['استانداردد','استاندارد'],['استعلامم','استعلام'],['سفارشش','سفارش']].filter(([a,b])=>a!==b);
  const novelFrames=['مدارک مربوط به {w} آماده است.','لطفاً درباره {w} توضیح دهید.','موضوع {w} در جلسه مطرح شد.','گزارش {w} را دریافت کردیم.','نتیجه {w} را اعلام کنید.','کارشناس موضوع {w} را بررسی کرد.','درخواست مربوط به {w} ثبت شد.','لطفاً وضعیت {w} را مشخص کنید.'];
  for(const [wrong,right] of novelWords)for(const frame of novelFrames)for(const dirty of [true,false]){
    const text=frame.replace('{w}',dirty?wrong:right),p=buildResearchSnapshot(text,'LOCKED 123','novel:'+novel.cases),r=await e.analyze(p.document);
    novel.cases++;
    assert.equal(r.apply,false);assert.ok(r.findings.every(f=>p.document.regions.some(x=>x.kind==='prose'&&f.start>=x.start&&f.end<=x.end)&&p.document.text.slice(f.start,f.end)===f.original));
    if(r.status!=='complete'||p.skipped||p.suspectedRanges)novel.partial++;
    const edits=r.findings.filter(f=>f.replacement!==undefined),groups=new Map();
    for(const f of edits){const k=JSON.stringify([f.start,f.end,f.provider,f.rule]);if(!groups.has(k))groups.set(k,f);}
    const top=[...groups.values()],at=text.indexOf(wrong),match=f=>dirty&&f.start===at&&f.original===wrong&&f.replacement===right;
    if(dirty){novel.positive++;if(edits.some(match))novel.any++;if(top.some(match))novel.top1++;}else{novel.controls++;if(edits.length)novel.controlsWithEdits++;}
    const extra=top.some(f=>!dirty||f.start!==at||f.end!==at+wrong.length);
    if(extra)novel.unrelated++;
    if((dirty&&!top.some(match))||extra||r.status!=='complete')novelFailures.push({text,expected:dirty?[wrong,right]:null,top:top.map(f=>[f.original,f.replacement]),status:r.status});
  }
  assert.equal(novel.cases,240);
  // Explicit ambiguous wordforms are counted separately, never forced into
  // a replacement. Report actual dictionary evidence for the three misses.
  const dictionaryProbes=['مستندت','مستندات','ضمانتت','ضمانت','تاییید','تایید','تأیید'].map(word=>({word,root:evidence.words.includes(word),sourceEvidence:evidence.isKnownSource(word),proposals:lexicon.check(word,'fa').map(f=>f.replacement)}));
  mkdirSync('qualification-artifacts',{recursive:true});
  writeFileSync('qualification-artifacts/quality.json',JSON.stringify({kind:'synthetic-template-spelling-challenge',total,counts,failures,ambiguity,variants,novel,novelFailures,dictionaryProbes},null,2));
  console.log('PWE_LANGUAGE_QUALIFICATION '+JSON.stringify({total,counts,ambiguity,variants,novel,dictionaryProbes}));
  // Enforce the measured exact historical baseline and source safety. Novel
  // scores are tracked separately; do not redefine ambiguous possessives
  // as mandatory errors merely to make exact recall equal 100%.
  assert.equal(counts.en.top1,256);assert.ok(counts.fa.top1>=224);
  for(const m of Object.values(counts)){assert.equal(m.controlWithEdits,0);assert.equal(m.extraCases,0);assert.equal(m.partial,0);}
  assert.equal(ambiguity.abstained,32);assert.equal(variants.accepted,16);
  assert.ok(novel.top1>=104);assert.ok(novel.any>=104);
  assert.equal(novel.controlsWithEdits,0);assert.equal(novel.unrelated,0);assert.equal(novel.partial,0);
 }finally{await harper?.dispose();}
});

test('published SDK local profile with real English and Persian providers, disposal and protected spans',async()=>{
 const {prepareLilakDictionary,createLocalReviewProfile}=await import('../src/index.mjs');
 const {default:dictionary}=await import('dictionary-fa');
 const {binaryInlined}=await import('harper.js/binaryInlined');
 const packed=prepareLilakDictionary(dictionary.dic.toString('utf8'),dictionary.aff.toString('utf8'));
 const p=await createLocalReviewProfile({harperBinary:binaryInlined,persianDictionary:packed});
 try{
  const en='Please chek the quotation. ',fa='لطفا مشخسات را ارسال کنید. ',locked='LOCKED 123',text=en+fa+locked;
  const doc={text,snapshotId:'public-profile',regions:[{start:0,end:en.length,kind:'prose',language:'en'},{start:en.length,end:en.length+fa.length,kind:'prose',language:'fa'},{start:en.length+fa.length,end:text.length,kind:'protected'}]};
  const r=await p.analyze(doc);
  assert.equal(r.status,'complete');assert.equal(r.apply,false);
  for(const [a,b] of [['chek','check'],['لطفا','لطفاً'],['مشخسات','مشخصات']])assert.ok(r.findings.some(f=>f.original===a&&f.replacement===b),a);
  assert.ok(r.findings.every(f=>f.end<=en.length+fa.length&&text.slice(f.start,f.end)===f.original));
  assert.equal(p.dictionaryEnabled,true);
  const a=p.dispose(),b=p.dispose();assert.equal(a,b);await a;
  const closed=await p.analyze(doc);assert.equal(closed.status,'blocked');assert.equal(closed.findings.length,0);
 }finally{await p.dispose();}
});
test('external NeveshtYar published challenge subset (diagnostic, no training)', {timeout:180000},async()=>{
 const {readFileSync,mkdirSync,writeFileSync}=await import('node:fs');
 const corpus=JSON.parse(readFileSync(new URL('./external/neveshtyar-challenge.json',import.meta.url),'utf8'));
 const {default:dictionary}=await import('dictionary-fa');
 const {binaryInlined}=await import('harper.js/binaryInlined');
 const {prepareLilakDictionary,createLocalReviewProfile}=await import('../src/index.mjs');
 const p=await createLocalReviewProfile({harperBinary:binaryInlined,persianDictionary:prepareLilakDictionary(dictionary.dic.toString('utf8'),dictionary.aff.toString('utf8'))});
 const counts={},rows=[];
 try{
  for(const [i,c] of corpus.cases.entries()){
   const key=c.language+':'+c.subset,m=counts[key]??={total:0,top1:0,any:0,abstained:0,partial:0};
   const text=c.source,report=await p.analyze({text,snapshotId:'external:'+i,regions:[{start:0,end:text.length,kind:'prose',language:c.language}]});
   const candidates=report.findings.filter(f=>f.start===0&&f.end===text.length&&f.original===text&&f.replacement!==undefined).map(f=>f.replacement);
   m.total++;if(candidates[0]===c.target)m.top1++;if(candidates.includes(c.target))m.any++;if(!candidates.length)m.abstained++;if(report.status!=='complete')m.partial++;
   assert.equal(report.apply,false);assert.ok(report.findings.every(f=>text.slice(f.start,f.end)===f.original));
   rows.push({...c,candidates,status:report.status});
  }
  assert.equal(rows.length,71);
  mkdirSync('qualification-artifacts',{recursive:true});
  writeFileSync('qualification-artifacts/external-neveshtyar.json',JSON.stringify({source:corpus.source,selection:corpus.selection,counts,rows},null,2));
  console.log('PWE_EXTERNAL_QUALIFICATION '+JSON.stringify({total:rows.length,counts}));
  // Retain the observed external development-set baseline. No changes to
  // the expected targets, including ambiguous or rare words.
  assert.ok(counts['fa:fixed'].top1+counts['fa:reported-hard'].top1>=6,'External Persian top-1 regression');
  assert.ok(counts['fa:fixed'].any+counts['fa:reported-hard'].any>=19,'External Persian candidate recall regression');
  assert.ok(counts['en:fixed'].top1+counts['en:reported-hard'].top1>=4,'External English top-1 regression');
  assert.ok(counts['en:fixed'].any+counts['en:reported-hard'].any>=10,'External English candidate recall regression');
 }finally{await p.dispose();}
});

test('real Textlint factual embedded agreement remains distinct from subjunctive clauses',async()=>{
 const p=await createTextlint([procurementAgreementRule]),e=createEngine([p]);
 const positive='The supplier have confirmed that the goods is available.';
 const r=await e.analyze(snap(positive,'en'));
 assert.deepEqual(r.findings.map(f=>[f.original,f.replacement]),[['have','has'],['is','are']]);
 for(const s of ['We require that the supplier have confirmed the quotation.','We recommend that each of the suppliers have submitted a certificate.','Suppose that the equipment were available.','We require that the goods be available.']){
   const result=await e.analyze(snap(s,'en'));assert.deepEqual(result.findings,[],s);
 }
});

test('real Lilak context ranking remains local and independent of repeated source tokens',async()=>{
 const {default:dictionary}=await import('dictionary-fa');
 const {prepareLilakDictionary,createLilakProvider}=await import('../src/index.mjs');
 const packed=prepareLilakDictionary(dictionary.dic.toString('utf8'),dictionary.aff.toString('utf8'));
 const p=createLilakProvider(packed,{rankingCorpus:['بازدید دانشگاه','رئیس دانشکده']});
 for(const [s,target] of [['بازدید دانشکاه','دانشگاه'],['رئیس دانشکاه','دانشکده']]){
   const r=p.check(s,'fa').filter(f=>f.original==='دانشکاه');
   assert.equal(r[0]?.replacement,target,s);
   assert.ok(r.every(f=>s.slice(f.start,f.end)===f.original));
 }
 const a=p.check('دانشکاه','fa');
 p.check('بازدید دانشکاه','fa');assert.deepEqual(p.check('دانشکاه','fa'),a);
});
