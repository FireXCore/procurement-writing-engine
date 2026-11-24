// Local, deliberately narrow formal-writing policy. Not an upstream Virastar rule.
// Exact unmarked adverbs only; no blanket final-alef or diacritic normalization.
const formalAdverbs=new Set(['لطفا','حتما','قطعا','واقعا','تقریبا','فورا','قبلا','بعدا','موقتا','رسما','صرفا','مستقیما']);
export function formalPersianOrthography(text){
  if(typeof text!=='string'||!text.isWellFormed())throw new TypeError('Invalid Persian text');
  return text.replace(/[\p{L}\p{M}\p{N}\p{Cf}]+/gu,word=>formalAdverbs.has(word)?word+'\u064b':word);
}
