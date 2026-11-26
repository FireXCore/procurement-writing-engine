import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDictionaryRoots,parseDictionaryEvidence,createSourceAbstainer,packDictionaryEvidence,unpackDictionaryEvidence} from '../demo/dictionary-roots.mjs';
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

test('source-only evidence recognizes listed restricted forms and flag-authorized suffixes',()=>{
 const raw='5\nمشخصات\nدستگاه/sd\nنادرست/!!\nفن/sl\nکنید\n';
 const aff='FLAG long\nSFX sd N 1\nSFX sd 0 ها/FFWW .\nSFX sl N 1\nSFX sl 0 ی/FFWW .\n';
 const e=parseDictionaryEvidence(raw,aff),known=createSourceAbstainer(e);
 assert.ok(known('فنی'));assert.ok(known('دستگاهها'));assert.ok(known('نادرست'));
 assert.equal(known('مشخصاتها'),false);assert.equal(known('مشخسات'),false);
 assert.ok(!e.words.includes('نادرست'));assert.ok(!e.words.includes('دستگاهها'));
});

test('packed dictionary preserves exact source and suffix lookup without per-word sets',()=>{
 const raw='6\nمشخصات\nدستگاه/sd\nنادرست/!!\nفن/sl\nکنید\nدست/sd\n';
 const aff='FLAG long\nSFX sd N 1\nSFX sd 0 ها/FFWW .\nSFX sl N 1\nSFX sl 0 ی/FFWW .\n';
 const evidence=parseDictionaryEvidence(raw,aff),old=createSourceAbstainer(evidence);
 const packed=packDictionaryEvidence(evidence),next=unpackDictionaryEvidence(JSON.parse(JSON.stringify(packed)));
 assert.deepEqual(next.words,evidence.words);
 for(const word of ['فنی','دستگاهها','دستها','دست','نادرست','مشخصات','مشخصاتها','مشخسات','کنید','الف','یی'])assert.equal(next.isKnownSource(word),old(word),word);
 assert.throws(()=>unpackDictionaryEvidence({version:2}));
});
