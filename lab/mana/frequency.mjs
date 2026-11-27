import {records} from '../faspell/evaluation.mjs';
const word=/^[آابتثجحخدذرزژسشصضطظعغفقکگلمنوهیپچئءؤأإ]{1,24}$/u;
const norm=s=>s.normalize('NFC').replace(/[يك]/gu,c=>c==='ي'?'ی':'ک');
export function readMetadataCSV(raw){
 if(typeof raw!=='string'||!raw.isWellFormed()||raw.length>16000000)throw new TypeError('Invalid metadata CSV');
 const rows=records(raw,','),header=rows.shift()??[],id=header.indexOf('file name'),text=header.indexOf('transcript'),quality=header.indexOf('match quality');
 if(Math.min(id,text,quality)<0||new Set(header).size!==header.length||!rows.length||rows.length>100000)throw new Error('Invalid metadata schema');
 return rows.map(r=>{if(r.length!==header.length)throw new Error('Malformed metadata row');return {id:r[id],text:r[text],quality:r[quality]};});
}
function bucket(group){let h=2166136261;for(const c of group)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)%10;}
export function buildEvidence(rows){
 if(!Array.isArray(rows)||!rows.length||rows.length>100000)throw new TypeError('Invalid corpus rows');
 const counts={input:rows.length,lowQuality:0,duplicateText:0,train:0,validation:0,test:0,trainTokens:0,validationTokens:0,testTokens:0};
 const ids=new Set(),seen=new Set(),unigrams=new Map(),bigrams=new Map(),groups={train:new Set(),validation:new Set(),test:new Set()},clean=[];
 for(const r of rows){
   if(!r||typeof r.id!=='string'||!/^[0-9]{1,8}-[0-9]{1,8}\.wav$/u.test(r.id)||ids.has(r.id)||typeof r.text!=='string'||!r.text.isWellFormed()||r.text.length>2000||!['HIGH','MIDDLE','REJECT'].includes(r.quality))throw new TypeError('Invalid corpus row');
   ids.add(r.id);if(r.quality!=='HIGH'){counts.lowQuality++;continue;}
   const text=norm(r.text).trim();if(!text)throw new Error('Empty transcript');
   clean.push({id:r.id,text});
 }
 clean.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 for(const r of clean){
   const key=r.text.replace(/\s+/gu,' ');
   if(seen.has(key)){counts.duplicateText++;continue;}seen.add(key);
   const group=r.id.split('-')[0],b=bucket(group),split=b<8?'train':b===8?'validation':'test';
   groups[split].add(group);counts[split]++;
   let end=0,previous=null;
   for(const m of r.text.matchAll(/[\p{L}\p{M}\u200c]+/gu)){
     const w=norm(m[0]),valid=word.test(w);
     if(valid){
       counts[split+'Tokens']++;
       if(split==='train'){
         unigrams.set(w,(unigrams.get(w)??0)+1);
         if(previous&&/^[ \t]+$/u.test(r.text.slice(end,m.index))){const k=previous+'\t'+w;bigrams.set(k,(bigrams.get(k)??0)+1);}
       }
     }
     previous=valid?w:null;end=m.index+m[0].length;
   }
 }
 if(counts.train+counts.validation+counts.test+counts.lowQuality+counts.duplicateText!==counts.input)throw Error('Corpus accounting mismatch');
 const rank=(map,max)=>[...map].sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:a[0]>b[0]?1:0)).slice(0,max);
 return {counts,groups:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.size])),wordFrequencies:rank(unigrams,100000),bigramFrequencies:rank(bigrams,50000).map(([key,n])=>[...key.split('\t'),n])};
}
