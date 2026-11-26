import {createAdaptiveReview} from '../src/adaptive-review.mjs';
import {readPreferences,writePreferences,removePreferences} from './preference-storage.mjs';
import {buildDemoSnapshot} from './regions.mjs';
import {buildResearchSnapshot} from './routing-v2.mjs';
const el=id=>document.getElementById(id);
const prose=el('prose'),status=el('status'),findings=el('findings'),run=el('run'),cancel=el('cancel'),details=el('details');
const v2=el('routing-v2'),literals=el('host-literals'),mode=el('routing-mode');
let worker=null,timer,revision=0;
let adaptive=createAdaptiveReview();
const learn=el('learn-local'),remember=el('remember-local'),forget=el('forget-local'),learnStatus=el('learn-status'),lexicon=el('lexicon-local');
learn.checked=false;remember.checked=false;remember.disabled=true;lexicon.checked=false;
function clearSaved(){try{removePreferences(localStorage);return true;}catch{return false;}}
learn.onchange=()=>{
  adaptive.clear();remember.disabled=!learn.checked;remember.checked=false;
  if(!learn.checked)learnStatus.textContent=clearSaved()?'Preferences disabled and cleared.':'Session cleared; browser storage could not be cleared.';
  else learnStatus.textContent='Session-only preferences enabled.';
  reset();
};
remember.onchange=()=>{
  if(!learn.checked){remember.checked=false;return;}
  adaptive.invalidate();
  if(remember.checked){
    try{adaptive=readPreferences(localStorage);learnStatus.textContent='Saved preferences loaded; explicit votes are saved in this browser.';}
    catch{remember.checked=false;learnStatus.textContent='Saved profile unavailable or invalid. Use Clear preferences to remove it.';}
  }else{learnStatus.textContent=clearSaved()?'Saved profile deleted; session preferences retained.':'Browser storage could not be cleared.';}
  reset();
};
forget.onclick=()=>{adaptive.clear();learnStatus.textContent=clearSaved()?'Session and saved preferences cleared.':'Session cleared; browser storage could not be cleared.';reset();};
lexicon.onchange=()=>reset();
const labels={'unsafe-region':'Unsafe or mixed-script prose skipped','no-provider':'No language provider','budget-exhausted':'Execution budget reached','provider-timeout':'Provider timed out','provider-failed':'Provider failed','invalid-provider-result':'Invalid provider response','provider-limit':'Provider finding limit reached','rejected-finding':'Unsafe or invalid proposal rejected','finding-limit':'Global finding limit reached','invalid-region-map':'Invalid region map','engine-retired':'Engine retired'};
function reset(message='Ready for review. Language is detected automatically.'){
  adaptive.invalidate();++revision;worker?.terminate();worker=null;clearTimeout(timer);findings.replaceChildren();details.textContent='';status.textContent=message;run.disabled=false;cancel.disabled=true;
  document.documentElement.dataset.review='idle';
  delete document.documentElement.dataset.analysisStatus;
}

