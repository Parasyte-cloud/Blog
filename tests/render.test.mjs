import test from 'node:test';import assert from 'node:assert/strict';
import {renderMarkdown} from '../src/server/render.mjs';import {handleRequest} from '../src/server/app.mjs';import {fixture,SAMPLE} from './helpers.mjs';
function setup(t){const f=fixture(handleRequest);t.after(()=>f.close());return f;}
test('Markdown renders semantic headings and safe inline formatting',()=>{const h=renderMarkdown('## Arriving well\n\n**Plan ahead** and `check` your details.\n\n- First\n- Second');assert.match(h,/<h2 id="section-1">Arriving well<\/h2>/);assert.match(h,/<strong>Plan ahead<\/strong>/);assert.match(h,/<ul>/);});
test('raw HTML is escaped rather than executed',()=>{const h=renderMarkdown('<img src=x onerror=alert(1)>\n\n<script>alert(1)</script>');assert.doesNotMatch(h,/<img|<script/);assert.match(h,/&lt;script&gt;/);});
test('javascript and protocol-relative Markdown links are not clickable',()=>{const h=renderMarkdown('[bad](javascript:alert) [bad](//evil.test) [good](https://www.ridearrivo.com/)');assert.doesNotMatch(h,/href="javascript|href="\/\//);assert.match(h,/href="https:\/\/www.ridearrivo.com\//);});
test('code fences keep markup literal',()=>{const h=renderMarkdown('```\n<a href="x">\n```');assert.match(h,/<pre><code>/);assert.match(h,/&lt;a/);});
test('empty journal provides an honest useful landing page',async t=>{const f=setup(t);const r=await f.send('/',{as:null,origin:null});assert.equal(r.status,200);const h=await r.text();assert.match(h,/RideArrivo Journal/);assert.match(h,/first stories|New stories/i);assert.match(h,/journal.css/);});
test('public article is server rendered with canonical and LinkedIn metadata',async t=>{const f=setup(t);await f.send('/api/studio/posts',{method:'POST',as:'editor',data:{...SAMPLE,status:'published',fact_checked:true}});const r=await f.send('/stories/'+SAMPLE.slug,{as:null,origin:null});assert.equal(r.status,200);const h=await r.text();assert.match(h,/property="og:title"/);assert.match(h,/https:\/\/blog.ridearrivo.com\/stories\/a-calmer-arrival/);assert.match(h,/application\/ld\+json/);assert.match(h,/linkedin.com\/sharing/);assert.match(h,/Before your journey/);});
test('draft permalink is a real 404, not a SPA fallback',async t=>{const f=setup(t);await f.send('/api/studio/posts',{method:'POST',data:SAMPLE});const r=await f.send('/stories/'+SAMPLE.slug,{as:null,origin:null});assert.equal(r.status,404);});
test('RSS and sitemap contain public posts only',async t=>{const f=setup(t);await f.send('/api/studio/posts',{method:'POST',data:SAMPLE});await f.send('/api/studio/posts',{method:'POST',as:'editor',data:{...SAMPLE,slug:'public-story',status:'published',fact_checked:true}});for(const route of ['/rss.xml','/sitemap.xml']){const r=await f.send(route,{as:null,origin:null});assert.equal(r.status,200);const h=await r.text();assert.match(h,/public-story/);assert.doesNotMatch(h,/a-calmer-arrival/);}});
test('search input is escaped in HTML attributes',async t=>{const f=setup(t);const r=await f.send('/?q='+encodeURIComponent('"><script>alert(1)</script>'),{as:null,origin:null});const h=await r.text();assert.doesNotMatch(h,/<script>alert/);assert.match(h,/&lt;script/);});
test('admin entry points go to native workspace without passing tokens in URL',async t=>{const f=setup(t);const r=await f.send('/admin',{as:null,origin:null});assert.equal(r.status,302);assert.equal(r.headers.get('Location'),'https://intranet.ridearrivo.com/?section=blog');});
test('default cover varies with category without exposing a private upload',async t=>{const f=setup(t);await f.send('/api/studio/posts',{method:'POST',as:'editor',data:{...SAMPLE,status:'published',fact_checked:true}});const r=await f.send('/stories/'+SAMPLE.slug,{as:null,origin:null});assert.match(await r.text(),/src="\/assets\/arrival.webp"/);});
test('quick writeups render as compact feed cards and permanent pages',async t=>{
  const f=setup(t);
  const created=await f.send('/api/studio/posts',{method:'POST',as:'editor',data:{content_type:'quick_post',body:'A concise RideArrivo airport update for travellers.',status:'published',fact_checked:true}});
  assert.equal(created.status,201,await created.clone().text());
  const post=(await created.json()).post;
  const home=await f.send('/',{as:null,origin:null});
  assert.match(await home.text(),/quick-post-card/);
  const page=await f.send('/stories/'+post.slug,{as:null,origin:null});
  assert.equal(page.status,200);
  assert.match(await page.text(),/quick-post-page/);
});
test('quick writeup optional image is visible on feed card and permanent page',async t=>{
  const f=setup(t);
  const uploaded=await f.send('/api/studio/media',{method:'POST',as:'editor',raw:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'),headers:{'Content-Type':'image/png','X-File-Name':'quick.png'}});
  const media=(await uploaded.json()).media;
  const created=await f.send('/api/studio/posts',{method:'POST',as:'editor',data:{content_type:'quick_post',body:'A visual RideArrivo update.',status:'published',fact_checked:true,cover_media_id:media.id,cover_alt:'RideArrivo visual update'}});
  const post=(await created.json()).post;
  assert.match(await (await f.send('/',{as:null,origin:null})).text(),new RegExp(`<img[^>]+src=\"/media/${media.id}\"`));
  assert.match(await (await f.send('/stories/'+post.slug,{as:null,origin:null})).text(),new RegExp(`<img[^>]+src=\"/media/${media.id}\"`));
});
test('published article exposes linked attachments as safe download links but not private sources',async t=>{
  const f=setup(t);
  const postResponse=await f.send('/api/studio/posts',{method:'POST',as:'editor',data:{...SAMPLE,status:'published',fact_checked:true}});const post=(await postResponse.json()).post;
  const pdf=Buffer.from('%PDF-1.4\n% test');
  const attachmentResponse=await f.send('/api/studio/assets',{method:'POST',as:'editor',raw:pdf,headers:{'Content-Type':'application/pdf','X-File-Name':encodeURIComponent('Passenger guide.pdf'),'X-Asset-Kind':'attachment'}});const attachment=(await attachmentResponse.json()).asset;
  const sourceResponse=await f.send('/api/studio/assets',{method:'POST',as:'editor',raw:pdf,headers:{'Content-Type':'application/pdf','X-File-Name':encodeURIComponent('Private source.pdf'),'X-Asset-Kind':'source'}});const source=(await sourceResponse.json()).asset;
  await f.send(`/api/studio/posts/${post.id}/assets`,{method:'POST',as:'editor',data:{asset_id:attachment.id,relationship:'attachment'}});
  await f.send(`/api/studio/posts/${post.id}/assets`,{method:'POST',as:'editor',data:{asset_id:source.id,relationship:'source'}});
  const html=await (await f.send('/stories/'+post.slug,{as:null,origin:null})).text();
  assert.match(html,/Downloads/);assert.match(html,/Passenger guide\.pdf/);assert.match(html,new RegExp(`/attachments/${attachment.id}`));
  assert.doesNotMatch(html,/Private source\.pdf/);assert.doesNotMatch(html,new RegExp(source.id));
});
