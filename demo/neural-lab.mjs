import {corpus,models} from './neural-fixtures.mjs';
const el=id=>document.getElementById(id);
const start=el('neural-start'),stop=el('neural-stop'),status=el('neural-status'),output=el('neural-output'),consent=el('neural-consent'),model=el('neural-model'),device=el('neural-device');
let worker=null,timer=null,revision=0;
function finish(message){
  revision++;worker?.terminate();worker=null;clearTimeout(timer);timer=null;
  start.disabled=!consent.checked;stop.disabled=true;model.disabled=false;device.disabled=false;consent.disabled=false;status.textContent=message;
}
consent.checked=false;start.disabled=true;
consent.onchange=()=>{start.disabled=!consent.checked||!!worker;};
stop.onclick=()=>finish('Cancelled. The experimental worker was terminated.');
start.onclick=()=>{
  if(worker||!consent.checked||!Object.hasOwn(models,model.value)||!['webgpu','wasm'].includes(device.value))return;
  output.replaceChildren();start.disabled=true;stop.disabled=false;model.disabled=true;device.disabled=true;consent.disabled=true;
  const token=++revision;
  status.textContent='Initializing experimental worker…';
  try{
    worker=new Worker(new URL('./neural-lab-worker.mjs',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{
      if(token!==revision||!data)return;
      if(data.type==='progress'){status.textContent=String(data.message);return;}
      if(data.type==='error'){finish('Blocked at '+data.stage+': '+data.message);return;}
      if(data.type==='case'){
        const fixture=corpus.find(c=>c.id===data.id);if(!fixture)return;
        const item=document.createElement('div');item.className='neural-case';
        const title=document.createElement('strong');title.textContent=fixture.id+' — '+data.status+' ('+data.ms+' ms)';
        const text=document.createElement('p');text.dir='auto';text.textContent=fixture.text;
        const expected=document.createElement('p');expected.dir='auto';expected.textContent='Expected: '+(fixture.expected.map(x=>x.join(' → ')).join(' | ')||'no edits');
        const result=document.createElement('p');result.dir='auto';result.textContent='Accepted model proposals: '+(data.findings.map(f=>f.original+' → '+f.replacement).join(' | ')||'none');
        const score=document.createElement('p');score.textContent='Exact matches: '+data.score.matched+' · Missed: '+data.score.missing+' · Unexpected: '+data.score.unexpected;
        item.append(title,text,expected,result,score);output.append(item);return;
      }
      if(data.type==='done'){
        finish('Completed fixed corpus — '+data.model+' · '+data.device+' · '+data.dtype+' · load '+data.loadMs+' ms. Exact matches: '+data.total.matched+'/4; missed: '+data.total.missing+'; unexpected: '+data.total.unexpected+'; blocked cases: '+data.total.blocked+'. Not a production quality score.');
      }
    };
    worker.onerror=()=>{if(token===revision)finish('Experimental worker failed to load.');};
    worker.onmessageerror=()=>{if(token===revision)finish('Invalid worker response.');};
    timer=setTimeout(()=>{if(token===revision)finish('Experiment exceeded its resource time limit; worker terminated.');},900000);
    worker.postMessage({model:model.value,device:device.value});
  }catch{finish('Experimental worker could not be started.');}
};
