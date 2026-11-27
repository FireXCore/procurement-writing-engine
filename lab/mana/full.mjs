import {readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';
import {buildEvidence} from './frequency.mjs';
const path=process.argv[2];if(!path)throw Error('Explicit projected corpus required');
assert.ok(statSync(path).size<=64000000);
const payload=JSON.parse(readFileSync(path,'utf8')),manifest=JSON.parse(readFileSync(new URL('./full-source.json',import.meta.url),'utf8'));
assert.deepEqual(payload.source,manifest);
assert.ok(Array.isArray(payload.inventory)&&payload.inventory.length>=60&&payload.inventory.length<=100);
assert.equal(payload.projections.length,payload.inventory.length);
assert.ok(payload.reservedTransferBytes<=manifest.maxTransferBytes);
assert.equal(payload.projections.reduce((n,p)=>n+p.rows,0),payload.rows.length);
const inputRows=payload.projections.reduce((n,p)=>n+p.inputRows,0),excludedRows=inputRows-payload.rows.length;
assert.ok(inputRows>=50000&&inputRows<=manifest.maxRows&&excludedRows>=0&&excludedRows<=inputRows*.05);
for(const p of payload.projections){
 assert.ok(Number.isSafeInteger(p.inputRows)&&Number.isSafeInteger(p.rows)&&p.rows>=0&&p.inputRows>=p.rows);
 assert.ok(Object.values(p.excluded).every(n=>Number.isSafeInteger(n)&&n>0));
 assert.equal(p.inputRows,p.rows+Object.values(p.excluded).reduce((a,b)=>a+b,0));
}
const data=buildEvidence(payload.rows);
assert.ok(data.counts.train>=10000&&data.counts.validation>0&&data.counts.test>0);
assert.ok(data.wordFrequencies.length>1000);
mkdirSync('qualification-artifacts',{recursive:true});
writeFileSync('qualification-artifacts/mana-full-frequency.json',JSON.stringify({schema:1,kind:'full pinned corpus projection, high alignment quality, train split only',source:manifest,inventory:payload.inventory,projections:payload.projections,reservedTransferBytes:payload.reservedTransferBytes,inputRows,excludedRows,...data},null,2));
console.log('PWE_MANA_FULL '+JSON.stringify({inputRows,excludedRows,counts:data.counts,groups:data.groups,unigrams:data.wordFrequencies.length,bigrams:data.bigramFrequencies.length,shards:payload.inventory.length,reservedTransferBytes:payload.reservedTransferBytes}));
