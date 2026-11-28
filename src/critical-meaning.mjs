// Lexical invariant only, not semantic equivalence. Preserve high-risk
// polarity, obligations, safety, acceptance and payment-state terms.
const en = new Set('no not never neither nor none nothing nobody without unless except only all any each every must shall may might can could cannot should would will safe unsafe approved rejected accepted refused prohibited permitted required optional paid unpaid genuine counterfeit original equivalent inclusive exclusive maximum minimum before after until within more less'.split(' '));
const fa = new Set('نه خیر هیچ هر همه فقط صرفا باید نباید ممکن مجاز غیرمجاز ممنوع بدون مگر جز قبل بعد تا حداکثر حداقل بیشتر کمتر تایید تأیید رد قبول پذیرش اصل تقلبی الزامی اختیاری ایمن ناایمن خطرناک نمی نیست نبود ندارد نخواهد نشود نشد نکرد'.split(' '));
const words = s => [...s.matchAll(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu)].map(m => m[0]);
const canonical = s => s.normalize('NFC').toLowerCase().replace(/['’]/gu,'').replace(/[\u064b-\u065f\u0670]/gu,'').replace(/[يك]/gu,c=>c==='ي'?'ی':'ک');
// The documented Persian approval spelling family has one lexical identity.
// Exact known repeated-yeh typo and hamza variants do not alter approval state.
const approvalFamily = new Set(['تایید','تأیید','تاییید']);
function criticalCanonical(word,language) {
  const value=canonical(word);
  return language==='fa'&&approvalFamily.has(value)?'تایید':value;
}
function signature(text, language) {
  const critical = language === 'en' ? en : fa;
  return words(text).map(word=>criticalCanonical(word,language)).filter(t => critical.has(t) ||
    (language === 'en' && /^(?:is|are|was|were|do|does|did|ca|could|wo|would|should|must|sha|has|have|had)nt$/u.test(t)));
}
export function preservesCriticalMeaning(source, start, end, replacement, language) {
  const next = source.slice(0,start) + replacement + source.slice(end);
  return JSON.stringify(signature(source,language)) === JSON.stringify(signature(next,language));
}
