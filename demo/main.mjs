const el=id=>document.getElementById(id);
const prose=el('prose'),status=el('status'),findings=el('findings'),run=el('run'),cancel=el('cancel');
let language='en', worker=null, timer, revision=0;
function reset(message='Ready for review.'){
  ++revision;worker?.terminate();worker=null;clearTimeout(timer);findings.replaceChildren();status.textContent=message;run.disabled=false;cancel.disabled=true;
  document.documentElement.dataset.review='idle';
}
function sample(lang,text){reset();language=lang;prose.value=text;}
el('en').onclick=()=>sample('en','Please send teh quotation as soon as possible.');
el('fa').onclick=()=>sample('fa','فارسي را كمی درست تر می نويسيم');
prose.oninput=()=>reset();cancel.onclick=()=>reset('Review cancelled.');
run.onclick=()=>{
  reset('Loading local language provider…');
  const token=revision, input=prose.value, protectedText=el('protected').textContent;
  if(!input.trim()){status.textContent='Enter synthetic prose first.';return;}
  const prefix=input+'\n';const text=prefix+protectedText;
  const documentSnapshot={text,snapshotId:`demo:${token}`,regions:[{start:0,end:prefix.length,kind:'prose',language},{start:prefix.length,end:text.length,kind:'protected'}]};
  run.disabled=true;cancel.disabled=false;
  function fail(){if(token===revision){reset('Local provider unavailable or timed out.');document.documentElement.dataset.review='error';}}
  try{
    worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{
      if(token!==revision||input!==prose.value)return;
      if(!data.ok||data.report.snapshotId!==documentSnapshot.snapshotId||data.report.apply!==false){fail();return;}
      worker?.terminate();worker=null;clearTimeout(timer);run.disabled=false;cancel.disabled=true;
      for(const f of data.report.findings){const item=document.createElement('li');item.textContent=`${f.original}${f.replacement===undefined?'':` → ${f.replacement}`} — ${f.message} [${f.provider}]`;findings.append(item);}
      status.textContent=`${data.report.status}: ${data.report.findings.length} review suggestion(s).`;
      document.documentElement.dataset.review='complete';
    };
    worker.onerror=fail;worker.onmessageerror=fail;timer=setTimeout(fail,60000);
    worker.postMessage({language,document:documentSnapshot});
  }catch{fail();}
};
