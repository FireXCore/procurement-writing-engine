import test from 'node:test';
import assert from 'node:assert/strict';
import {createTransformersProvider,createEngine,protectEntitySpans} from '../src/index.mjs';

function fake(output,{failGPU=false,hold=false}={}){
  const calls=[],state={disposals:0,interrupts:0,release:null};
  const runtime={env:{allowRemoteModels:false,allowLocalModels:true},
    InterruptableStoppingCriteria:class{interrupt(){state.interrupts++;}},
    async pipeline(task,model,options){
      calls.push({task,model,options});
      if(failGPU&&options.device==='webgpu')throw Error('Unavailable');
      const pipe=async(prompt,opts)=>{
        calls.push({prompt,opts});
        if(hold)await new Promise(resolve=>{state.release=resolve;});
        return [{generated_text:output}];
      };
      pipe.tokenizer={apply_chat_template:(messages,options)=>{calls.push({messages,options});return JSON.stringify(messages);}};
      pipe.dispose=async()=>{state.disposals++;};
      return pipe;
    }};
  return {runtime,calls,state};
}
const model='pwe/qwen-text',correction=JSON.stringify([{original:'chek',replacement:'check',category:'spelling'}]);
test('explicit local model and exact review candidate',async()=>{
  const f=fake(correction),n=await createTransformersProvider({runtime:f.runtime,model,device:'wasm'});
  assert.deepEqual(f.calls[0],{task:'text-generation',model,options:{device:'wasm',dtype:'q4',local_files_only:true}});
  const result=await n.provider.check('Please chek the offer.','en');
  assert.equal(result[0].start,7);assert.equal(result[0].replacement,'check');
  assert.equal(f.calls[1].options.tokenize,false);
  assert.equal(f.calls[2].opts.return_full_text,false);
  assert.equal(f.calls[2].opts.add_special_tokens,false);
  await n.dispose();await n.dispose();assert.equal(f.state.disposals,1);
  await assert.rejects(()=>n.provider.check('Please chek.','en'));
});
test('explicit fallback uses separately selected WASM precision',async()=>{
  const f=fake('[]',{failGPU:true});
  await assert.rejects(()=>createTransformersProvider({runtime:f.runtime,model}));
  const n=await createTransformersProvider({runtime:f.runtime,model,dtype:'q4f16',fallbackToWasm:true,wasmDtype:'q8'});
  assert.equal(n.device,'wasm');assert.equal(n.dtype,'q8');
  assert.equal(f.calls.at(-1).options.dtype,'q8');
  await n.dispose();
});
test('rejects remote settings, path traversal and invalid model identifiers',async()=>{
  const f=fake('[]');
  for(const model of ['https://example.com/model','../model','pwe/../model','/model','pwe//model','pwe/model?x=1']){
    await assert.rejects(()=>createTransformersProvider({runtime:f.runtime,model}));
  }
  f.runtime.env.allowRemoteModels=true;
  await assert.rejects(()=>createTransformersProvider({runtime:f.runtime,model}));
  assert.equal(f.calls.length,0);
  f.runtime.env.allowRemoteModels=false;
  const n=await createTransformersProvider({runtime:f.runtime,model});
  f.runtime.env.allowRemoteModels=true;
  await assert.rejects(()=>n.provider.check('Please chek.','en'));
  await n.dispose();
});
test('rejects invalid output through existing contextual guard',async()=>{
  for(const output of ['not JSON',JSON.stringify([{original:'not',replacement:'now',category:'spelling'}]),JSON.stringify([{original:'chek',replacement:'check 100',category:'spelling'}])]){
    const f=fake(output),n=await createTransformersProvider({runtime:f.runtime,model});
    await assert.rejects(()=>n.provider.check('Please do not chek.','en'));
    await n.dispose();
  }
});
test('cancellation, single-flight generation and idempotent disposal',async()=>{
  const f=fake('[]',{hold:true}),n=await createTransformersProvider({runtime:f.runtime,model}),ctrl=new AbortController();
  const pending=n.provider.check('Please chek.','en',ctrl.signal);
  await assert.rejects(()=>n.provider.check('Other prose.','en'));
  await assert.rejects(()=>n.dispose());
  ctrl.abort();assert.equal(f.state.interrupts,1);
  f.state.release();await assert.rejects(()=>pending);await n.dispose();await n.dispose();
  assert.equal(f.state.disposals,1);
});
test('protected host entities never reach generation',async()=>{
  const f=fake('[]'),n=await createTransformersProvider({runtime:f.runtime,model});
  const text='Please chek Yokogawa quotation. LOCKED',end=text.indexOf(' LOCKED'),start=text.indexOf('Yokogawa');
  const doc={text,snapshotId:'s',regions:[{start:0,end,kind:'prose',language:'en'},{start:end,end:text.length,kind:'protected'}]};
  const refined=protectEntitySpans(doc,{snapshotId:'s',spans:[{unit:'utf16',start,end:start+'Yokogawa'.length,original:'Yokogawa'}]});
  const report=await createEngine([n.provider]).analyze(refined);
  assert.equal(report.status,'complete');assert.equal(report.apply,false);
  const generated=f.calls.filter(c=>c.prompt);assert.ok(generated.length>0);
  assert.ok(generated.every(c=>!c.prompt.includes('Yokogawa')&&!c.prompt.includes('LOCKED')));
  await n.dispose();
});
