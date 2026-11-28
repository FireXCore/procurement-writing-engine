// Public npm name/version metadata only. Never submit source, secrets or text.
// Query the independent OSV vulnerability database; missing/malformed data fails closed.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const lock=JSON.parse(readFileSync(process.argv[2],'utf8'));
assert.ok(lock.lockfileVersion>=2&&lock.packages);
const tuples=new Map();
for(const [path,p] of Object.entries(lock.packages)){
  if(!path)continue;
  assert.ok(path.includes('node_modules/'), 'Unexpected non-registry package path');
  const name=p.name??path.split('node_modules/').at(-1);
  if(name==='procurement-writing-engine'&&p.resolved?.startsWith('file:procurement-writing-engine-'))continue;
  assert.match(name,/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i);
  assert.ok(typeof p.version==='string'&&p.version.length<=128,'Missing package version');
  assert.ok(p.resolved?.startsWith('https://registry.npmjs.org/')&&p.integrity?.startsWith('sha'),'Unexpected dependency provenance');
  tuples.set(name+'@'+p.version,{package:{ecosystem:'npm',name},version:p.version});
}
const queries=[...tuples.values()];
assert.ok(queries.length>0&&queries.length<=5000);
let hits=0;
for(let i=0;i<queries.length;i+=50){
  const batch=queries.slice(i,i+50);
  const response=await fetch('https://api.osv.dev/v1/querybatch',{
    method:'POST',redirect:'error',headers:{'content-type':'application/json'},
    body:JSON.stringify({queries:batch}),signal:AbortSignal.timeout(30000)
  });
  assert.ok(response.ok,'OSV service unavailable: '+response.status);
  const result=await response.json();
  assert.ok(Array.isArray(result.results)&&result.results.length===batch.length,'Incomplete OSV response');
  for(let j=0;j<batch.length;j++){
    const entry=result.results[j];
    assert.ok(entry&&typeof entry==='object'&&!Array.isArray(entry),'Malformed OSV result');
    assert.ok(!entry.next_page_token,'OSV response requires pagination');
    if(entry.vulns!==undefined){
      assert.ok(Array.isArray(entry.vulns),'Malformed OSV vulnerabilities');
      for(const vuln of entry.vulns){
        assert.ok(typeof vuln.id==='string'&&/^[A-Za-z0-9_.-]+$/.test(vuln.id));
        hits++;
        console.log('OSV finding:',batch[j].package.name,batch[j].version,vuln.id);
      }
    }
  }
}
console.log('OSV exact lock query:',queries.length,'unique packages;',hits,'findings');
assert.equal(hits,0,'Independent dependency findings require maintainer triage');
