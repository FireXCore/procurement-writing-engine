import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveSourceRange,protectEntitySpans,createContextualProvider,createEngine} from '../src/index.mjs';

test('offset units map through astral characters and Persian ZWNJ',()=>{
 const s='😀 لطفاً می‌رود',start=s.indexOf('می‌رود'),original='می‌رود',end=start+original.length;
 for(const [unit,a,z] of [['utf16',start,end],['codepoint',[...s.slice(0,start)].length,[...s.slice(0,end)].length],['utf8',new TextEncoder().encode(s.slice(0,start)).length,new TextEncoder().encode(s.slice(0,end)).length]])
  assert.deepEqual(resolveSourceRange(s,{unit,start:a,end:z,original}),{start,end,original});
 for(const span of [{unit:'utf16',start:1,end:2,original:'\ude00'},{unit:'utf8',start:1,end:4,original:'😀'},{unit:'codepoint',start:0,end:1,original:'x'},{unit:'utf16',start:s.indexOf('ً'),end:s.indexOf('ً')+1,original:'ً'}])
  assert.throws(()=>resolveSourceRange(s,span));
});
test('refinement never exposes protected fields and preserves source offsets',async()=>{
 const text='Please chek Baker Hughes quotation. LOCKED',boundary=text.indexOf(' LOCKED');
 const doc={text,snapshotId:'r1',regions:[{start:0,end:boundary,kind:'prose',language:'en'},{start:boundary,end:text.length,kind:'protected'}]};
 const spans=['Baker Hughes','Hughes','LOCKED'].map(original=>({unit:'utf16',start:text.indexOf(original),end:text.indexOf(original)+original.length,original}));
 const refined=protectEntitySpans(doc,{snapshotId:'r1',spans});
 assert.equal(refined.text,text);assert.equal(doc.regions.length,2);assert.ok(Object.isFrozen(refined.regions));
 const calls=[];
 const provider=createContextualProvider({infer:({text})=>{calls.push(text);const start=text.indexOf('chek');return start<0?[]:[{unit:'utf16',start,end:start+4,original:'chek',replacement:'check',category:'spelling'}];}});
 const result=await createEngine([provider]).analyze(refined);
 assert.equal(result.status,'complete');assert.equal(result.apply,false);
 assert.deepEqual(result.findings.map(f=>[f.start,f.original,f.replacement]),[[text.indexOf('chek'),'chek','check']]);
 assert.ok(calls.every(s=>!s.includes('Baker')&&!s.includes('LOCKED')));
 assert.throws(()=>protectEntitySpans(doc,{snapshotId:'stale',spans}));
 assert.throws(()=>protectEntitySpans(doc,{snapshotId:'r1',spans:[...spans,{...spans[0],original:'Wrong'}]}));
});
test('invalid contextual candidates reject the entire batch',async()=>{
 const text='Please chek the quotation.';
 const good={unit:'utf16',start:7,end:11,original:'chek',replacement:'check',category:'spelling'};
 for(const bad of [{...good,original:'wrong'},{...good,replacement:'check 100'},{...good,start:1},{...good,unit:'token'},{...good,category:'unknown'}])
   await assert.rejects(()=>createContextualProvider({infer:()=>[good,bad]}).check(text,'en'));
 await assert.rejects(()=>createContextualProvider({infer:()=>Array(101).fill(good)}).check(text,'en'));
 const ctrl=new AbortController();ctrl.abort();
 let calls=0;
 await assert.rejects(()=>createContextualProvider({infer:()=>{calls++;return [];}}).check(text,'en',ctrl.signal));
 assert.equal(calls,0);
});
