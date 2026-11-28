import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { languageToolAdapter, ste100Adapter, valeAdapter } from '../adapters/reports.mjs';

const MAX_RESPONSE=1024*1024;
const TIMEOUT=15000;
function runJson(executable,args,{stdin,signal,accepted=[0]}={}) {
  if (!isAbsolute(executable)) throw new TypeError('Absolute executable path required');
  return new Promise((resolve,reject)=>{
    if (signal?.aborted) {reject(new Error('Cancelled'));return;}
    const env = {};
    for (const key of ['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','TMPDIR','LANG','LC_ALL']) {
      if (process.env[key] !== undefined) env[key] = process.env[key];
    }
    const child=spawn(executable,args,{shell:false,windowsHide:true,stdio:['pipe','pipe','ignore'],env});
    let settled=false, terminating=false, bytes=0, cleanupTimer; const chunks=[];
    const timer=setTimeout(()=>fail('Process timeout'),TIMEOUT);
    const abort=()=>fail('Cancelled');
    function cleanup(){clearTimeout(timer);clearTimeout(cleanupTimer);signal?.removeEventListener('abort',abort);}
    function fail(reason){
      if(settled||terminating)return;
      terminating=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);
      const finish=()=>{if(settled)return;settled=true;cleanup();reject(new Error(reason));};
      // Wait for direct child exit where possible; inherited pipes or OS errors
      // must not prevent a bounded return. This is not a process-tree sandbox.
      child.once('exit',finish);child.once('close',finish);
      cleanupTimer=setTimeout(finish,2000);
      child.stdin.destroy();child.stdout.destroy();
      try{child.kill('SIGKILL');}catch{}
      if(child.exitCode!==null||child.signalCode!==null||!child.pid)finish();
    }
    signal?.addEventListener('abort',abort,{once:true});
    child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>MAX_RESPONSE)fail('Output limit');else if(!settled&&!terminating)chunks.push(chunk);});
    child.on('error',()=>fail('Process unavailable'));
    child.stdin.on('error',()=>fail('Input failed'));
    child.on('close',code=>{if(settled||terminating)return;if(!accepted.includes(code)){fail('Process failed');return;}settled=true;cleanup();try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(new Error('Invalid JSON'));}});
    child.stdin.end(stdin??'');
    if(signal?.aborted)abort();
  });
}
// Absolute paths and configs are deployment-owned. Do not accept them from user requests.
export function createVale({executable,config}) {
  if(!isAbsolute(executable)||!isAbsolute(config))throw new TypeError('Absolute paths required');
  return valeAdapter((text,signal)=>runJson(executable,['--config',config,'--output=JSON','--ext=.txt','--no-exit'],{stdin:text,signal}));
}
export function createSTE100({executable}) {
  if(!isAbsolute(executable))throw new TypeError('Absolute executable path required');
  return ste100Adapter(async(text,signal)=>{
    const dir=await mkdtemp(join(tmpdir(),'pwe-'));
    try{const path=join(dir,'input.txt');await writeFile(path,text,{encoding:'utf8',mode:0o600,flag:'wx'});return await runJson(executable,[path,'--format','json'],{signal});}
    finally{await rm(dir,{recursive:true,force:true});}
  });
}
// A self-hosted service is explicitly enabled by the host. No external API, DNS, redirect, or cookies.
// Use only a loopback service verified to have no cloud forwarding/telemetry.
export function createLocalLanguageTool({endpoint='http://127.0.0.1:8081/v2/check'}={}) {
  const url=new URL(endpoint);
  if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!url.port||url.pathname!=='/v2/check'||url.search||url.hash||url.username||url.password)throw new TypeError('Loopback LanguageTool endpoint required');
  return languageToolAdapter(async(text,language,signal)=>{
    const timeout=AbortSignal.timeout(TIMEOUT);
    const response=await fetch(url,{method:'POST',body:new URLSearchParams({text,language:language==='en'?'en-US':'fa'}),redirect:'error',credentials:'omit',cache:'no-store',signal:signal?AbortSignal.any([signal,timeout]):timeout});
    if(!response.ok||!response.body)throw new Error('LanguageTool unavailable');
    const reader=response.body.getReader(), chunks=[];let bytes=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_RESPONSE)throw new Error('Output limit');chunks.push(value);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
    finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  });
}
