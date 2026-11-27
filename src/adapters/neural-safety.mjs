// Conservative edit policy; lexical invariants are not semantic equivalence.
const enCritical=new Set('no not never neither nor none nothing nobody without unless except only all any each every must shall may might can could cannot should would will wont mustnt dont doesnt didnt isnt arent wasnt werent couldnt wouldnt shouldnt hasnt havent hadnt approved rejected accepted refused prohibited permitted required optional paid unpaid payment refund credit debit delivery shipment warranty guarantee liability cancellation cancelled canceled cancel substitute replacement equivalent original genuine counterfeit before after until within maximum minimum more less at least most increase decrease inclusive exclusive'.split(' '));
const faCritical=new Set('نه خیر هیچ هر همه فقط صرفا باید نباید ممکن مجاز غیرمجاز ممنوع بدون مگر جز قبل بعد تا حداکثر حداقل بیشتر کمتر پرداخت بازپرداخت تحویل تایید تأیید رد قبول پذیرش ضمانت گارانتی تعهد لغو جایگزین اصل تقلبی رایگان الزامی اختیاری'.split(' '));
const words=s=>Array.from(s.matchAll(/[\p{L}\p{M}]+(?:[\u200c'’][\p{L}\p{M}]+)*/gu),m=>m[0]);
const canonical=s=>s.normalize('NFC').toLowerCase().replace(/['’]/gu,'').replace(/[\u064b-\u065f\u0670]/gu,'').replace(/[يك]/gu,c=>c==='ي'?'ی':'ک');
const critical=(s,lang)=>words(s).map(canonical).filter(t=>lang==='en'?enCritical.has(t)||/^(?:is|are|was|were|do|does|did|ca|could|wo|would|should|must|sha|has|have|had)nt$/u.test(t):faCritical.has(t)||/^(?:نمی|نخواهد|نشود|نشد|نیست|نبود|ندارد|نداشت|نکن|نکرد)/u.test(t));
const punctuation=s=>s.replace(/[\p{L}\p{M}\u200c\s]/gu,'');
const folded=s=>canonical(s).replace(/[\s\u200c]/gu,'');
const wordChar=/[\p{L}\p{M}\p{N}\p{Cf}]/u;
function distance(a,b){
 const x=[...a],y=[...b];let row=Array.from({length:y.length+1},(_,i)=>i);
 for(let i=1;i<=x.length;i++){const next=[i];for(let j=1;j<=y.length;j++)next[j]=Math.min(row[j]+1,next[j-1]+1,row[j-1]+Number(x[i-1]!==y[j-1]));row=next;}
 return row[y.length];
}
export function validateNeuralEdit(source,{start,end,original,replacement,category},language){
 if(original.length>64||replacement.length>64||!replacement.trim())return false;
 const left=[...source.slice(0,start)].at(-1)??'',right=[...source.slice(end)][0]??'';
 if(wordChar.test(left)&&wordChar.test([...original][0]??'')||wordChar.test(right)&&wordChar.test([...original].at(-1)??''))return false;
 const a=words(original),b=words(replacement);
 if(!a.length||!b.length||a.length>4||b.length>4||Math.abs(a.length-b.length)>1||punctuation(original)!==punctuation(replacement))return false;
 const corrected=source.slice(0,start)+replacement+source.slice(end);
 if(JSON.stringify(critical(source,language))!==JSON.stringify(critical(corrected,language)))return false;
 if(category==='spelling')return a.length===1&&b.length===1&&distance(folded(a[0]),folded(b[0]))<=2;
 if(category==='orthography')return folded(original)===folded(replacement);
 return category==='grammar';
}
