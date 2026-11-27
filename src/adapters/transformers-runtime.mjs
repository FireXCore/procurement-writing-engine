import { createLocalGenerationProvider } from './local-generation.mjs';

const modelId=/^[A-Za-z0-9][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9][A-Za-z0-9_.-]*)*$/u;
const dtypes=new Set(['q4','q4f16','q8','fp16','fp32']);
const isLocal=r=>r&&typeof r.pipeline==='function'&&r.env?.allowRemoteModels===false&&r.env?.allowLocalModels===true;

// The host owns the isolated Transformers.js runtime and all pre-provisioned
// artifacts. Never mutate shared runtime globals or fetch a model implicitly.
// local_files_only restricts model loading; it is not a network sandbox.
export async function createTransformersProvider({
  runtime, model, device='webgpu', dtype='q4', fallbackToWasm=false, wasmDtype='q4', languages=['en','fa']
}={}){
  if(!isLocal(runtime)||typeof model!=='string'||model.length>180||!modelId.test(model)||
      !['webgpu','wasm'].includes(device)||!dtypes.has(dtype)||!dtypes.has(wasmDtype)||
      typeof fallbackToWasm!=='boolean'||!Array.isArray(languages)||!languages.length||
      languages.some(l=>!['en','fa'].includes(l)))throw new TypeError('Invalid local runtime configuration');
  const supported=Object.freeze([...new Set(languages)]);
  const load=(target,precision)=>runtime.pipeline('text-generation',model,{device:target,dtype:precision,local_files_only:true});
  let activeDevice=device,activeDtype=dtype,pipe;
  try{pipe=await load(activeDevice,activeDtype);}
  catch{
    if(device!=='webgpu'||!fallbackToWasm||!isLocal(runtime))throw new Error('Local model initialization failed');
    activeDevice='wasm';activeDtype=wasmDtype;
    try{pipe=await load(activeDevice,activeDtype);}catch{throw new Error('Local model initialization failed');}
  }
  if(!isLocal(runtime)||typeof pipe!=='function'||typeof pipe.dispose!=='function'||typeof pipe.tokenizer?.apply_chat_template!=='function'){
    if(typeof pipe?.dispose==='function')await pipe.dispose();
    throw new TypeError('Unsupported or nonlocal pipeline');
  }
  let busy=false,closed=false,disposal;
  const generate=async(messages,options,signal)=>{
    if(closed||busy||!isLocal(runtime))throw new Error('Local runtime unavailable');
    if(signal?.aborted)throw new Error('Cancelled');
    busy=true;
    let listener;
    try{
      const prompt=pipe.tokenizer.apply_chat_template(messages,{
        tokenize:false,add_generation_prompt:true,enable_thinking:false
      });
      if(typeof prompt!=='string'||!prompt.isWellFormed()||prompt.length>16384)throw new TypeError('Invalid chat prompt');
      const generationOptions={...options,add_special_tokens:false};
      if(typeof runtime.InterruptableStoppingCriteria==='function'){
        const stop=new runtime.InterruptableStoppingCriteria();
        if(typeof stop.interrupt!=='function')throw new TypeError('Invalid stopping criterion');
        listener=()=>stop.interrupt();
        signal?.addEventListener('abort',listener,{once:true});
        generationOptions.stopping_criteria=[stop];
      }
      if(signal?.aborted||!isLocal(runtime))throw new Error('Generation blocked');
      const result=await pipe(prompt,generationOptions);
      if(signal?.aborted||!isLocal(runtime))throw new Error('Generation blocked');
      return result;
    }finally{
      if(listener)signal?.removeEventListener('abort',listener);
      busy=false;
    }
  };
  const adapter=createLocalGenerationProvider({generator:generate,languages:supported});
  const provider=Object.freeze({...adapter,id:'transformers-local'});
  return Object.freeze({provider,device:activeDevice,dtype:activeDtype,dispose(){
    // Host must cancel and await generation, or terminate an isolated worker
    // if the runtime does not support cooperative cancellation.
    if(busy)return Promise.reject(new Error('Local runtime busy'));
    if(!disposal){closed=true;disposal=Promise.resolve().then(()=>pipe.dispose());}
    return disposal;
  }});
}
