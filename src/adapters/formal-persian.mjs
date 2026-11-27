// Local, deliberately narrow formal-writing policy. Not an upstream Virastar rule.
// Exact unmarked adverbs only; no blanket final-alef or diacritic normalization.
const formalAdverbs=new Set(['لطفا','حتما','قطعا','واقعا','تقریبا','فورا','قبلا','بعدا','موقتا','رسما','صرفا','مستقیما','ترجیحا','ضمنا','مجددا','احتراما','معمولا','عموما','خصوصا','صراحتا','دقیقا','حدودا','نهایتا','مفصلا']);
export function formalPersianOrthography(text){
  if(typeof text!=='string'||!text.isWellFormed())throw new TypeError('Invalid Persian text');
  return text.replace(/[\p{L}\p{M}\p{N}\p{Cf}]+/gu,word=>formalAdverbs.has(word)?word+'\u064b':word)
    .replace(/(?<![\p{L}\p{M}\p{N}\p{Cf}])پیش فاکتور(?![\p{L}\p{M}\p{N}\p{Cf}])/gu,'پیش‌فاکتور');
}
