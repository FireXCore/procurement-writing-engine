import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname,join } from 'node:path';
import { parseDictionaryRoots } from './dictionary-roots.mjs';
const require=createRequire(import.meta.url);
const id='virtual:pwe-persian-roots',resolved='\0'+id;
export function dictionaryPlugin(){
  return {name:'pwe-pinned-persian-roots',resolveId(source){if(source===id)return resolved;},load(source){
    if(source!==resolved)return;
    const dir=dirname(require.resolve('dictionary-fa'));
    const roots=parseDictionaryRoots(readFileSync(join(dir,'index.dic'),'utf8'));
    if(roots.length<1000)throw new Error('Unexpectedly small Persian dictionary');
    return 'export default '+JSON.stringify(roots)+';';
  }};
}
