import { createEngine, createHarper, createVirastar, createTextlint, procurementPolicyRules } from '../src/index.mjs';
self.onmessage=async({data})=>{
  let harper;
  try{
    const providers=[], languages=new Set(data.document.regions.filter(r=>r.kind==='prose').map(r=>r.language));
    if(languages.has('en')){
      const {binaryInlined}=await import('harper.js/binaryInlined');
      harper=await createHarper({binary:binaryInlined,worker:false});
      providers.push(harper.provider,await createTextlint(procurementPolicyRules));
    }
    if(languages.has('fa'))providers.push(await createVirastar());
    const report=await createEngine(providers).analyze(data.document);
    self.postMessage({ok:true,report});
  }catch{self.postMessage({ok:false});}
  finally{await harper?.dispose().catch(()=>{});}
};
