import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const pkg=JSON.parse(readFileSync('package.json','utf8'));
assert.equal(pkg.private,true,'npm registry publication remains disabled');
assert.ok(pkg.version.includes('-alpha.'),'This pipeline publishes alpha only');
assert.ok(existsSync('package-lock.json'),'A real resolved lockfile is mandatory');
const lock=JSON.parse(readFileSync('package-lock.json','utf8'));
assert.equal(lock.name,pkg.name);assert.equal(lock.version,pkg.version);
for(const [name,version] of Object.entries(pkg.devDependencies))assert.equal(lock.packages[`node_modules/${name}`]?.version,version,`Exact dependency ${name} not locked`);
for(const [name,p] of Object.entries(lock.packages)){if(!name)continue;assert.ok(typeof p.integrity==='string'&&p.integrity.startsWith('sha'),'Unverified dependency: '+name);assert.ok(p.resolved?.startsWith('https://registry.npmjs.org/'),'Non-registry dependency: '+name);}
const cli=process.platform==='win32'?'npm.cmd':'npm';
const opts={encoding:'utf8',stdio:['ignore','pipe','inherit'],shell:process.platform==='win32'};
const result=JSON.parse(execFileSync(cli,['pack','--dry-run','--ignore-scripts','--json'],opts));
assert.equal(result.length,1);const files=result[0].files.map(x=>x.path);
assert.ok(files.includes('src/index.mjs')&&files.includes('src/index.d.mts')&&files.includes('LICENSE'));
for(const path of files)assert.ok(!/(^|\/)(\.env(?:\.|$)|node_modules|\.git|dist|release-artifacts)(\/|$)|\.(?:wasm|onnx|gguf|pem|key|pfx|zip)$/i.test(path),`Unexpected release file ${path}`);
console.log('Release manifest and exact registry lock checks: PASS');
