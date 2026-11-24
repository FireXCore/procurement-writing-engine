import { createEngine, createHarper, createVirastar, createTextlint, procurementDeliveryRule } from '../src/index.mjs';
self.onmessage=async({data})=>{
  let harper;
  try{
    const providers=[];
    if(data.language==='en'){
      const {binaryInlined}=await import('harper.js/binaryInlined');
      harper=await createHarper({binary:binaryInlined,worker:false});
      providers.push(harper.provider,await createTextlint([procurementDeliveryRule]));
    }else if(data.language==='fa')providers.push(await createVirastar());
    else throw new Error('Unknown language');
    const report=await createEngine(providers).analyze(data.document);
    self.postMessage({ok:true,report});
  }catch{self.postMessage({ok:false});}
  finally{await harper?.dispose().catch(()=>{});}
};
