import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve,sep,extname } from 'node:path';
import assert from 'node:assert/strict';
import {cases,locked} from '../test/acceptance-fixtures.mjs';
const root=resolve('dist/demo');
const candidates=[process.env.PWE_CHROME,process.env.CHROME_PATH,process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/chromium',process.env.ProgramFiles&&`${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,process.env['ProgramFiles(x86)']&&`${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`];
const executablePath=candidates.find(p=>p&&existsSync(p));
assert.ok(executablePath,'Install Chromium/Chrome or set PWE_CHROME. No browser is downloaded silently.');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1');const path=resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!path.startsWith(root+sep)||!(await stat(path)).isFile())throw Error();res.writeHead(200,{'Content-Type':mime[extname(path)]??'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
let browser;
try{
  const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({executablePath,headless:true,args:process.platform==='linux'&&process.getuid?.()===0?['--no-sandbox']:[]});
  const context=await browser.newContext({serviceWorkers:'block'});
  const external=[];await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.protocol==='data:'||url.protocol==='blob:'||url.origin===origin)return route.continue();external.push(url.origin);return route.abort();});
  const page=await context.newPage();
  await page.goto(origin);
  await page.locator('#run').click();
  await page.waitForFunction(()=>['complete','error'].includes(document.documentElement.dataset.review),{},{timeout:90000});
  assert.equal(await page.locator('html').getAttribute('data-review'),'complete');
  assert.match(await page.locator('#findings').innerText(),/teh\s*→\s*the/i);
  assert.match(await page.locator('#findings').innerText(),/as soon as possible/i);
  assert.equal(await page.locator('#protected').innerText(),'Rosemount 3051 — 3 PCS — 4–20 mA');
  await page.locator('#fa').click();await page.locator('#run').click();
  await page.waitForFunction(()=>['complete','error'].includes(document.documentElement.dataset.review),{},{timeout:90000});
  assert.equal(await page.locator('html').getAttribute('data-review'),'complete');
  assert.match(await page.locator('#findings').innerText(),/فارسی|کمی/);
  assert.equal(await page.locator('#protected').innerText(),'Rosemount 3051 — 3 PCS — 4–20 mA');
  // Deliberately do not click a language sample before typing these fixtures.
  // The previous run was Persian; automatic routing must work in both directions.
  for(const c of cases){
    await page.locator('#prose').fill(c.text);
    await page.locator('#run').click();
    await page.waitForFunction(()=>['complete','error'].includes(document.documentElement.dataset.review),{},{timeout:90000});
    assert.equal(await page.locator('html').getAttribute('data-review'),'complete',c.id);
    const findings=await page.locator('#findings').innerText();
    const details=await page.locator('#details').innerText();
    assert.ok(details.includes('Detected language: '+(c.language==='fa'?'Persian':'English')),c.id+' '+details);
    assert.equal(await page.locator('#prose').inputValue(),c.text,c.id);
    assert.equal(await page.locator('#protected').innerText(),locked,c.id);
    for(const [original,replacement] of c.pairs??[])assert.ok(findings.includes(original+' → '+replacement),c.id+' '+findings);
    if(c.first){const alternatives=(await page.locator('#findings li').allTextContents()).filter(x=>x.startsWith(c.first[0]+' → '));assert.ok(alternatives[0]?.startsWith(c.first[0]+' → '+c.first[1]+' —'),c.id);}
    if(c.message)assert.ok(findings.includes(c.message),c.id);
    if(c.browserNeed)assert.ok(findings.includes(c.browserNeed),c.id+' '+findings);
    if(c.clean){assert.equal(await page.locator('html').getAttribute('data-analysis-status'),'complete',c.id);assert.equal(await page.locator('#findings li').count(),0,c.id);}
    if(c.protected)assert.ok(details.includes('Protected inline ranges: '+c.protected.length+'.'),c.id+' '+details);
    for(const token of c.protected??[])assert.ok(!findings.includes(token),c.id);
    console.log('Browser acceptance: '+c.id+' PASS');
  }
  await page.locator('#prose').fill('Please send teh quote for ABC999.');
  await page.locator('#run').click();
  assert.equal(await page.locator('html').getAttribute('data-analysis-status'),'partial');
  assert.match(await page.locator('#details').innerText(),/Unclassified regions skipped: 1/);
  await page.locator('#en').click();await page.locator('#run').click();await page.locator('#cancel').click();
  assert.equal(await page.locator('html').getAttribute('data-review'),'idle');
  assert.equal(await page.locator('#findings li').count(),0);
  await page.locator('#en').click();await page.locator('#run').click();await page.locator('#prose').fill('A different sentence.');
  assert.equal(await page.locator('html').getAttribute('data-review'),'idle');
  assert.equal(await page.locator('#findings li').count(),0);
  assert.deepEqual(external,[],'Unexpected external browser traffic');
  console.log('Real Chromium provider/worker smoke: PASS');
}finally{await browser?.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
