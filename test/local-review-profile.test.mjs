import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareLilakDictionary,createLilakProvider,createLocalReviewProfile,createEngine} from '../src/index.mjs';
import {procurementAgreementRule} from '../src/policy.mjs';
const dic='5\nمشخصات\nتجهیزات\nدستگاه/sd\nفن/sl\nکنید\n',aff='FLAG long\nSFX sd N 1\nSFX sd 0 ها/FFWW .\nSFX sl N 1\nSFX sl 0 ی/FFWW .\n';
test('public Lilak package prepares exact local dictionary and rejects malformed packed assets',()=>{
 const d=prepareLilakDictionary(dic,aff);assert.equal(d.version,1);
 const p=createLilakProvider(d);
 assert.ok(p.check('مشخسات','fa').some(f=>f.replacement==='مشخصات'));
 for(const s of ['فنی','دستگاهها','مشخصات'])assert.deepEqual(p.check(s,'fa'),[]);
 assert.throws(()=>createLilakProvider({...d,words:'تجهیزات\nمشخصات\nتجهیزات'}));
 assert.throws(()=>createLilakProvider({...d,surfaces:'فن\tsl\nفن\tsl'}));
 assert.throws(()=>createLilakProvider({...d,suffixes:[['ها',['x']]]}));
 assert.throws(()=>prepareLilakDictionary(dic,'FLAG short'));
});
test('explicit local profile validates configuration before loading optional dependencies',async()=>{
 await assert.rejects(()=>createLocalReviewProfile({languages:['en']}));
 await assert.rejects(()=>createLocalReviewProfile({languages:['fa','fa']}));
 await assert.rejects(()=>createLocalReviewProfile({languages:['en'],harperBinary:{},persianDictionary:prepareLilakDictionary(dic,aff)}));
});
test('local policy abstains from embedded subjunctive and hypothetical clauses',()=>{
 const reports=[];
 const ctx={Syntax:{Document:'Document'},getSource:x=>x,RuleError:class{constructor(message,opts){Object.assign(this,opts)}},locator:{range:r=>r},fixer:{replaceTextRange:(range,replacement)=>({range,replacement})},report:(_,r)=>reports.push(r)};
 const check=procurementAgreementRule.rule.linter(ctx).Document;
 for(const s of ['We require that the supplier have confirmed the quotation.','We recommend that each of the suppliers have submitted a certificate.','Suppose that the equipment were available.','The supplier has confirmed the quotation.']){
   reports.length=0;check(s);assert.equal(reports.length,0,s);
 }
 reports.length=0;check('The supplier have received the quotation.');assert.equal(reports.length,1);assert.equal(reports[0].fix.replacement,'has');
 reports.length=0;check('The supplier have confirmed that the goods is available.');assert.deepEqual(reports.map(x=>x.fix.replacement),['has','are']);
 reports.length=0;check('We require that the goods be available.');assert.equal(reports.length,0);
});
