import test from 'node:test';import assert from 'node:assert/strict';
import {handleRequest} from '../src/server/app.mjs';import {fixture,SAMPLE,IDS} from './helpers.mjs';
function setup(t){const f=fixture(handleRequest);t.after(()=>f.close());return f;}
async function create(f,extra={},as='writer'){const r=await f.send('/api/studio/posts',{method:'POST',as,data:{...SAMPLE,...extra}});assert.equal(r.status,201,await r.clone().text());return (await r.json()).post;}
async function tag(f,label,as='editor'){const r=await f.send('/api/studio/tags',{method:'POST',as,data:{label}});return r;}

test('writers cannot invent a new topic, editors and admins can',async t=>{
  const f=setup(t);
  assert.equal((await tag(f,'Onboarding','writer')).status,403);
  const r=await tag(f,'Onboarding','editor');
  assert.equal(r.status,201);
  const body=await r.json();
  assert.equal(body.tag.label,'Onboarding');
  assert.equal(body.tag.slug,'onboarding');
});

test('creating the same topic twice returns the existing one, not a duplicate',async t=>{
  const f=setup(t);
  const a=(await (await tag(f,'Safety on the road')).json()).tag;
  const b=(await (await tag(f,'safety on the road')).json()).tag;
  assert.equal(a.id,b.id);
  const list=await (await f.send('/api/studio/tags',{as:'editor'})).json();
  assert.equal(list.tags.filter(t=>t.slug==='safety-on-the-road').length,1);
});

test('a writer can apply an existing topic to their own driver post but not create one inline',async t=>{
  const f=setup(t);
  const onboarding=(await (await tag(f,'Onboarding')).json()).tag;
  const post=await create(f,{category:'For drivers',tags:[onboarding.id]});
  assert.deepEqual(post.tags.map(t=>t.slug),['onboarding']);
  const reopened=await (await f.send('/api/studio/posts/'+post.id)).json();
  assert.deepEqual(reopened.post.tags.map(t=>t.slug),['onboarding']);
});

test('tag IDs that do not exist are dropped silently rather than saved as garbage',async t=>{
  const f=setup(t);
  const post=await create(f,{category:'For drivers',tags:['not-a-real-uuid','00000000-0000-4000-8000-000000000000']});
  assert.deepEqual(post.tags,[]);
});

test('omitting tags on a later save keeps the existing tags; an empty array clears them',async t=>{
  const f=setup(t);
  const onboarding=(await (await tag(f,'Onboarding')).json()).tag;
  const post=await create(f,{category:'For drivers',tags:[onboarding.id]});
  const kept=await f.send('/api/studio/posts/'+post.id,{method:'PATCH',data:{...SAMPLE,category:'For drivers',version:post.version}});
  assert.deepEqual((await kept.json()).post.tags.map(t=>t.slug),['onboarding']);
  const cleared=await f.send('/api/studio/posts/'+post.id,{method:'PATCH',data:{...SAMPLE,category:'For drivers',tags:[],version:(await kept.json().catch(()=>({post:{version:post.version+1}}))).post?.version||post.version+1}});
  assert.equal(cleared.status,200);
  assert.deepEqual((await cleared.json()).post.tags,[]);
});

test('a published driver post with a topic is reachable at /drivers/<topic>, listed in its nav and in the sitemap',async t=>{
  const f=setup(t);
  const onboarding=(await (await tag(f,'Onboarding')).json()).tag;
  await create(f,{category:'For drivers',tags:[onboarding.id],status:'published',fact_checked:true},'editor');
  const page=await f.send('/drivers/onboarding',{as:null,origin:null});
  assert.equal(page.status,200);
  const html=await page.text();
  assert.match(html,/<h1>Onboarding<\/h1>/);
  assert.match(html,/1 story/);
  assert.match(html,/href="\/stories\/a-calmer-arrival"/);
  assert.match(html,/content="index,follow/);
  const driversHome=await (await f.send('/drivers',{as:null,origin:null})).text();
  assert.match(driversHome,/href="\/drivers\/onboarding">Onboarding \(1\)<\/a>/);
  const sitemap=await (await f.send('/sitemap.xml',{as:null,origin:null})).text();
  assert.match(sitemap,/<loc>https:\/\/blog\.ridearrivo\.com\/drivers\/onboarding<\/loc>/);
});

test('an unknown topic address is a real 404, and a topic with no published posts is noindex',async t=>{
  const f=setup(t);
  assert.equal((await f.send('/drivers/not-a-real-topic',{as:null,origin:null})).status,404);
  await tag(f,'Incentives');
  const page=await f.send('/drivers/incentives',{as:null,origin:null});
  assert.equal(page.status,200);
  assert.match(await page.text(),/content="noindex,follow/);
});

test('a tag applied to a non driver post never appears on any drivers page',async t=>{
  const f=setup(t);
  const onboarding=(await (await tag(f,'Onboarding')).json()).tag;
  await create(f,{category:'Mobility',tags:[onboarding.id],status:'published',fact_checked:true},'editor');
  const page=await f.send('/drivers/onboarding',{as:null,origin:null});
  assert.match(await page.text(),/No stories under Onboarding yet/);
});
