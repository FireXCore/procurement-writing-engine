import test from 'node:test';
import assert from 'node:assert/strict';
import {buildResearchSnapshot} from '../demo/routing-v2.mjs';
import {eligible,validateDocument} from '../src/regions.mjs';

const names=["Swagelok","Bürkert","Rotork","Endress","Aventics","KROHNE","Café"];
const templates=["لطفا قیمت {name} و مبلغ ۳۵ میلیون ریال را اعلام کنید.","لطفا قیمت {name} را اعلام کنید.","لطفا قیمت {name} یا نمونه مشابه را اعلام کنید.","لطفا قیمت ({name}) و شرایط تحویل را اعلام کنید.","لطفا درباره {name} اطلاعات ارسال کنید.","لطفا قیمت {name}، مشخصات فنی و زمان تحویل را اعلام کنید."];
const controls=[{"input":"لطفا Technical Proposal و Commerical Offer را ارسال کنید.","typo":"Commerical","lang":"en"},{"input":"Please send the Commerical Offer.","typo":"Commerical","lang":"en"},{"input":"لطفا قیمت را اعلام کنید. Please chek the offer.","typo":"chek","lang":"en"},{"input":"لطفا قیمت را اعلام کنید.\nPlease chek the offer.","typo":"chek","lang":"en"}];
function verify(input,typo,lang,name){
  const p=buildResearchSnapshot(input,'LOCKED 9876','metamorphic');
  const prose=p.document.regions.filter(r=>r.kind==='prose');
  assert.ok(validateDocument(p.document));
  assert.equal(p.document.text,input+'\nLOCKED 9876');
  assert.ok(prose.every(r=>r.end<=input.length&&eligible(input.slice(r.start,r.end),r.language)));
  const at=input.indexOf(typo);
  assert.ok(prose.some(r=>r.language===lang&&r.start<=at&&r.end>=at+typo.length),input);
  if(name){const a=input.indexOf(name);assert.ok(!prose.some(r=>r.start<a+name.length&&r.end>a),input);}
  const {total,reviewable,recognized,suspected,unreviewed}=p.coverage;
  assert.equal(total,reviewable+recognized+suspected+unreviewed);
}
test('embedded Latin name candidates stay quarantined across Persian context mutations',()=>{
  for(const name of names)for(const t of templates)verify(t.replace('{name}',name),'لطفا','fa',name);
});
test('English phrases and separate sentences remain eligible',()=>{
  for(const c of controls)verify(c.input,c.typo,c.lang);
});
