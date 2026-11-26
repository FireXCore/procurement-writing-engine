import test from 'node:test';
import assert from 'node:assert/strict';
import {buildResearchSnapshot} from '../demo/routing-v2.mjs';
import {validateDocument,eligible,validRange} from '../src/regions.mjs';
import {createEngine} from '../src/engine.mjs';
const names=['Rotork','Emerson Electric','Swagelok','Bürkert','شرکت آذر صنعت','آریا تجهیز','Baker Hughes','Yokogawa','Endress+Hauser','Fisher','پارس ابزار','KSB','ABB','Société Exemple','مهرآوران','Sample Vendor'];
const wrappers=[['',''],['(',')'],['[',']'],['«','»'],['“','”'],['brand:',''],['برند:',''],['','/documents'],['','؛'],['','؟'],['prefix','suffix'],['','،'],['',';'],['','!'],['{','}'],['','@example.com']];
const frames=[['Please chek the ',' offer.'],['Please confim availability of ',' before dispatch.'],['لطفا قیمت ',' را اعلام کنید.'],['لطفا مشخصات ',' و شرایط تحویل را ارسال کنید.'],['Please chek ',' and confirm receipt. لطفا پاسخ دهید.'],['لطفا برند ',' را بررسی کنید. Please chek availability.'],['Please chek ',' for the requested material.'],['لطفا برای ',' پیش‌فاکتور ارسال کنید.']];
export function checkRouting(){
 let count=0;
 for(const [left,right] of frames)for(const name of names)for(const [open,close] of wrappers){
  const input=left+open+name+close+right,start=left.length+open.length,end=start+name.length;
  const p=buildResearchSnapshot(input,'LOCKED 123','stress:'+count,{hostLiterals:[name]});
  assert.ok(validateDocument(p.document),input);
  assert.equal(p.document.text,input+'\nLOCKED 123');
  assert.ok(p.document.regions.every(r=>r.kind!=='prose'||eligible(p.document.text.slice(r.start,r.end),r.language)),input);
  assert.ok(p.document.regions.every(r=>r.kind!=='prose'||r.end<=start||r.start>=end),input);
  assert.equal(p.coverage.reviewable+p.coverage.recognized+p.coverage.suspected+p.coverage.unreviewed,p.coverage.total,input);
  count++;
 }return count;
}
export async function checkEngine(){
 let count=0;
 for(let i=0;i<128;i++)for(const replacement of ['<tag>','ABC123','۲۵','\u202eabc','x@y','x/y','\ud800','a\nb']){
  const prose='Please chek the quotation. ',text=prose+'LOCKED '+i;
  const doc={text,snapshotId:'guard:'+count,regions:[{start:0,end:prose.length,kind:'prose',language:'en'},{start:prose.length,end:text.length,kind:'protected'}]};
  const f={start:7,end:11,original:'chek',rule:'spell',category:'spelling',message:'Review spelling.'};
  const e=createEngine([{id:'adversarial',languages:['en'],check(source){assert.equal(source,prose);return [{...f,replacement:'check'},{...f,replacement},{...f,start:prose.length,end:prose.length+1,original:'L',replacement:'x'},{...f,original:'wrong',replacement:'check'}];}}]);
  const r=await e.analyze(doc);assert.equal(r.apply,false);assert.equal(r.status,'partial');assert.equal(r.findings.length,1);assert.equal(r.findings[0].replacement,'check');
  assert.ok(r.findings.every(x=>x.end<=prose.length&&validRange(text,x.start,x.end)&&text.slice(x.start,x.end)===x.original));
  assert.ok(r.diagnostics.some(x=>x.code==='rejected-finding'));count++;
 }return count;
}
test('2048 generated host literal and routing cases',()=>assert.equal(checkRouting(),2048));
test('1024 adversarial core cases with mock providers',async()=>assert.equal(await checkEngine(),1024));
