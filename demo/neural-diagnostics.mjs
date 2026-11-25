// Diagnostic only: never repair model JSON or relax the SDK validator.
// This module is used exclusively for the fixed public corpus.
export function inspectGeneration(result){
  if(!Array.isArray(result)||result.length!==1)return {kind:'invalid-envelope',preview:''};
  let value=result[0]?.generated_text;
  if(Array.isArray(value)&&value.at(-1)?.role==='assistant')value=value.at(-1).content;
  if(typeof value!=='string')return {kind:'invalid-envelope',preview:''};
  // Bound the preview and strip format controls. Render only with textContent.
  const preview=[...value.slice(0,1200)].join('').replace(/[\p{Cc}\p{Cf}]/gu,c=>c==='\n'||c==='\t'?c:'�');
  if(value.length>8192||!value.isWellFormed())return {kind:'invalid-size-or-unicode',preview};
  let parsed;try{parsed=JSON.parse(value);}catch{return {kind:'non-json',preview};}
  if(!Array.isArray(parsed))return {kind:'non-array',preview};
  if(parsed.length===0)return {kind:'empty-array',preview};
  return {kind:'nonempty-array',preview};
}
export function rejectionStage(observation,inferenceReturned){
  if(!inferenceReturned)return 'inference-or-template-error';
  if(!observation)return 'missing-observation';
  if(observation.kind==='nonempty-array')return 'candidate-schema-anchor-or-safety-rejected';
  return observation.kind;
}
export function firstCandidates(findings){
  const groups=new Map();
  for(const f of findings){
    const key=JSON.stringify([f.start,f.end,f.provider,f.rule,f.category]);
    if(!groups.has(key))groups.set(key,f);
  }
  return [...groups.values()].filter(f=>typeof f.replacement==='string');
}
