import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { onRequest } from '../functions/[[path]].js';
test('verification script runs from any current working directory',()=>{const result=spawnSync(process.execPath,[new URL('../scripts/check.mjs',import.meta.url).pathname],{cwd:'/tmp',encoding:'utf8'});assert.equal(result.status,0,result.stderr);});
test('build produces assets and routes without publishing source or article imports',()=>{const result=spawnSync(process.execPath,[new URL('../scripts/build.mjs',import.meta.url).pathname],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);for(const name of ['journal.css','journal.js','_routes.json','404.html','assets/wordmark.png'])assert.ok(existsSync(new URL('../dist/'+name,import.meta.url)),name);for(const name of ['content','scripts','tests','.dev.vars','src'])assert.ok(!existsSync(new URL('../dist/'+name,import.meta.url)),name);const routes=JSON.parse(readFileSync(new URL('../dist/_routes.json',import.meta.url)));assert.ok(routes.include.includes('/*'));});
test('Pages entrypoint fails closed without its D1 binding',async()=>{const r=await onRequest({request:new Request('https://blog.ridearrivo.com/api/articles'),env:{}});assert.equal(r.status,503);});
