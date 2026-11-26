import { createEngine, createHarper, createVirastar, createTextlint, procurementPolicyRules, createPersianLexiconProvider } from '../src/index.mjs';
import {createSourceAbstainer} from './dictionary-roots.mjs';
self.onmessage=async({data})=>{
  let harper;
  try{
    const providers=[], languages=new Set(data.document.regions.filter(r=>r.kind==='prose').map(r=>r.language));
    if(languages.has('en')){
      const {binaryInlined}=await import('harper.js/binaryInlined');
      harper=await createHarper({binary:binaryInlined,worker:false});
      providers.push(harper.provider,await createTextlint(procurementPolicyRules));
    }
    if(languages.has('fa')){
      providers.push(await createVirastar());
      if(data.lexicon===true){const {default:evidence}=await import('virtual:pwe-persian-roots');providers.push(createPersianLexiconProvider({words:evidence.words,isKnownSource:createSourceAbstainer(evidence)}));}
    }
    const report=await createEngine(providers).analyze(data.document);
    self.postMessage({ok:true,report});
  }catch{self.postMessage({ok:false});}
  finally{await harper?.dispose().catch(()=>{});}
};
