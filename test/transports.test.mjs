import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,writeFile,readFile,rm,chmod,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createEngine} from '../src/index.mjs';
import {createLocalLanguageTool,createVale,createSTE100} from '../src/node/index.mjs';
const snap=text=>({text,snapshotId:'transport:synthetic',regions:[{start:0,end:text.length,kind:'prose',language:'en'}]});
test('actual HTTP transport: loopback form data, no cookies, reject redirect',async()=>{
  let payload,headers;
  const server=createServer(async(req,res)=>{
    const chunks=[];for await(const c of req)chunks.push(c);payload=new URLSearchParams(Buffer.concat(chunks).toString());headers=req.headers;
    if(payload.get('text')==='Redirect now.') {res.writeHead(302,{Location:'http://127.0.0.1:1/v2/check'});res.end();return;}
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({matches:[{offset:0,length:3,context:{text:'teh quote',offset:0,length:3},rule:{id:'TEST',issueType:'misspelling'},message:'Review.',replacements:[{value:'the'}]}]}));
  });
  await new Promise((resolve,reject)=>{server.on('error',reject);server.listen(0,'127.0.0.1',resolve);});
  try{
    const p=createLocalLanguageTool({endpoint:`http://127.0.0.1:${server.address().port}/v2/check`});const e=createEngine([p]);
    const r=await e.analyze(snap('teh quote'));assert.equal(r.findings[0].replacement,'the');assert.equal(payload.get('language'),'en-US');assert.equal(payload.get('text'),'teh quote');assert.equal(headers.cookie,undefined);
    const redirect=await e.analyze(snap('Redirect now.'));assert.equal(redirect.status,'partial');assert.equal(redirect.diagnostics[0].code,'provider-failed');
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('real process transport with synthetic executable: stdin Vale and STE100 temporary file cleanup',{skip:process.platform==='win32'},async()=>{
  const dir=await mkdtemp(join(tmpdir(),'pwe-transport-'));const exec=join(dir,'fixture');const marker=join(dir,'marker.txt');const config=join(dir,'config.ini');
  try {
    // The executable is a controlled test double, not Vale or STE100. No shell is used by the adapter.
    const body=`#!${process.execPath}\nconst fs=require('node:fs');const args=process.argv.slice(2);if(args[0]==='--config'){const t=fs.readFileSync(0,'utf8');process.stdout.write(JSON.stringify({'stdin.txt':[{Line:1,Match:t,Check:'Policy',Message:'Review.'}]}));}else{const t=fs.readFileSync(args[0],'utf8');fs.writeFileSync(${JSON.stringify(marker)},args[0]);process.stdout.write(JSON.stringify({violations:[{rule:'Policy',start:0,end:[...t].length,text:t,message:'Review.'}]}));}`;
    await writeFile(exec,body,{mode:0o700});await chmod(exec,0o700);await writeFile(config,'fixture');
    const vale=createEngine([createVale({executable:exec,config})]);assert.equal((await vale.analyze(snap('Please review.'))).findings[0].original,'Please review.');
    const ste=createEngine([createSTE100({executable:exec})]);assert.equal((await ste.analyze(snap('Please review.'))).findings[0].original,'Please review.');
    const input=await readFile(marker,'utf8');await assert.rejects(access(input));
  } finally {await rm(dir,{force:true,recursive:true});}
});
