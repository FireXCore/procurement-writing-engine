// Do not upload raw SARIF or publish exploit locations. Review any finding
// privately; a missing, incomplete or malformed report is never a pass.
import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=process.argv[2];
const files=readdirSync(dir).filter(x=>x.endsWith('.sarif'));
assert.ok(files.length>0,'No CodeQL SARIF reports');
let runs=0,findings=0;
for(const file of files){
  const report=JSON.parse(readFileSync(join(dir,file),'utf8'));
  assert.equal(report.version,'2.1.0');
  assert.ok(Array.isArray(report.runs)&&report.runs.length);
  for(const run of report.runs){
    assert.ok(run.tool?.driver?.name==='CodeQL');
    assert.ok(Array.isArray(run.results),'Missing CodeQL results');
    assert.ok(!run.invocations?.some(i=>i.executionSuccessful===false),'CodeQL execution failed');
    runs++;
    findings+=run.results.length;
  }
}
console.log('CodeQL SARIF:',runs,'runs;',findings,'findings');
assert.equal(findings,0,'CodeQL findings require private triage before release');
