import {createEngine, type Provider, type DocumentSnapshot, type Analysis} from '../src/index.mjs';
import {createLocalLanguageTool} from '../src/node/index.mjs';
const provider:Provider={id:'fixture',languages:['en'],check:()=>[]};
const doc:DocumentSnapshot={text:'Hello',snapshotId:'sample',regions:[{start:0,end:5,kind:'prose',language:'en'}]};
const result:Analysis=await createEngine([provider]).analyze(doc);
const noApply:false=result.apply;
const local:Provider=createLocalLanguageTool();
// @ts-expect-error invalid language must fail the public type contract
const invalid:DocumentSnapshot={text:'Hello',snapshotId:'test',regions:[{start:0,end:5,kind:'prose',language:'de'}]};
void [noApply,local,invalid];

import {resolveSourceRange,protectEntitySpans,createContextualProvider} from '../src/index.mjs';
const span={unit:'utf16',start:0,end:5,original:'Hello'} as const;
const safe:DocumentSnapshot=protectEntitySpans(doc,{snapshotId:'sample',spans:[span]});
const range=resolveSourceRange(doc.text,span);
const contextual:Provider=createContextualProvider({infer:({text})=>[{unit:'utf16',start:0,end:text.length,original:text,replacement:'Hi',category:'spelling'}]});
void [safe,range,contextual];

import {createLocalGenerationProvider} from '../src/index.mjs';
const generated:Provider=createLocalGenerationProvider({generator:async()=>[{generated_text:'[]'}]});
void generated;

import {createTransformersProvider,type TransformersRuntime} from '../src/index.mjs';
const localRuntime:TransformersRuntime={env:{allowLocalModels:true,allowRemoteModels:false},pipeline:async()=>null};
const initTransformer=()=>createTransformersProvider({runtime:localRuntime,model:'pwe/qwen-text'});
void initTransformer;

import {createAdaptiveReview,createPersianLexiconProvider,type PreferenceProfile} from '../src/index.mjs';
const preferences=createAdaptiveReview();const profile:PreferenceProfile=preferences.exportProfile();const dictionaryProvider:Provider=createPersianLexiconProvider({words:['مشخصات']});void [profile,dictionaryProvider];

import {prepareLilakDictionary,createLilakProvider,createLocalReviewProfile,type PackedLilakDictionary,type LocalReviewProfile} from '../src/index.mjs';
const packed:PackedLilakDictionary=prepareLilakDictionary('1\nمشخصات','FLAG long');const lp:Provider=createLilakProvider(packed);const localProfile=():Promise<LocalReviewProfile>=>createLocalReviewProfile({languages:['fa'],persianDictionary:packed});void [lp,localProfile];
