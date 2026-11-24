// Run against explicitly installed, reviewed binaries and a local LanguageTool service.
// No fallback to public APIs or automatically downloaded models.
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {createEngine} from '../src/index.mjs';
import {createVale,createSTE100,createLocalLanguageTool} from '../src/node/index.mjs';
const snap=(text,language='en')=>({text,snapshotId:'synthetic:service',regions:[{start:0,end:text.length,kind:'prose',language}]});
function required(key){const v=process.env[key];assert.ok(v,`${key} required; qualification cannot be skipped`);return v;}
test('installed Vale applies included Procurement policy', {timeout:30000},async()=>{
  const provider=createVale({executable:required('PWE_VALE'),config:resolve('.vale.ini')});
  const r=await createEngine([provider]).analyze(snap('Please send as soon as possible.'));
  assert.equal(r.status,'complete');assert.ok(r.findings.some(x=>x.original==='as soon as possible'&&x.provider==='vale'));
});
test('installed STE100 reports on technical English', {timeout:30000},async()=>{
  const p=createSTE100({executable:required('PWE_STE100')});
  const text='The tool was removed by the operator; utilize it carefully.';
  const r=await createEngine([p]).analyze(snap(text));
  assert.equal(r.status,'complete');assert.ok(r.findings.length>0);assert.ok(r.findings.every(f=>f.replacement===undefined));
});
test('self-hosted LanguageTool reports English and Persian issues', {timeout:30000},async()=>{
  const p=createLocalLanguageTool({endpoint:required('PWE_LT_ENDPOINT')});
  const e=createEngine([p]);
  const english=await e.analyze(snap('This is an test.'));
  assert.equal(english.status,'complete');assert.ok(english.findings.length>0);
  const persian=await e.analyze(snap('سلام سلام دنیا.','fa'));
  assert.equal(persian.status,'complete');assert.ok(persian.findings.length>0);
});
