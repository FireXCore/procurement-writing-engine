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
