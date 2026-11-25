import { buildDemoSnapshot } from '../demo/regions.mjs';
import { eligible, validateDocument } from '../src/regions.mjs';

// Deterministic, synthetic development corpus. NOT a hidden holdout or linguistic accuracy test.
// Labels are assigned at generation time; no matching against parser rules.
const examples = [
 ['en','Please chek the quotation.','chek'],['en','Please confim availability.','confim'],
 ['en','The supplier has recieved our inquiry.','recieved'],['en','Please send teh documents.','teh'],
 ['en','The warrenty is confirmed.','warrenty'],
 ['fa','لطفا پیشنهاد قیمت را ارسال کنید.','لطفا'],['fa','حتما زمان تحویل را اعلام کنید.','حتما'],
 ['fa','مجددا مدارک را ارسال کنید.','مجددا'],['fa','احتراما درخواست بررسی داریم.','احتراما'],
 ['fa','لطفا مشخصات را بررسی کنید.','لطفا']
];
const entities = [
 ['brand','Yokogawa'],['brand','Siemens'],['brand','Endress+Hauser'],['brand','Flowserve'],
 ['model','EJA110E'],['model','7MF4433-1DA22-2AB1'],['model','abc-2026/x1'],['model','ref_123'],
 ['standard','IEC 60529'],['standard','ISO 9001'],['standard','ASME B16.5'],['standard','ASTM A216 WCB'],
 ['measurement','2-inch'],['measurement','150#'],['measurement','0–100°C'],['measurement','24 VDC'],
 ['measurement','230 VAC'],['measurement','M20×1.5'],['measurement','4–20 mA'],['measurement','۱۲ عدد'],
 ['financial','EUR 12,450.75'],['financial','USD 5,000'],['financial','30% T/T'],['financial','€1.250,50'],
 ['commercial','FCA Hamburg'],['commercial','Incoterms 2020'],['commercial','RFQ'],['commercial','PO'],
 ['date','2026-12-01'],['date','۱۴۰۵/۰۹/۰۴'],
 ['contact','sales+rfq@example.com'],['contact','https://example.com/rfq?id=2026&ref=A12'],
 ['path','C:\\RFQ\\ABC-2026.pdf'],['path','/srv/rfq/item-42.pdf']
];
const wrappers = [['',''],['(',')'],['[',']'],['"','"'],['',';']];
const placements = [
 ['prefix',' ',false],['prefix',': ',false],['prefix','\n',false],
 ['suffix',' ',true],['suffix','; ',true],['suffix','\n',true]
];
const locked='LOCKED 9876 — never route';
const createStats=()=>({cases:0,routed:0,entityProtected:0,joint:0,invalidPartitions:0,unsafeProse:0,lockedLeak:0});
function count(s, v){
 s.cases++;for(const k of ['routed','entityProtected','joint','invalidPartitions','unsafeProse','lockedLeak'])s[k]+=Number(v[k]);
}
export function runRoutingBenchmark(){
 const total=createStats(), groups={}, failures=[];
 let id=0;
 for(const [language,sentence,typo] of examples)for(const [category,entity] of entities)
 for(const [left,right] of wrappers)for(const [placement,sep,suffix] of placements){
  const wrapped=left+entity+right;
  const input=suffix?sentence+sep+wrapped:wrapped+sep+sentence;
  const typoStart=(suffix?0:wrapped.length+sep.length)+sentence.indexOf(typo);
  const entityStart=(suffix?sentence.length+sep.length:0)+left.length;
  const p=buildDemoSnapshot(input,locked,'routing-'+(++id));
  const {document}=p;
  const prose=document.regions.filter(r=>r.kind==='prose');
  const routed=prose.some(r=>r.language===language&&r.start<=typoStart&&r.end>=typoStart+typo.length);
  const entityProtected=!prose.some(r=>r.start<entityStart+entity.length&&r.end>entityStart);
  const v={routed,entityProtected,joint:routed&&entityProtected,
   invalidPartitions:!validateDocument(document)||document.text!==input+'\n'+locked,
   unsafeProse:prose.some(r=>!eligible(document.text.slice(r.start,r.end),r.language)),
   lockedLeak:prose.some(r=>r.end>input.length)};
  count(total,v);for(const key of ['language:'+language,'entity:'+category])count(groups[key]??=createStats(),v);
  if((!v.joint||v.invalidPartitions||v.unsafeProse||v.lockedLeak)&&failures.length<40)failures.push({id,language,category,input,typo,entity,...v});
 }
 return {schema:1,scope:'synthetic demo routing only',total,groups,failures};
}

const report=runRoutingBenchmark();
console.log(JSON.stringify(report,null,2));
if(report.total.invalidPartitions||report.total.unsafeProse||report.total.lockedLeak)process.exitCode=1;
if(process.argv.includes('--gate')&&report.total.joint!==report.total.cases)process.exitCode=1;
