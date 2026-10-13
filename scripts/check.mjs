import { fileURLToPath } from 'node:url';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
function walk(path){return readdirSync(path,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(path,e.name)):[join(path,e.name)]);}
let bad=false;
for(const name of [...walk('src'),...walk('scripts'),...walk('functions'),'public/journal.js'].filter(v=>/\.(m?js)$/.test(v))){const r=spawnSync(process.execPath,['--check',name],{encoding:'utf8'});if(r.status){console.error(name,r.stderr);bad=true;}}
for(const file of ['public/_routes.json','migrations/0001_blog_studio.sql','public/assets/wordmark.png'])if(!existsSync(file)){console.error('Missing:',file);bad=true;}
const forbidden=['SUPABASE_SERVICE_ROLE_KEY','sb_secret_','service_role'];
for(const file of walk('public').filter(v=>/\.(js|html)$/.test(v))){const s=readFileSync(file,'utf8');if(forbidden.some(v=>s.includes(v))){console.error('Privileged credential identifier in public file:',file);bad=true;}}
if(bad)process.exit(1);console.log('Syntax, entrypoint and public credential checks passed.');
