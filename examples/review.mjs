import {binaryInlined} from 'harper.js/binaryInlined';
import {createEngine,createHarper,createVirastar,createTextlint,procurementPolicyRules} from '../src/index.mjs';
// Synthetic text only; production region classification must be supplied by the authorized host.
const prefix='Please send teh quotation for ', part='Rosemount 3051 — 3 PCS', suffix=' as soon as possible.';
const text=prefix+part+suffix;
const harper=await createHarper({binary:binaryInlined,worker:false});
try {
  const engine=createEngine([harper.provider,await createVirastar(),await createTextlint(procurementPolicyRules)]);
  const report=await engine.analyze({text,snapshotId:'example:1',regions:[
    {start:0,end:prefix.length,kind:'prose',language:'en'},
    {start:prefix.length,end:prefix.length+part.length,kind:'protected'},
    {start:prefix.length+part.length,end:text.length,kind:'prose',language:'en'}
  ]});
  // Console output is confined to this synthetic example; the library has no logging.
  console.log(JSON.stringify(report,null,2));
} finally {await harper.dispose();}
