import test from 'node:test';
import assert from 'node:assert/strict';
import {readMetadataCSV,buildEvidence} from '../lab/mana/frequency.mjs';
test('Mana metadata selects transcript, not ASR hypotheses',()=>{
 const rows=readMetadataCSV('file name,transcript,match quality,hypothesis\r\n1-1.wav,"کتاب، قلم",HIGH,غلط\r\n1-2.wav,"کتاب ""قلم""",REJECT,غلط\r\n');
 assert.deepEqual(rows,[{id:'1-1.wav',text:'کتاب، قلم',quality:'HIGH'},{id:'1-2.wav',text:'کتاب "قلم"',quality:'REJECT'}]);
 assert.throws(()=>readMetadataCSV('file name,transcript\n1-1.wav,کتاب'));
});
test('Mana group split and text dedup are deterministic; bigrams never cross punctuation or invalid tokens',()=>{
 const rows=[];
 for(let i=1;i<=40;i++)rows.push({id:i+'-1.wav',text:'کتاب قلم، دفتر کتاب‌ها',quality:'HIGH'},{id:i+'-2.wav',text:'دفتر قلم '+ 'آ'.repeat(i),quality:'HIGH'});
 rows.push({id:'99-1.wav',text:'آزمایشی',quality:'REJECT'});
 const a=buildEvidence(rows),b=buildEvidence([...rows].reverse());assert.deepEqual(a,b);
 assert.equal(a.counts.input,81);assert.equal(a.counts.lowQuality,1);assert.equal(a.counts.duplicateText,39);
 assert.ok(a.counts.train>0&&a.counts.validation>0&&a.counts.test>0);
 assert.ok(a.wordFrequencies.every(([w,n])=>!w.includes('‌')&&n>0&&w.length<=24));
 assert.ok(a.bigramFrequencies.every(([l,r])=>!(l==='قلم'&&r==='دفتر')));
 assert.ok(!a.wordFrequencies.some(([w])=>w==='آزمایشی'));
 assert.throws(()=>buildEvidence([rows[0],rows[0]]));
});
