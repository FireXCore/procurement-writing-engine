import { pathToFileURL } from 'node:url';
import { buildResearchSnapshot } from './routing-v2.mjs';
import { eligible, validateDocument } from '../src/regions.mjs';

// Separate challenge set, created after the prototype. No host catalog is supplied.
// Once committed, this is a public regression set, not a hidden holdout.
export const challengeCases = [
  [
    "quoted-path",
    "Please chek \"C:\\Program Files\\Vendor Folder\\offer.pdf\".",
    "C:\\Program Files\\Vendor Folder\\offer.pdf",
    "en",
    "chek"
  ],
  [
    "unc-path",
    "Please chek \\\\server\\Shared Folder\\offer.pdf.",
    "\\\\server\\Shared Folder\\offer.pdf",
    "en",
    "chek"
  ],
  [
    "unseen-brand",
    "Please chek the KROHNE offer.",
    "KROHNE",
    "en",
    "chek"
  ],
  [
    "unseen-brand-mixed",
    "Please chek the Bürkert offer.",
    "Bürkert",
    "en",
    "chek"
  ],
  [
    "company",
    "Please chek the Baker Hughes quotation.",
    "Baker Hughes",
    "en",
    "chek"
  ],
  [
    "financial-unseen",
    "Please chek AED ٣٥٬٠٠٠٫٥٠.",
    "AED ٣٥٬٠٠٠٫٥٠",
    "en",
    "chek"
  ],
  [
    "currency-suffix",
    "Please chek 12 500 EUR.",
    "12 500 EUR",
    "en",
    "chek"
  ],
  [
    "measurement-unseen",
    "Please chek 50 Nm.",
    "50 Nm",
    "en",
    "chek"
  ],
  [
    "measurement-complex",
    "Please chek 1.5 m³/h.",
    "1.5 m³/h",
    "en",
    "chek"
  ],
  [
    "compound-unit",
    "Please chek 2.5 kg/m³.",
    "2.5 kg/m³",
    "en",
    "chek"
  ],
  [
    "unseen-standard",
    "Please chek ISO 10423:2022.",
    "ISO 10423:2022",
    "en",
    "chek"
  ],
  [
    "url-unicode",
    "Please chek https://example.com/کالا?q=42.",
    "https://example.com/کالا?q=42",
    "en",
    "chek"
  ],
  [
    "fa-brand",
    "لطفا قیمت KROHNE را اعلام کنید.",
    "KROHNE",
    "fa",
    "لطفا"
  ],
  [
    "fa-brand2",
    "لطفا قیمت Bürkert را اعلام کنید.",
    "Bürkert",
    "fa",
    "لطفا"
  ],
  [
    "fa-money",
    "لطفا مبلغ ۵۰۰ هزار تومان را اعلام کنید.",
    "۵۰۰ هزار تومان",
    "fa",
    "لطفا"
  ],
  [
    "fa-company",
    "لطفا با شرکت نمونه صنعت تماس بگیرید.",
    "شرکت نمونه صنعت",
    "fa",
    "لطفا"
  ],
  [
    "mixed-token",
    "Please chek AB۱۲۳.",
    "AB۱۲۳",
    "en",
    "chek"
  ],
  [
    "bidi-control",
    "Please chek ABC‮123.",
    "ABC‮123",
    "en",
    "chek"
  ],
  [
    "combining",
    "Please chek Café Industries.",
    "Café Industries",
    "en",
    "chek"
  ],
  [
    "unknown-identifier",
    "Please chek ABC_12/34.",
    "ABC_12/34",
    "en",
    "chek"
  ],
  [
    "date-unseen",
    "Please chek 25-Nov-2026.",
    "25-Nov-2026",
    "en",
    "chek"
  ],
  [
    "contract",
    "Please chek DDP New Delhi Incoterms 2020.",
    "DDP New Delhi",
    "en",
    "chek"
  ]
];
export function runChallenge(classifier=buildResearchSnapshot) {
  return challengeCases.map(([id,input,entity,lang,typo])=>{
    const locked='LOCKED 9876', p=classifier(input,locked,'challenge-'+id);
    const prose=p.document.regions.filter(r=>r.kind==='prose');
    const start=input.indexOf(entity), t=input.indexOf(typo);
    const routed=prose.some(r=>r.language===lang&&r.start<=t&&r.end>=t+typo.length);
    const protectedEntity=!prose.some(r=>r.start<start+entity.length&&r.end>start);
    const abstentionExpected=id==='bidi-control';
    const valid=validateDocument(p.document)&&p.document.text===input+'\n'+locked&&prose.every(r=>eligible(p.document.text.slice(r.start,r.end),r.language)&&r.end<=input.length);
    return {id,routed,protectedEntity,abstentionExpected,valid,pass:valid&&protectedEntity&&(abstentionExpected?prose.length===0:routed)};
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const results=runChallenge();
 console.log(JSON.stringify({cases:results.length,pass:results.filter(x=>x.pass).length,results},null,2));
 if(results.some(x=>!x.valid)||(process.argv.includes('--gate')&&results.some(x=>!x.pass)))process.exitCode=1;
}
