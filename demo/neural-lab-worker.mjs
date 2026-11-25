import {createLocalGenerationProvider} from '../src/adapters/local-generation.mjs';
import {corpus,models,scoreCase} from './neural-fixtures.mjs';
import {inspectGeneration,rejectionStage,firstCandidates} from './neural-diagnostics.mjs';
import {createEngine,createHarper,createVirastar,createTextlint,procurementPolicyRules} from '../src/index.mjs';

// Separate, opt-in public-data-only experiment. Remote assets are explicitly
// allowed here; this is NOT the SDK's strict local-files-only provider.
const runtimeURL='https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2';
let started=false;
const report=(type,data={})=>self.postMessage({type,...data});
self.onmessage=async({data})=>{
  if(started)return;started=true;
  let pipeline,harper,stage='configuration';
  try{
    if(!data||Object.keys(data).sort().join(',')!=='device,model'||!Object.hasOwn(models,data.model)||!['webgpu','wasm'].includes(data.device))throw new Error('Invalid configuration');
    const model=models[data.model],device=data.device;
    if(device==='webgpu'&&!self.navigator?.gpu)throw new Error('WebGPU unavailable in worker');
    // Measure the existing lightweight reviewer independently on identical inputs.
    stage='baseline';report('progress',{message:'Running lightweight baseline…'});
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
    }catch{report('baseline-error');}
    finally{try{await harper?.dispose?.();}catch{}harper=null;}
    stage='runtime';report('progress',{message:'Loading pinned Transformers.js runtime…'});
    const runtime=await import(/* @vite-ignore */ runtimeURL);
    runtime.env.allowLocalModels=false;runtime.env.allowRemoteModels=true;
    stage='model';report('progress',{message:'Downloading or loading model artifacts…'});
    let last=0;
    const start=performance.now();
    pipeline=await runtime.pipeline('text-generation',model.id,{
      device,dtype:model.dtype,revision:model.revision,
      progress_callback:event=>{
        if(performance.now()-last<250)return;last=performance.now();
        const percent=Number.isFinite(event?.progress)?' '+Math.round(event.progress)+'%':'';
        report('progress',{message:'Model assets: '+String(event?.status??'loading').slice(0,40)+percent});
      }
    });
    const loadMs=Math.round(performance.now()-start);
    if(typeof pipeline?.tokenizer?.apply_chat_template!=='function')throw new Error('Missing chat template');
    let observation=null,inferenceReturned=false;
    const provider=createLocalGenerationProvider({generator:async(messages,options)=>{
      const prompt=pipeline.tokenizer.apply_chat_template(messages,{tokenize:false,add_generation_prompt:true,enable_thinking:false});
      if(typeof prompt!=='string'||prompt.length>16384)throw new Error('Invalid prompt');
      const generated=await pipeline(prompt,{...options,max_new_tokens:192,add_special_tokens:false});
      inferenceReturned=true;observation=inspectGeneration(generated);
      return generated;
    }});
    stage='inference';let total={matched:0,missing:0,unexpected:0,blocked:0};
    for(const fixture of corpus){
      report('progress',{message:'Running fixed fixture: '+fixture.id});
      const before=performance.now();
      observation=null;inferenceReturned=false;
      try{
        const findings=await provider.check(fixture.text,fixture.language);
        const score=scoreCase(fixture,findings);
        for(const k of ['matched','missing','unexpected'])total[k]+=score[k];
        report('case',{id:fixture.id,status:'evaluated',findings,score,observation,ms:Math.round(performance.now()-before)});
      }catch{
        total.blocked++;total.missing+=fixture.expected.length;
        report('case',{id:fixture.id,status:'blocked',findings:[],observation,reason:rejectionStage(observation,inferenceReturned),score:{matched:0,missing:fixture.expected.length,unexpected:0},ms:Math.round(performance.now()-before)});
      }
    }
    report('done',{model:model.id,revision:model.revision,device,dtype:model.dtype,loadMs,total});
  }catch(error){
    // No raw prompts, stack traces, or arbitrary model output in error logs.
    report('error',{stage,message:stage==='configuration'?'Unsupported browser or invalid selection.':'Runtime/model/inference failed. See browser developer console for asset or GPU errors.'});
  }finally{try{await pipeline?.dispose?.();}catch{}}
};
