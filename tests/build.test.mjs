import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { onRequest } from '../functions/[[path]].js';
test('verification script runs from any current working directory',()=>{const result=spawnSync(process.execPath,[new URL('../scripts/check.mjs',import.meta.url).pathname],{cwd:'/tmp',encoding:'utf8'});assert.equal(result.status,0,result.stderr);});
test('build produces assets and routes without publishing source or article imports',()=>{const result=spawnSync(process.execPath,[new URL('../scripts/build.mjs',import.meta.url).pathname],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);for(const name of ['journal.css','journal.js','_routes.json','404.html','assets/wordmark.png'])assert.ok(existsSync(new URL('../dist/'+name,import.meta.url)),name);for(const name of ['content','scripts','tests','.dev.vars','src'])assert.ok(!existsSync(new URL('../dist/'+name,import.meta.url)),name);const routes=JSON.parse(readFileSync(new URL('../dist/_routes.json',import.meta.url)));assert.ok(routes.include.includes('/*'));});
test('Pages entrypoint fails closed without its D1 binding',async()=>{const r=await onRequest({request:new Request('https://blog.ridearrivo.com/api/articles'),env:{}});assert.equal(r.status,503);});

test('local development database applies every Blog migration in order', async () => {
  const { LocalDatabase } = await import('../scripts/local-store.mjs');
  const path='/tmp/ridearrivo-blog-migration-test.sqlite';
  rmSync(path,{force:true});
  const db = new LocalDatabase(path);
  new LocalDatabase(path);
  const columns = await db.prepare('PRAGMA table_info(ra_blog_posts)').all();
  assert.ok(columns.results.some(column => column.name === 'content_type'));
  const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  assert.ok(tables.results.some(table => table.name === 'ra_blog_assets'));
  assert.ok(tables.results.some(table => table.name === 'ra_blog_post_assets'));
  rmSync(path,{force:true});
});

test('local media adapter supports the generic Blog Studio asset namespaces', async () => {
  const { LocalImages } = await import('../scripts/local-store.mjs');
  const store = new LocalImages('/tmp/ridearrivo-blog-local-media-test');
  for (const key of [
    'covers/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp',
    'images/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png',
    'sources/cccccccc-cccc-4ccc-8ccc-cccccccccccc.pdf',
    'attachments/dddddddd-dddd-4ddd-8ddd-dddddddddd.docx'
  ]) assert.doesNotThrow(() => store.path(key), key);
  assert.throws(() => store.path('../escape.txt'));
});
