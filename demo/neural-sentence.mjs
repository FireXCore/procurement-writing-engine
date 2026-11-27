import {LIMITS,eligible,validReplacement,validRange} from '../src/regions.mjs';
import {validateNeuralEdit} from '../src/adapters/neural-safety.mjs';
import {createContextualProvider} from '../src/adapters/contextual.mjs';

// Experimental alternative protocol for the fixed, public corpus only.
// Never accept an entire generated sentence as a replacement.
// Deliberately reject insertion/deletion of words, punctuation and separators.
const tokenPattern=/[\p{L}\p{M}]+(?:\u200c[\p{L}\p{M}]+)*/gu;
const agreement=new Set(['is:are','are:is','was:were','were:was','have:has','has:have','do:does','does:do']);
const foldFa=s=>s.normalize('NFC').replace(/[\u064b-\u065f\u0670]/gu,'').replace(/[يك]/gu,c=>c==='ي'?'ی':'ک');
function tokens(text){return Array.from(text.matchAll(tokenPattern),m=>({text:m[0],start:m.index,end:m.index+m[0].length}));}
export function extractSentenceEdits(source,target,language){
  if(!['en','fa'].includes(language)||typeof source!=='string'||typeof target!=='string'||
    !source.isWellFormed()||!target.isWellFormed()||source.length>LIMITS.region||target.length>LIMITS.region||
    !eligible(source,language)||!eligible(target,language))throw new TypeError('Invalid sentence candidate');
  if(source===target)return [];
  const a=tokens(source),b=tokens(target);
  if(a.length!==b.length)throw new RangeError('Token count changed');
  let x=0,y=0;const edits=[];
  for(let i=0;i<a.length;i++){
    const p=a[i],q=b[i];
    if(source.slice(x,p.start)!==target.slice(y,q.start))throw new RangeError('Separator changed');
    x=p.end;y=q.end;
    if(p.text===q.text)continue;
    if(edits.length>=4||p.text.length>64||q.text.length>64||/^\p{Lu}/u.test(p.text)||/^\p{Lu}/u.test(q.text))throw new RangeError('Edit budget or name guard');
    const category=language==='fa'&&foldFa(p.text)===foldFa(q.text)?'orthography':
      language==='en'&&agreement.has(p.text+':'+q.text)?'grammar':'spelling';
    const e={unit:'utf16',start:p.start,end:p.end,original:p.text,replacement:q.text,category};
    if(!validRange(source,e.start,e.end)||!validReplacement(e.original,e.replacement,language)||!validateNeuralEdit(source,e,language))throw new RangeError('Unsafe sentence edit');
    edits.push(e);
  }
  if(source.slice(x)!==target.slice(y))throw new RangeError('Trailing separator changed');
  let rebuilt='',cursor=0;
  for(const e of edits){rebuilt+=source.slice(cursor,e.start)+e.replacement;cursor=e.end;}
  if(rebuilt+source.slice(cursor)!==target)throw new RangeError('Reconstruction failed');
  return edits;
}
export function createSentenceProvider({generator}={}){
  if(typeof generator!=='function')throw new TypeError('Generator required');
  return createContextualProvider({infer:async({text,language,signal})=>{
    if(signal?.aborted)throw new Error('Cancelled');
    const instruction=language==='fa'
      ?'غلط‌های املایی و دستوری جمله را اصلاح کن. اگر صحیح است همان جمله را بدون تغییر بنویس. فقط خود جمله را بنویس؛ بدون توضیح، گیومه یا نشانه‌گذاری اضافی. معنی، نام‌ها و اطلاعات را تغییر نده.'
      :'Correct spelling and grammar in the sentence. If it is correct, repeat it unchanged. Return only the sentence, no explanation, quotes or extra formatting. Preserve meaning, names and facts.';
    const target=await generator([{role:'system',content:instruction},{role:'user',content:text}],{do_sample:false,max_new_tokens:128,num_return_sequences:1,return_full_text:false},signal);
    if(signal?.aborted)throw new Error('Cancelled');
    return extractSentenceEdits(text,target,language);
  }});
}
