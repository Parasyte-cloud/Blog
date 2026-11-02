import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { handleRequest } from '../src/server/app.mjs';
import { fixture, SAMPLE } from './helpers.mjs';
import { OFFERINGS, ORIENTATION } from '../src/server/offerings.mjs';
const setup = t => { const f = fixture(handleRequest); t.after(() => f.close()); return f; };
const publish = (f, data) => f.send('/api/studio/posts', { method: 'POST', as: 'editor', data: { ...SAMPLE, status: 'published', fact_checked: true, ...data } });

test('rider home puts every offering at the top as click-to-open cards', async t => {
  const f = setup(t); const h = await (await f.send('/', { as: null, origin: null })).text();
  assert.ok(h.indexOf('id="services"') > 0 && h.indexOf('id="services"') < h.indexOf('id="stories"'));
  for (const o of OFFERINGS) { assert.match(h, new RegExp(`id="svc-${o.id}"`)); assert.ok(h.includes(o.cta.href.replace(/&/g, '&amp;')), o.id); }
  assert.equal((h.match(/<details class="svc" name="services"/g) || []).length, OFFERINGS.length);
});

test('every offering link is https and points at a RideArrivo host', () => {
  for (const o of OFFERINGS) { const u = new URL(o.cta.href); assert.equal(u.protocol, 'https:'); assert.match(u.hostname, /(^|\.)ridearrivo\.com$/, o.id); }
});

test('drivers page has the application, orientation and only driver stories', async t => {
  const f = setup(t);
  await publish(f, { slug: 'driver-tip', title: 'Driver tip', category: 'For drivers' });
  await publish(f, { slug: 'rider-tip', title: 'Rider tip', category: 'Travel guides' });
  const d = await (await f.send('/drivers', { as: null, origin: null })).text();
  assert.match(d, /Drive with RideArrivo/); assert.match(d, /driver\.html/); assert.match(d, /id="orientation"/);
  assert.equal((d.match(/<details class="svc ori"/g) || []).length, ORIENTATION.length);
  assert.match(d, /Driver tip/); assert.doesNotMatch(d, /Rider tip/);
  const r = await (await f.send('/', { as: null, origin: null })).text();
  assert.match(r, /Rider tip/); assert.doesNotMatch(r, /Driver tip/);
});

test('drivers page is in the sitemap', async t => {
  const f = setup(t); const x = await (await f.send('/sitemap.xml', { as: null, origin: null })).text();
  assert.match(x, /\/drivers<\/loc>/);
});

test('theme: light default, shared cookie honoured, assets routed past the function', () => {
  const js = readFileSync('public/theme.js', 'utf8'), css = readFileSync('public/journal.css', 'utf8');
  assert.match(js, /arrivo_theme_mode/); assert.match(js, /let mode|mode = 'light'/);
  assert.match(css, /^:root\{color-scheme:light/); assert.match(css, /html\[data-theme="dark"\]\{color-scheme:dark/);
  assert.ok(JSON.parse(readFileSync('public/_routes.json', 'utf8')).exclude.includes('/theme.js'));
});

test('article drafts import cleanly, stay drafts, and avoid em dashes', () => {
  for (const name of readdirSync('content').filter(n => n.endsWith('.article.json'))) {
    const a = JSON.parse(readFileSync('content/' + name, 'utf8'));
    assert.equal(a.status, 'draft', name); assert.equal(a.fact_checked, false, name);
    assert.ok(a.title && a.body.length >= 80 && a.excerpt.length >= 30, name);
    assert.doesNotMatch(JSON.stringify(a), /—/, name);
  }
  for (const m of ORIENTATION) assert.doesNotMatch(JSON.stringify(m), /—/);
});
