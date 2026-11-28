import {corpus,scoreCase} from './neural-fixtures.mjs';
import {firstCandidates} from './neural-diagnostics.mjs';
import {createEngine,createHarper,createVirastar,createTextlint,procurementPolicyRules} from '../src/index.mjs';

// Public build: fixed local benchmark only. No external imports or model fetches.
let started=false;
const report=(type,data={})=>self.postMessage({type,...data});
self.onmessage=async(event)=>{
  // Dedicated workers receive trusted parent messages with an empty origin.
  // If a browser supplies an origin, it must match this worker's origin.
  if(event.origin!==''&&event.origin!==self.location.origin)return;
  if(event.isTrusted!==true||event.source!==null)return;
  const {data}=event;
  if(started)return;started=true;
  let harper;
  try{
    if(!data||data.protocol!=='baseline')throw new Error('Remote runtime disabled');
    // Measure the existing lightweight reviewer independently on identical inputs.
    report('progress',{message:'Running lightweight baseline…'});
    let baseline={matched:0,missing:0,unexpected:0,blocked:0};
    try{
      const {binaryInlined}=await import('harper.js/binaryInlined');
      harper=await createHarper({binary:binaryInlined,worker:false});
      const engine=createEngine([harper.provider,await createTextlint(procurementPolicyRules),await createVirastar()]);
      for(const fixture of corpus){
        const before=performance.now();
        const result=await engine.analyze({text:fixture.text,snapshotId:fixture.id,regions:[{start:0,end:fixture.text.length,kind:'prose',language:fixture.language}]});
        const findings=firstCandidates(result.findings),score=scoreCase(fixture,findings);
        for(const k of ['matched','missing','unexpected'])baseline[k]+=score[k];
        if(result.status!=='complete')baseline.blocked++;
        report('baseline-case',{id:fixture.id,status:result.status,findings,score,ms:Math.round(performance.now()-before)});
      }
      report('baseline-done',{total:baseline});
    }catch{report('baseline-error');return;}
    finally{try{await harper?.dispose?.();}catch{}harper=null;}
    report('baseline-only-done');
  }catch{
    report('error',{stage:'configuration',message:'External runtime disabled; use the local benchmark.'});
  }
};
