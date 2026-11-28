import { createEngine, createHarper, createVirastar, createTextlint, procurementPolicyRules, createLilakProvider } from '../src/index.mjs';
let started=false;
self.onmessage=async(event)=>{
  // Dedicated workers receive trusted parent messages with an empty origin.
  // If a browser supplies an origin, it must match this worker's origin.
  if(event.origin!==''&&event.origin!==self.location.origin)return;
  if(event.isTrusted!==true||event.source!==null)return;
  const {data}=event;
  if(started)return;started=true;
  let harper,stage='setup',dictionaryUsed=false,dictionaryError=false;
  function progress(next){stage=next;self.postMessage({type:'progress',stage});}
  try{
    const providers=[], languages=new Set(data.document.regions.filter(r=>r.kind==='prose').map(r=>r.language));
    if(languages.has('en')){
      progress('english-setup');
      const {binaryInlined}=await import('harper.js/binaryInlined');
      harper=await createHarper({binary:binaryInlined,worker:false});
      providers.push(harper.provider,await createTextlint(procurementPolicyRules));
    }
    if(languages.has('fa')){
      progress('persian-setup');
      providers.push(await createVirastar());
      if(data.lexicon===true){
        try{
          progress('dictionary-load');
          const {default:packed}=await import('virtual:pwe-persian-roots');
          progress('dictionary-init');
          providers.push(createLilakProvider(packed));
          dictionaryUsed=true;
        }catch{dictionaryError=true;}
      }
    }
    progress('review');
    const report=await createEngine(providers).analyze(data.document);
    self.postMessage({type:'result',ok:true,report,dictionaryUsed,dictionaryError});
  }catch{self.postMessage({type:'result',ok:false,stage});}
  finally{await harper?.dispose().catch(()=>{});}
};
