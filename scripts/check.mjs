import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
function visit(root){for(const e of readdirSync(root,{withFileTypes:true})){const p=join(root,e.name);if(e.isDirectory())visit(p);else if(p.endsWith('.mjs')){const r=spawnSync(process.execPath,['--check',p],{stdio:'inherit'});if(r.status!==0)process.exit(1);}}}
for(const p of ['src','test','examples','scripts','demo'])visit(p);
console.log('Syntax checks passed');
