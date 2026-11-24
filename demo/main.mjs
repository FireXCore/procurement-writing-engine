import {buildDemoSnapshot} from './regions.mjs';
const el=id=>document.getElementById(id);
const prose=el('prose'),status=el('status'),findings=el('findings'),run=el('run'),cancel=el('cancel'),details=el('details');
let worker=null,timer,revision=0;
const labels={'unsafe-region':'Unsafe or mixed-script prose skipped','no-provider':'No language provider','budget-exhausted':'Execution budget reached','provider-timeout':'Provider timed out','provider-failed':'Provider failed','invalid-provider-result':'Invalid provider response','provider-limit':'Provider finding limit reached','rejected-finding':'Unsafe or invalid proposal rejected','finding-limit':'Global finding limit reached','invalid-region-map':'Invalid region map','engine-retired':'Engine retired'};
function reset(message='Ready for review. Language is detected automatically.'){
  ++revision;worker?.terminate();worker=null;clearTimeout(timer);findings.replaceChildren();details.textContent='';status.textContent=message;run.disabled=false;cancel.disabled=true;
  document.documentElement.dataset.review='idle';
  delete document.documentElement.dataset.analysisStatus;
}

prose.oninput=()=>reset();cancel.onclick=()=>reset('Review cancelled.');
function finish(result,plan){
  const state=plan.skipped&&result.status==='complete'?'partial':result.status;
  for(const f of result.findings){
    const language=plan.document.regions.find(r=>r.kind==='prose'&&f.start>=r.start&&f.end<=r.end)?.language;
    const item=document.createElement('li'),pair=document.createElement('div');
    item.dir='ltr';pair.className='finding-pair';pair.dir='ltr';
    function term(value,kind){
      const node=document.createElement('bdi');node.className='finding-'+kind;node.dir=language==='fa'?'rtl':'ltr';node.lang=language??'en';
      node.textContent=value;node.setAttribute('aria-label',kind+': '+(value||'empty'));return node;
    }
    pair.append(term(f.original,'original'));
    if(f.replacement!==undefined){
      const arrow=document.createElement('span');arrow.className='finding-arrow';arrow.dir='ltr';arrow.textContent=' → ';arrow.setAttribute('aria-hidden','true');
      pair.append(arrow,term(f.replacement,'replacement'));
    }
    const message=document.createElement('div');message.className='finding-message';message.dir='ltr';message.textContent=f.message+' ['+f.provider+']';
    item.append(pair,message);findings.append(item);
  }
  status.textContent=state+': '+result.findings.length+' review suggestion(s).';
  const languages=plan.languages.map(x=>x==='fa'?'Persian':'English').join(', ')||'None';
  const reasons=[...new Set(result.diagnostics.map(x=>(labels[x.code]||'Reduced review coverage')+(x.provider?' ('+x.provider+')':'')))];
  details.textContent='Detected language: '+languages+'. Protected inline ranges: '+plan.inlineProtected+'. Inferred identifier ranges: '+plan.inferredProtected+'. Unclassified regions skipped: '+plan.skipped+'.'+(reasons.length?' '+reasons.join('; ')+'.':'')+(!plan.languages.length?' No eligible prose was reviewed.':'');
  document.documentElement.dataset.analysisStatus=state;
  document.documentElement.dataset.review='complete';
}
run.onclick=()=>{
  reset('Preparing local language providers…');
  const token=revision,input=prose.value,protectedText=el('protected').textContent;
  if(!input.trim()){status.textContent='Enter synthetic prose first.';return;}
  let plan;
  try{plan=buildDemoSnapshot(input,protectedText,'demo:'+token);}catch{reset('Invalid input or region map.');document.documentElement.dataset.review='error';return;}
  if(!plan.languages.length){finish({status:'complete',findings:[],diagnostics:[]},plan);return;}
  run.disabled=true;cancel.disabled=false;
  function fail(){if(token===revision){reset('Local provider unavailable or timed out.');document.documentElement.dataset.review='error';}}
  try{
    worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{
      if(token!==revision||input!==prose.value)return;
      if(!data.ok||data.report.snapshotId!==plan.document.snapshotId||data.report.apply!==false){fail();return;}
      worker?.terminate();worker=null;clearTimeout(timer);run.disabled=false;cancel.disabled=true;
      finish(data.report,plan);
    };
    worker.onerror=fail;worker.onmessageerror=fail;timer=setTimeout(fail,60000);
    worker.postMessage({document:plan.document});
  }catch{fail();}
};
