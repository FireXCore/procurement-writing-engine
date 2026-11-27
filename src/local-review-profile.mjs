import {createEngine} from './engine.mjs';
import {createHarper} from './adapters/harper.mjs';
import {createVirastar} from './adapters/virastar.mjs';
import {createTextlint} from './adapters/textlint.mjs';
import {createPersianLexiconProvider} from './adapters/persian-lexicon.mjs';
import {parseDictionaryEvidence,packDictionaryEvidence,unpackDictionaryEvidence} from './lilak-dictionary.mjs';
import {formalSpellings,procurementWords} from './persian-procurement-profile.mjs';
import {procurementPolicyRules} from './policy.mjs';

// Build-time / host-owned assets only. No network or implicit dictionary download.
export function prepareLilakDictionary(dic,aff){
  const packed=packDictionaryEvidence(parseDictionaryEvidence(dic,aff));
  return Object.freeze({...packed,suffixes:Object.freeze(packed.suffixes.map(([s,f])=>Object.freeze([s,Object.freeze([...f])])))});
}
export function createLilakProvider(packed,{preferredSpellings=formalSpellings,preferredWords=procurementWords}={}){
  return createPersianLexiconProvider({...unpackDictionaryEvidence(packed),preferredSpellings,preferredWords});
}

// Explicit production-host composition of the same lightweight providers
// used in qualification. Failure is visible, not a silently reduced profile.
export async function createLocalReviewProfile({languages=['en','fa'],harperBinary,harperWorker=false,persianDictionary,policies=true}={}){
  if(!Array.isArray(languages)||!languages.length||languages.length>2||new Set(languages).size!==languages.length||languages.some(l=>!['en','fa'].includes(l))||typeof harperWorker!=='boolean'||typeof policies!=='boolean')throw new TypeError('Invalid local profile');
  const enabled=[...languages];
  if(enabled.includes('en')&&!harperBinary)throw new TypeError('Explicit local Harper binary required');
  if(!enabled.includes('fa')&&persianDictionary!==undefined)throw new TypeError('Persian dictionary requires Persian language');
  const providers=[];let harper;
  try{
    if(enabled.includes('en')){
      harper=await createHarper({binary:harperBinary,worker:harperWorker});providers.push(harper.provider);
      if(policies)providers.push(await createTextlint(procurementPolicyRules));
    }
    if(enabled.includes('fa')){
      providers.push(await createVirastar());
      if(persianDictionary!==undefined)providers.push(createLilakProvider(persianDictionary));
    }
    const engine=createEngine(providers);
    let closed=false,active=null,closing=null;
    return Object.freeze({languages:Object.freeze(enabled),dictionaryEnabled:persianDictionary!==undefined,
      analyze(document,options){
        if(closed)return Promise.resolve(Object.freeze({snapshotId:null,status:'blocked',findings:Object.freeze([]),diagnostics:Object.freeze([Object.freeze({code:'profile-disposed'})]),apply:false}));
        if(active)return engine.analyze(document,options);
        const current=engine.analyze(document,options);active=current;
        const release=()=>{if(active===current)active=null;};
        current.then(release,release);return current;
      },
      dispose(){
        if(!closing){closed=true;closing=(async()=>{try{await active;}finally{await harper?.dispose();}})();}
        return closing;
      }
    });
  }catch(error){try{await harper?.dispose();}catch{}throw error;}
}
