import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path =>
  readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('asset publication migration adds public lifecycle columns', () => {
  const sql=read('migrations/0003_asset_publication.sql');
  assert.match(sql,/ADD COLUMN public_at TEXT/);
  assert.match(sql,/ADD COLUMN public_by TEXT/);
  assert.match(sql,/ra_blog_assets_publication/);
});

test('asset publication is server permission gated and sources remain private', () => {
  const app=read('src/server/app.mjs');
  const content=read('src/server/content.mjs');

  assert.match(app,/method==='PATCH'/);
  assert.match(app,/requirePermission\(permissions\.publish\)/);
  assert.match(app,/setAssetPublication/);

  assert.match(content,/asset_kind==='source'/);
  assert.match(content,/Private source files cannot be published directly/);

  assert.match(app,/\/files\//);
  assert.match(app,/public_at IS NOT NULL/);
  assert.match(app,/asset_kind!='source'/);
});

test('asset permanent deletion is administrator gated and reference safe', () => {
  const app=read('src/server/app.mjs');
  const content=read('src/server/content.mjs');

  assert.match(app,/requirePermission\(permissions\.remove\)/);
  assert.match(app,/deleteAssetRecord/);
  assert.match(content,/COUNT\(\*\) AS n FROM ra_blog_post_assets WHERE asset_id=\?/);
  assert.match(content,/Detach it before permanent deletion/);
});
