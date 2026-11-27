// Public, fixed synthetic corpus. No arbitrary user input reaches this worker.
// These are smoke fixtures, not a representative or hidden accuracy benchmark.
export const models=Object.freeze({
  qwen35:Object.freeze({id:'onnx-community/Qwen3.5-0.8B-Text-ONNX',revision:'1e45daba048899e7f771657ada617ec49350aa91',dtype:'q4'}),
  qwen3:Object.freeze({id:'onnx-community/Qwen3-0.6B-ONNX',revision:'b1ece21c06dfce3839272e86b7fa12a985d97a7a',dtype:'q4'})
});
export const corpus=Object.freeze([
 {id:'en-spelling',language:'en',text:'Please chek the requested quotation.',expected:[['chek','check']]},
 {id:'en-agreement',language:'en',text:'The information are incomplete.',expected:[['are','is']]},
 {id:'en-clean',language:'en',text:'The quotation is not approved.',expected:[]},
 {id:'fa-orthography',language:'fa',text:'لطفا مشخصات فنی را مجددا ارسال کنید.',expected:[['لطفا','لطفاً'],['مجددا','مجدداً']]},
 {id:'fa-clean',language:'fa',text:'لطفاً پیش‌فاکتور را بررسی کنید.',expected:[]}
].map(c=>Object.freeze({...c,expected:Object.freeze(c.expected.map(Object.freeze))})));
export function scoreCase(fixture,proposals){
  if(!fixture||!Array.isArray(proposals))throw new TypeError('Invalid result');
  const key=p=>JSON.stringify([p.original,p.replacement]);
  const expected=new Set(fixture.expected.map(p=>JSON.stringify(p)));
  const actual=new Set(proposals.map(key));
  let matched=0;for(const k of expected)if(actual.has(k))matched++;
  return {matched,missing:expected.size-matched,unexpected:actual.size-matched};
}
