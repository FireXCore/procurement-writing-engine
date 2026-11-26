import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDictionaryRoots} from '../demo/dictionary-roots.mjs';
import {createAdaptiveReview} from '../src/adaptive-review.mjs';
import {readPreferences,writePreferences,removePreferences} from '../demo/preference-storage.mjs';
test('root parsing preserves exact entry count and excludes bound forms, joiners and NOSUGGEST',()=>{
 const raw='7\nمشخصات/sa\nارسال\nنامعتبر/AA\nناشناس/OO\nپیشنهاد/!!\nمی‌رود\nتجهيزات\n';
 assert.deepEqual(parseDictionaryRoots(raw),['ارسال','تجهیزات','مشخصات'].sort());
 assert.throws(()=>parseDictionaryRoots('2\nمشخصات\n'));
 assert.throws(()=>parseDictionaryRoots('header\nمشخصات\n'));
});
test('preference persistence is explicit, strict and clearable',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const p=readPreferences(storage);assert.equal(data.size,0);
 writePreferences(storage,p);assert.equal(data.size,1);
 assert.deepEqual(readPreferences(storage).exportProfile(),{version:1,records:[]});
 data.set('pwe:synthetic-demo:preferences:v1','bad JSON');
 assert.throws(()=>readPreferences(storage));removePreferences(storage);assert.equal(data.size,0);
});
