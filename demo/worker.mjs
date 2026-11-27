import { createEngine, createHarper, createVirastar, createTextlint, procurementPolicyRules, createPersianLexiconProvider } from '../src/index.mjs';
import {unpackDictionaryEvidence} from './dictionary-roots.mjs';
import {formalSpellings} from './persian-formal-spellings.mjs';
self.onmessage=async({data})=>{
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
          providers.push(createPersianLexiconProvider({...unpackDictionaryEvidence(packed),preferredSpellings:formalSpellings}));
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
