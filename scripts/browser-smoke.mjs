import { chromium,webkit,firefox } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve,sep,extname } from 'node:path';
import assert from 'node:assert/strict';
import {cases,locked,extendedCases,alpha7Cases} from '../test/acceptance-fixtures.mjs';
const root=resolve('dist/demo');
const candidates=[process.env.PWE_CHROME,process.env.CHROME_PATH,process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/chromium',process.env.ProgramFiles&&`${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,process.env['ProgramFiles(x86)']&&`${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`];
const executablePath=candidates.find(p=>p&&existsSync(p));
const browserName=process.env.PWE_BROWSER??'chromium';
const browserType={chromium,webkit,firefox}[browserName];
assert.ok(browserType,'Unsupported PWE_BROWSER');
if(browserName==='chromium')assert.ok(executablePath,'Install Chromium/Chrome or set PWE_CHROME. No browser is downloaded silently.');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1');const path=resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!path.startsWith(root+sep)||!(await stat(path)).isFile())throw Error();res.writeHead(200,{'Content-Type':mime[extname(path)]??'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
let browser;
try{
  const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await browserType.launch({headless:true,...(browserName==='chromium'?{executablePath,args:process.platform==='linux'&&process.getuid?.()===0?['--no-sandbox']:[]}: {})});
  const context=await browser.newContext({serviceWorkers:'block'});
  const external=[];await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.protocol==='data:'||url.protocol==='blob:'||url.origin===origin)return route.continue();external.push(url.origin);return route.abort();});
  const page=await context.newPage();
  await page.goto(origin);
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(await page.locator('#demo-version').innerText(),pkg.version+' · LOCAL DEMO','Demo version must match package.json');

  assert.equal(await page.locator('#neural-start').isDisabled(),true);
  assert.equal(await page.locator('#neural-protocol').inputValue(),'sentence');
  assert.equal(await page.locator('#neural-baseline').isEnabled(),true);
  assert.equal(await page.locator('#neural-consent').isChecked(),false);
  assert.match(await page.locator('#neural-status').innerText(),/Not started/);
  await page.locator('#neural-consent').check();
  assert.equal(await page.locator('#neural-start').isEnabled(),true);
  await page.locator('#neural-consent').uncheck();
  assert.equal(await page.locator('#neural-start').isDisabled(),true);
  assert.deepEqual(external,[],'No external requests before explicit start');
  await page.locator('#neural-baseline').click();
  await page.waitForFunction(()=>document.querySelector('#neural-status').textContent.startsWith('Lightweight benchmark completed.'),{},{timeout:90000});
  assert.equal(await page.locator('#neural-output .neural-case').count(),5);
  assert.match(await page.locator('#neural-output').innerText(),/Lightweight baseline: exact matches 4\/4; missed 0; unexpected 0; incomplete cases 0\./);
  assert.deepEqual(external,[],'Baseline-only run must not fetch third-party model assets');
  // Fresh load MUST exercise V2 without selecting any option.
  assert.equal(await page.locator('#routing-v2').isChecked(),true);
  assert.equal(await page.locator('html').getAttribute('data-routing'),'v2');
  assert.ok((await page.locator('#routing-mode').innerText()).includes('Routing V2'));
  const previewCases=[
    {id:'engineering',text:'Please chek availability of 2-inch SS316L valves, 150# flange, 0–100°C, 24 VDC, IP67 and IEC 60529.',pairs:['chek → check'],protected:['2-inch','SS316L','150#','0–100°C','24 VDC','IP67','IEC 60529']},
    {id:'finance',text:'Please confim the total price of EUR 12,450.75, payment terms of 30% T/T and delivery under FCA Hamburg Incoterms 2020.',pairs:['confim → confirm'],protected:['EUR 12,450.75','30% T/T','FCA Hamburg','Incoterms 2020']},
    {id:'mixed',text:'لطفا قیمت تجهیز Yokogawa EJA110E را اعلام کنید. The manufacturer have recieved our RFQ.',pairs:['لطفا → لطفاً','recieved → received','have → has'],protected:['Yokogawa','EJA110E','RFQ']}
  ];
  for(const c of previewCases){
    await page.locator('#prose').fill(c.text);await page.locator('#run').click();
    await page.waitForFunction(()=>['complete','error'].includes(document.documentElement.dataset.review),{},{timeout:90000});
    assert.equal(await page.locator('html').getAttribute('data-review'),'complete',c.id);
    const pairs=await page.locator('#findings .finding-pair').allTextContents();
    for(const expected of c.pairs)assert.ok(pairs.includes(expected),c.id+' '+JSON.stringify(pairs));
    for(const token of c.protected)assert.ok(pairs.every(pair=>!pair.includes(token)),c.id+' '+token);
    assert.ok((await page.locator('#details').innerText()).includes('Experimental V2'),c.id);
    assert.equal(await page.locator('#prose').inputValue(),c.text);
    assert.equal(await page.locator('#protected').innerText(),locked);
    console.log('Default V2 screenshot regression: '+c.id+' PASS');
  }
  assert.equal(await page.locator('#learn-local').isChecked(),false);
  await page.locator('#learning-options summary').click();
  await page.locator('#learn-local').check();
  for(let round=0;round<2;round++){
    await page.locator('#prose').fill('Please chek the quotation.');
    await page.locator('#run').click();
    await page.waitForFunction(()=>document.documentElement.dataset.review==='complete',{},{timeout:90000});
    await page.locator('#findings li').first().getByRole('button',{name:'Rank lower next time'}).first().click();
    assert.match(await page.locator('#learn-status').innerText(),/Preference recorded/);
    assert.equal(await page.locator('#prose').inputValue(),'Please chek the quotation.');
  }
  await page.locator('#forget-local').click();
  assert.match(await page.locator('#learn-status').innerText(),/cleared/);
  await page.locator('#learn-local').uncheck();
  assert.equal(await page.locator('#findings li').count(),0);
  await page.locator('#learning-options summary').click();
  // Optional dictionary is loaded only after selection; same-origin assets only.
  assert.equal(await page.locator('#lexicon-local').isChecked(),false);
  await page.locator('#lexicon-options summary').click();
  await page.locator('#lexicon-local').check();
  await page.locator('#prose').fill('مشخسات');
  await page.locator('#run').click();
  await page.waitForFunction(()=>['complete','error'].includes(document.documentElement.dataset.review),{},{timeout:90000});
  assert.equal(await page.locator('html').getAttribute('data-review'),'complete');
  assert.ok((await page.locator('#findings .finding-pair').allTextContents()).includes('مشخسات → مشخصات'));
  assert.match(await page.locator('#details').innerText(),/Lilak root dictionary enabled/);
  // User screenshot regression: correct short word must not become فین.
  await page.locator('#prose').fill('لطفا مشخسات فنی و قیمت تجیهزات را مجددا ارسال کنید.');
  await page.locator('#run').click();
  await page.waitForFunction(()=>['complete','error'].includes(document.documentElement.dataset.review),{},{timeout:90000});
  assert.equal(await page.locator('html').getAttribute('data-review'),'complete');
  const screenshotPairs=await page.locator('#findings .finding-pair').allTextContents();
  for(const p of ['لطفا → لطفاً','مشخسات → مشخصات','تجیهزات → تجهیزات','مجددا → مجدداً'])assert.ok(screenshotPairs.includes(p),JSON.stringify(screenshotPairs));
  assert.ok(screenshotPairs.every(p=>!p.startsWith('فنی → ')),JSON.stringify(screenshotPairs));
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.locator('#findings').evaluate(e=>getComputedStyle(e).listStyleType),'none');
  assert.ok(await page.locator('#findings .finding-pair').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)));
  await page.setViewportSize({width:1280,height:720});
  await page.locator('#prose').fill('احتراما به استحضار می رساند، لطفا پیش فاکتور را در اسرع وقت ارسال فرمایید.');
  await page.locator('#run').click();
  await page.waitForFunction(()=>['complete','error'].includes(document.documentElement.dataset.review),{},{timeout:90000});
  const formalPairs=await page.locator('#findings .finding-pair').allTextContents();
  for(const p of ['احتراما → احتراماً','می رساند، → می‌رساند،','لطفا → لطفاً','پیش فاکتور → پیش‌فاکتور'])assert.ok(formalPairs.includes(p),JSON.stringify(formalPairs));

  assert.deepEqual(external,[]);
  await page.locator('#lexicon-local').uncheck();
  await page.locator('#lexicon-options summary').click();
  // Simulate optional dictionary worker failure on first attempt. The base
  // engine must retry without it, preserve input, and label coverage partial.
  await page.evaluate(()=>{
    const NativeWorker=window.Worker;
    window.Worker=class extends NativeWorker{
      postMessage(data,...rest){
        if(data?.lexicon===true){
          queueMicrotask(()=>this.dispatchEvent(new ErrorEvent('error')));
          return;
        }
        super.postMessage(data,...rest);
      }
    };
  });
  await page.locator('#lexicon-options summary').click();
  await page.locator('#lexicon-local').check();
  await page.locator('#prose').fill('لطفا مجددا ارسال کنید.');
  await page.locator('#run').click();
  await page.waitForFunction(()=>['complete','error'].includes(document.documentElement.dataset.review),{},{timeout:90000});
  assert.equal(await page.locator('html').getAttribute('data-review'),'complete');
  assert.equal(await page.locator('html').getAttribute('data-analysis-status'),'partial');
  assert.match(await page.locator('#details').innerText(),/Persian dictionary unavailable.*Base review only/);
  assert.ok((await page.locator('#findings .finding-pair').allTextContents()).includes('لطفا → لطفاً'));
  assert.equal(await page.locator('#prose').inputValue(),'لطفا مجددا ارسال کنید.');
  await page.reload();
  // Persistence requires explicit opt-in and a genuine vote.
  await page.locator('#learning-options summary').click();
  await page.locator('#learn-local').check();
  await page.locator('#remember-local').check();
  await page.locator('#prose').fill('Please chek the quotation.');
  await page.locator('#run').click();
  await page.waitForFunction(()=>document.documentElement.dataset.review==='complete',{},{timeout:90000});
  await page.locator('#findings li').first().getByRole('button',{name:'Prefer next time'}).first().click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('pwe:synthetic-demo:preferences:v1')));
  assert.equal(saved.records.length,1);
  await page.reload();
  assert.equal(await page.locator('#learn-local').isChecked(),false);
  await page.locator('#learning-options summary').click();
  await page.locator('#learn-local').check();
  await page.locator('#remember-local').check();
  assert.match(await page.locator('#learn-status').innerText(),/Saved preferences loaded/);
  await page.locator('#forget-local').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('pwe:synthetic-demo:preferences:v1')),null);
  await page.locator('#learn-local').uncheck();
  await page.locator('#learning-options summary').click();
  // Preserve the existing legacy comparator suite with an explicit switch.
  await page.locator('#routing-options summary').click();
  await page.locator('#routing-v2').uncheck();
  assert.equal(await page.locator('html').getAttribute('data-routing'),'legacy');
  await page.locator('#routing-options summary').click();
  await page.locator('#prose').fill('Please send teh quotation as soon as possible.');

  await page.locator('#run').click();
  await page.waitForFunction(()=>['complete','error'].includes(document.documentElement.dataset.review),{},{timeout:90000});
  assert.equal(await page.locator('html').getAttribute('data-review'),'complete');
  assert.match(await page.locator('#findings').innerText(),/teh\s*→\s*the/i);
  assert.match(await page.locator('#findings').innerText(),/as soon as possible/i);
  assert.equal(await page.locator('#protected').innerText(),'Rosemount 3051 — 3 PCS — 4–20 mA');
  assert.equal(await page.locator('#en,#fa').count(),0,'Language sample selectors removed');
  await page.locator('#prose').fill('فارسي را كمی درست تر می نويسيم');await page.locator('#run').click();
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
    const pairs=await page.locator('#findings .finding-pair').allTextContents();
    const details=await page.locator('#details').innerText();
    assert.ok(details.includes('Detected language: '+(c.language==='fa'?'Persian':'English')),c.id+' '+details);
    assert.equal(await page.locator('#prose').inputValue(),c.text,c.id);
    assert.equal(await page.locator('#protected').innerText(),locked,c.id);
    for(const [original,replacement] of c.pairs??[])assert.ok(pairs.includes(original+' → '+replacement),c.id+' '+findings);
    if(c.first){const alternatives=pairs.filter(x=>x.startsWith(c.first[0]+' → '));assert.equal(alternatives[0],c.first[0]+' → '+c.first[1],c.id);}
    if(c.message)assert.ok(findings.includes(c.message),c.id);
    if(c.browserNeed)assert.ok(findings.includes(c.browserNeed),c.id+' '+findings);
    if(c.language==='fa'&&!c.clean){
      const directions=await page.locator('#findings bdi').evaluateAll(nodes=>nodes.map(n=>({dir:n.dir,css:getComputedStyle(n).direction,isolate:getComputedStyle(n).unicodeBidi})));
      assert.ok(directions.length&&directions.every(x=>x.dir==='rtl'&&x.css==='rtl'&&x.isolate==='isolate'),c.id);
      assert.ok(await page.locator('#findings .finding-message').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).direction==='ltr')),c.id);
    }
    if(c.id==='fa-halfspace')assert.deepEqual(pairs,['می کنیم → می‌کنیم','می کنیم. → می‌کنیم.']);
    if(c.inferred)assert.ok(details.includes('Inferred identifier ranges: '+c.inferred+'.'),c.id);
    if(c.clean){assert.equal(await page.locator('html').getAttribute('data-analysis-status'),'complete',c.id+' '+details+' '+await page.locator('#status').innerText());assert.equal(await page.locator('#findings li').count(),0,c.id);}
    if(c.protected)assert.ok(details.includes('Protected inline ranges: '+c.protected.length+'.'),c.id+' '+details);
    for(const token of c.protected??[])assert.ok(!findings.includes(token),c.id);
    console.log('Browser acceptance: '+c.id+' PASS');
  }
  for(const c of [...extendedCases,...alpha7Cases]){
    await page.locator('#prose').fill(c.text);await page.locator('#run').click();
    await page.waitForFunction(()=>['complete','error'].includes(document.documentElement.dataset.review),{},{timeout:90000});
    assert.equal(await page.locator('html').getAttribute('data-review'),'complete',c.id);
    const pairs=await page.locator('#findings .finding-pair').allTextContents();
    const details=await page.locator('#details').innerText();
    for(const language of c.languages)assert.ok(details.includes(language==='fa'?'Persian':'English'),details);
    for(const [original,replacement] of c.pairs)assert.ok(pairs.includes(original+' → '+replacement),c.id+' '+pairs);
    if(c.first)assert.equal(pairs.find(x=>x.startsWith(c.first[0]+' → ')),c.first.join(' → '));
    if(c.clean||c.noReplacement)assert.equal(pairs.length,0,c.id);
    if(c.id.startsWith('a7-'))assert.ok(details.includes('Unclassified regions skipped: 0.'),c.id+' '+details);
    if(c.expectedText){for(const word of ['ترجیحاً','ضمناً','پیش‌فاکتور','قبلاً'])assert.ok(pairs.some(p=>p.split(' → ')[1]?.includes(word)),word);}
    if(c.id==='standard')assert.equal(await page.locator('#findings li').count(),1);
    for(const token of c.protected??[])assert.ok(!pairs.some(x=>x.includes(token)),token);
    assert.equal(await page.locator('#prose').inputValue(),c.text);
    assert.equal(await page.locator('#protected').innerText(),locked);
    console.log('Browser extended acceptance: '+c.id+' PASS');
  }
  // Opt-in V2: real providers, explicit synthetic host names, no auto-apply.
  await page.locator('#routing-options summary').click();
  await page.locator('#routing-v2').check();
  await page.locator('#host-literals').fill('Baker Hughes\nBürkert');
  await page.locator('#prose').fill('Please chek the Baker Hughes quotation for EUR 12,450.75. لطفا قیمت تجهیز Bürkert را اعلام کنید.');
  await page.locator('#run').click();
  await page.waitForFunction(()=>['complete','error'].includes(document.documentElement.dataset.review),{},{timeout:90000});
  assert.equal(await page.locator('html').getAttribute('data-review'),'complete');
  const v2Pairs=await page.locator('#findings .finding-pair').allTextContents();
  assert.ok(v2Pairs.includes('chek → check'),JSON.stringify(v2Pairs));
  assert.ok(v2Pairs.some(x=>x.includes('لطفا')&&x.includes('لطفاً')),JSON.stringify(v2Pairs));
  assert.ok(v2Pairs.every(x=>!x.includes('Baker Hughes')&&!x.includes('Bürkert')&&!x.includes('12,450.75')));
  assert.ok((await page.locator('#details').innerText()).includes('Experimental V2'));
  assert.equal(await page.locator('#protected').innerText(),locked);

  // No catalog: name candidates must be quarantined without inventing a brand match.
  await page.locator('#host-literals').fill('');
  await page.locator('#prose').fill('Please chek the Rotork offer. لطفا قیمت Swagelok را اعلام کنید.');
  await page.locator('#run').click();
  await page.waitForFunction(()=>['complete','error'].includes(document.documentElement.dataset.review),{},{timeout:90000});
  assert.equal(await page.locator('html').getAttribute('data-review'),'complete');
  const novelPairs=await page.locator('#findings .finding-pair').allTextContents();
  assert.ok(novelPairs.includes('chek → check'),JSON.stringify(novelPairs));
  assert.ok(novelPairs.some(x=>x.includes('لطفا')&&x.includes('لطفاً')),JSON.stringify(novelPairs));
  assert.ok(novelPairs.every(x=>!x.includes('Rotork')&&!x.includes('Swagelok')));
  assert.match(await page.locator('#details').innerText(),/Suspected name ranges quarantined: [1-9]/);
  assert.equal(await page.locator('html').getAttribute('data-analysis-status'),'partial');
  console.log('Catalog-free suspected name quarantine: PASS');

  // Exact user regression: conjunction changes must not expose a possible name.
  await page.locator('#prose').fill('لطفا قیمت Swagelok و مبلغ ۳۵ میلیون ریال را اعلام کنید.');
  await page.locator('#run').click();
  await page.waitForFunction(()=>['complete','error'].includes(document.documentElement.dataset.review),{},{timeout:90000});
  assert.equal(await page.locator('html').getAttribute('data-review'),'complete');
  const islandPairs=await page.locator('#findings .finding-pair').allTextContents();
  assert.ok(islandPairs.includes('لطفا → لطفاً'),JSON.stringify(islandPairs));
  assert.ok(islandPairs.every(x=>!x.includes('Swagelok')&&!x.includes('۳۵ میلیون ریال')));
  assert.match(await page.locator('#details').innerText(),/Suspected name ranges quarantined: [1-9]/);
  assert.equal(await page.locator('html').getAttribute('data-analysis-status'),'partial');
  console.log('Embedded Latin singleton regression: PASS');

  await page.locator('#routing-v2').uncheck();
  console.log('Experimental routing V2 real provider smoke: PASS');
  await page.locator('#prose').fill('Please send teh quotation.');await page.locator('#run').click();await page.locator('#cancel').click();
  assert.equal(await page.locator('html').getAttribute('data-review'),'idle');
  assert.equal(await page.locator('#findings li').count(),0);
  await page.locator('#prose').fill('Please send teh quotation.');await page.locator('#run').click();await page.locator('#prose').fill('A different sentence.');
  assert.equal(await page.locator('html').getAttribute('data-review'),'idle');
  assert.equal(await page.locator('#findings li').count(),0);
  assert.deepEqual(external,[],'Unexpected external browser traffic');
  console.log('Real browser provider/worker smoke: PASS');
}finally{await browser?.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