prose.oninput=()=>reset();cancel.onclick=()=>reset('Review cancelled.');
function syncRoutingMode(){literals.disabled=!v2.checked;mode.textContent=v2.checked?'Active mode: Routing V2 · qualification preview':'Active mode: Legacy Alpha 7 · comparison only';document.documentElement.dataset.routing=v2.checked?'v2':'legacy';}
v2.checked=true;syncRoutingMode();
v2.onchange=()=>{syncRoutingMode();reset();};literals.oninput=()=>reset();
function finish(result,plan){
  const state=(plan.skipped||plan.suspectedRanges)&&result.status==='complete'?'partial':result.status;
  const session=learn.checked&&['complete','partial'].includes(result.status)?adaptive.prepare(plan.document,result):null;
  const groups=new Map();
  for(const f of result.findings){
    const key=JSON.stringify([f.start,f.end,f.provider,f.rule,f.category]);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(f);
  }
  const shown=session?session.groups.map(g=>g.candidates.map(c=>c.finding)):[...groups.values()];
  for(const [groupIndex,group] of shown.entries()){
    const f=group[0];
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
    item.append(pair,message);
    function feedback(parent,candidateIndex){
      if(!session?.groups[groupIndex]?.candidates[candidateIndex]?.learnable)return;
      const controls=document.createElement('div');controls.className='feedback-controls';
      for(const [decision,label] of [['prefer','Prefer next time'],['reject','Rank lower next time']]){
        const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=label;b.onclick=()=>{
          if(session.record(groupIndex,candidateIndex,decision)){learnStatus.textContent='Preference recorded for later reviews. Text unchanged.';if(remember.checked){try{writePreferences(localStorage,adaptive);}catch{remember.checked=false;const cleared=clearSaved();learnStatus.textContent=cleared?'Preference recorded in memory; saving failed and old profile was cleared.':'Preference recorded in memory; saving and clearing old profile failed.';}}for(const control of item.querySelectorAll('.feedback-controls button'))control.disabled=true;}
        };controls.append(b);
      }
      parent.append(controls);
    }
    feedback(item,0);
    if(group.length>1){
      const alternatives=document.createElement('details');
      const summary=document.createElement('summary');
      summary.textContent=(group.length-1)+' alternative(s) — review only';
      alternatives.append(summary);
      for(const [i,other] of group.slice(1).entries()){
        if(other.replacement===undefined)continue;
        const alternative=document.createElement('div');alternative.className='finding-pair';alternative.dir='ltr';
        alternative.append(term(other.original,'original'),document.createTextNode(' → '),term(other.replacement,'replacement'));
        alternatives.append(alternative);feedback(alternatives,i+1);
      }
      item.append(alternatives);
    }
    findings.append(item);
  }
  status.textContent=!plan.languages.length?'No eligible prose reviewed — not a clean result.':state+': '+shown.length+' review issue(s); '+result.findings.length+' candidate(s).';
  const languages=plan.languages.map(x=>x==='fa'?'Persian':'English').join(', ')||'None';
  const reasons=[...new Set(result.diagnostics.map(x=>(labels[x.code]||'Reduced review coverage')+(x.provider?' ('+x.provider+')':'')))];
  details.textContent='Detected language: '+languages+'. '+(plan.experimental?'Experimental V2: explicit names and conservative token quarantine; unclassified tokens skipped: '+plan.skipped+'. Suspected name ranges quarantined: '+(plan.suspectedRanges??0)+'.':'Protected inline ranges: '+plan.inlineProtected+'. Inferred identifier ranges: '+plan.inferredProtected+'. Unclassified regions skipped: '+plan.skipped+'.')+(Number.isSafeInteger(plan.reviewedUnits)?' Prose routed for review: '+plan.reviewedUnits+'/'+plan.totalUnits+' non-whitespace UTF-16 units (includes protected data in denominator).':'')+(plan.coverage?' Recognized patterns / supplied names: '+plan.coverage.recognized+'; suspected name units: '+plan.coverage.suspected+'; other unreviewed units (including separators): '+plan.coverage.unreviewed+'.':'')+(lexicon.checked&&plan.languages.includes('fa')?' Optional Lilak root dictionary enabled; short unknown words and recognized suffix forms are skipped. Other inflections and names may still produce false positives.':'')+(reasons.length?' '+reasons.join('; ')+'.':'')+(!plan.languages.length?' No eligible prose was reviewed.':'');
  document.documentElement.dataset.analysisStatus=state;
  document.documentElement.dataset.review='complete';
}
run.onclick=()=>{
  reset('Preparing local language providers…');
  const token=revision,input=prose.value,protectedText=el('protected').textContent;
  if(!input.trim()){status.textContent='Enter synthetic prose first.';return;}
  let plan;
  try{
    if(v2.checked){
      const hostLiterals=[...new Set(literals.value.split(/\r?\n/u).map(x=>x.trim()).filter(Boolean))];
      plan={...buildResearchSnapshot(input,protectedText,'demo:'+token,{hostLiterals}),experimental:true,totalUnits:input.replace(/\s/gu,'').length};
    }else plan=buildDemoSnapshot(input,protectedText,'demo:'+token);
  }catch{reset('Invalid input or region map.');document.documentElement.dataset.review='error';return;}
  if(!plan.languages.length){finish({status:'complete',findings:[],diagnostics:[]},plan);return;}
  run.disabled=true;cancel.disabled=false;
  function fail(){if(token===revision){reset('Local provider unavailable or timed out.');document.documentElement.dataset.review='error';}}
  try{
    worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{
      if(token!==revision||input!==prose.value)return;
      if(!data.ok||data.report.snapshotId!==plan.document.snapshotId||data.report.apply!==false){fail();return;}
      worker?.terminate();worker=null;clearTimeout(timer);run.disabled=false;cancel.disabled=true;
      try{finish(data.report,plan);}catch{fail();}
    };
    worker.onerror=fail;worker.onmessageerror=fail;timer=setTimeout(fail,60000);
    worker.postMessage({document:plan.document,lexicon:lexicon.checked});
  }catch{fail();}
};
