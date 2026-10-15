import test from 'node:test';import assert from 'node:assert/strict';
import {handleRequest} from '../src/server/app.mjs';import {fixture,SAMPLE,PNG,IDS} from './helpers.mjs';
function setup(t){const f=fixture(handleRequest);t.after(()=>f.close());return f;}
async function create(f,extra={},as='writer'){const r=await f.send('/api/studio/posts',{method:'POST',as,data:{...SAMPLE,...extra}});assert.equal(r.status,201,await r.clone().text());return (await r.json()).post;}
test('missing credentials rejected',async t=>{const f=setup(t);assert.equal((await f.send('/api/studio/posts',{as:null})).status,401);});
test('valid staff gets only server-derived permissions',async t=>{const f=setup(t);const r=await f.send('/api/studio/me');assert.equal(r.status,200);const b=await r.json();assert.equal(b.permissions.publish,false);assert.equal(b.identity.employee_id,IDS.writer);});
test('inactive employee is rejected even with a token',async t=>{const f=setup(t);f.identities.get('writer.jwt.token').active=false;assert.equal((await f.send('/api/studio/posts')).status,403);});
test('network failure in identity provider fails closed',async t=>{const f=setup(t);f.unavailable();assert.equal((await f.send('/api/studio/posts')).status,503);});
test('missing workspace configuration cannot use Cloudflare identity fallback',async t=>{const f=setup(t);delete f.env.WORKSPACE_SUPABASE_URL;assert.equal((await f.send('/api/studio/posts')).status,503);});
test('workspace admin without editorial grant cannot write',async t=>{const f=setup(t);assert.equal((await f.send('/api/studio/posts',{as:'workspace',method:'POST',data:SAMPLE})).status,403);});
test('foreign origins are rejected, including suffix tricks',async t=>{const f=setup(t);assert.equal((await f.send('/api/studio/posts',{origin:'https://intranet.ridearrivo.com.evil.test'})).status,403);});
test('mutation without an Origin is rejected',async t=>{const f=setup(t);assert.equal((await f.send('/api/studio/posts',{origin:null,method:'POST',data:SAMPLE})).status,403);});
test('valid CORS preflight has exact origin, no cookies',async t=>{const f=setup(t);const r=await f.send('/api/studio/posts',{method:'OPTIONS',as:null,headers:{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}});assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),'https://intranet.ridearrivo.com');assert.equal(r.headers.get('access-control-allow-credentials'),null);});
test('draft create is persistent and server-owned',async t=>{const f=setup(t);const p=await create(f,{author_id:IDS.admin});assert.equal(p.author_id,IDS.writer);assert.equal(p.version,1);const row=f.env.DB.sql.prepare('SELECT * FROM ra_blog_posts WHERE id=?').get(p.id);assert.equal(row.title,SAMPLE.title);assert.equal(f.env.DB.sql.prepare('SELECT COUNT(*) n FROM ra_blog_revisions').get().n,1);});
test('article draft derives a unique slug when the editor leaves it blank',async t=>{const f=setup(t);const r=await f.send('/api/studio/posts',{method:'POST',data:{...SAMPLE,slug:''}});assert.equal(r.status,201,await r.clone().text());const p=(await r.json()).post;assert.match(p.slug,/^a-calmer-arrival-[0-9a-f]{6}$/);});
test('writer cannot see another writers draft',async t=>{const f=setup(t);const p=await create(f,{},'other');assert.equal((await f.send('/api/studio/posts/'+p.id)).status,404);const b=await(await f.send('/api/studio/posts')).json();assert.equal(b.total,0);});
test('editor can see all drafts',async t=>{const f=setup(t);await create(f,{},'other');const b=await(await f.send('/api/studio/posts',{as:'editor'})).json();assert.equal(b.total,1);});
test('writer cannot patch another writers draft',async t=>{const f=setup(t);const p=await create(f,{},'other');assert.equal((await f.send('/api/studio/posts/'+p.id,{method:'PATCH',data:{...SAMPLE,version:p.version}})).status,404);});
test('writer cannot publish with a forged role property',async t=>{const f=setup(t);assert.equal((await f.send('/api/studio/posts',{method:'POST',data:{...SAMPLE,status:'published',fact_checked:true,role:'blog_admin'}})).status,403);});
test('draft and future schedule stay out of public endpoint',async t=>{const f=setup(t);await create(f);await create(f,{slug:'scheduled-guide',status:'scheduled',published_at:'2026-10-14T12:00:00Z',fact_checked:true},'editor');const b=await(await f.send('/api/articles',{as:null,origin:null})).json();assert.equal(b.total,0);});
test('schedule becomes public at its due time',async t=>{const f=setup(t);await create(f,{status:'scheduled',published_at:'2026-10-14T12:00:00Z',fact_checked:true},'editor');f.now('2026-10-14T12:00:01Z');const b=await(await f.send('/api/articles',{as:null,origin:null})).json();assert.equal(b.total,1);assert.equal(b.posts[0].editorial_note,undefined);assert.equal(b.posts[0].author_id,undefined);});
test('duplicate slug returns conflict without creating a second revision',async t=>{const f=setup(t);await create(f);const r=await f.send('/api/studio/posts',{method:'POST',data:SAMPLE});assert.equal(r.status,409);assert.equal(f.env.DB.sql.prepare('SELECT COUNT(*) n FROM ra_blog_revisions').get().n,1);});
test('valid update increments version and records revision atomically',async t=>{const f=setup(t);const p=await create(f);const r=await f.send('/api/studio/posts/'+p.id,{method:'PATCH',data:{...SAMPLE,title:'An improved arrival guide',version:1}});assert.equal(r.status,200);assert.equal((await r.json()).post.version,2);assert.equal(f.env.DB.sql.prepare('SELECT COUNT(*) n FROM ra_blog_revisions').get().n,2);});
test('stale update cannot overwrite a newer edit',async t=>{const f=setup(t);const p=await create(f);await f.send('/api/studio/posts/'+p.id,{method:'PATCH',data:{...SAMPLE,title:'A first changed title',version:1}});const r=await f.send('/api/studio/posts/'+p.id,{method:'PATCH',data:{...SAMPLE,title:'A stale changed title',version:1}});assert.equal(r.status,409);assert.equal(f.env.DB.sql.prepare('SELECT title FROM ra_blog_posts').get().title,'A first changed title');});
test('revocation is checked on the very next request',async t=>{const f=setup(t);await create(f);f.identities.get('writer.jwt.token').role=null;assert.equal((await f.send('/api/studio/posts')).status,403);assert.equal(f.identityCalls(),2);});
test('valid image upload and private preview work',async t=>{const f=setup(t);const r=await f.send('/api/studio/media',{method:'POST',raw:PNG,headers:{'Content-Type':'image/png','X-File-Name':'cover.png'}});assert.equal(r.status,201);const media=(await r.json()).media;assert.equal((await f.send('/api/studio/media/'+media.id)).status,200);assert.equal((await f.send('/media/'+media.id,{as:null,origin:null})).status,404);});
test('another writer cannot preview a private upload',async t=>{const f=setup(t);const r=await f.send('/api/studio/media',{method:'POST',as:'other',raw:PNG,headers:{'Content-Type':'image/png'}});const m=(await r.json()).media;assert.equal((await f.send('/api/studio/media/'+m.id)).status,404);});
test('spoofed SVG image upload is rejected',async t=>{const f=setup(t);const r=await f.send('/api/studio/media',{method:'POST',raw:'<svg onload="alert(1)"></svg>',headers:{'Content-Type':'image/png'}});assert.equal(r.status,400);assert.equal(f.env.MEDIA.files.size,0);});
test('large upload is rejected before storage',async t=>{const f=setup(t);const r=await f.send('/api/studio/media',{method:'POST',raw:PNG,headers:{'Content-Type':'image/png','Content-Length':'6000000'}});assert.equal(r.status,413);assert.equal(f.env.MEDIA.files.size,0);});
test('published cover is public and becomes private when archived',async t=>{const f=setup(t);const r=await f.send('/api/studio/media',{method:'POST',raw:PNG,headers:{'Content-Type':'image/png'}});const m=(await r.json()).media;const p=await create(f,{status:'published',fact_checked:true,cover_media_id:m.id,cover_alt:'A test image'},'editor');assert.equal((await f.send('/media/'+m.id,{as:null,origin:null})).status,200);await f.send('/api/studio/posts/'+p.id,{method:'PATCH',as:'editor',data:{...SAMPLE,version:1,status:'archived',cover_media_id:m.id}});assert.equal((await f.send('/media/'+m.id,{as:null,origin:null})).status,404);});
test('writer cannot attach another writers private upload',async t=>{const f=setup(t);const r=await f.send('/api/studio/media',{method:'POST',as:'other',raw:PNG,headers:{'Content-Type':'image/png'}});const m=(await r.json()).media;assert.equal((await f.send('/api/studio/posts',{method:'POST',data:{...SAMPLE,cover_media_id:m.id}})).status,403);});
test('hard deletion requires blog administrator, archive, version and slug confirmation',async t=>{const f=setup(t);const p=await create(f);for(const as of ['writer','editor','workspace'])assert.equal((await f.send('/api/studio/posts/'+p.id,{method:'DELETE',as,data:{version:1,confirm:SAMPLE.slug}})).status,403);assert.equal((await f.send('/api/studio/posts/'+p.id,{method:'DELETE',as:'admin',data:{version:1,confirm:SAMPLE.slug}})).status,409);});
test('confirmed archived delete preserves audit history',async t=>{const f=setup(t);const p=await create(f,{status:'archived'},'admin');const r=await f.send('/api/studio/posts/'+p.id,{method:'DELETE',as:'admin',data:{version:1,confirm:SAMPLE.slug}});assert.equal(r.status,200);assert.equal(f.env.DB.sql.prepare('SELECT COUNT(*) n FROM ra_blog_posts').get().n,0);const e=f.env.DB.sql.prepare("SELECT * FROM ra_blog_revisions WHERE event='deleted'").get();assert.equal(e.actor_id,IDS.admin);assert.equal(JSON.parse(e.snapshot).body,p.body);});
test('writers cannot read staff access lists',async t=>{const f=setup(t);assert.equal((await f.send('/api/studio/access')).status,403);});
test('malformed JSON produces controlled error',async t=>{const f=setup(t);assert.equal((await f.send('/api/studio/posts',{method:'POST',raw:'{',headers:{'Content-Type':'application/json'}})).status,400);});
test('unknown API method/path is not silently served as homepage',async t=>{const f=setup(t);assert.equal((await f.send('/api/studio/nothing')).status,404);});
test('authenticated responses are never cached',async t=>{const f=setup(t);const r=await f.send('/api/studio/me');assert.match(r.headers.get('cache-control'),/no-store/);assert.match(r.headers.get('vary'),/Origin/);});
test('content asset migration adds content types generic assets and relationship indexes', async t=>{
  const f=setup(t);
  const posts=f.env.DB.sql.prepare("PRAGMA table_info('ra_blog_posts')").all();
  const contentType=posts.find(row=>row.name==='content_type');
  assert.ok(contentType,'content_type column must exist');
  assert.equal(contentType.notnull,1);
  assert.equal(contentType.dflt_value,"'article'");
  const assets=f.env.DB.sql.prepare("PRAGMA table_info('ra_blog_assets')").all().map(row=>row.name);
  for(const name of ['id','object_key','original_filename','mime_type','byte_size','asset_kind','uploaded_by','alt_text','sha256','created_at']) assert.ok(assets.includes(name),name);
  const relationships=f.env.DB.sql.prepare("PRAGMA index_list('ra_blog_post_assets')").all();
  assert.ok(relationships.some(row=>row.unique===1),'post asset relationship must be unique');
  const assetIndexes=f.env.DB.sql.prepare("PRAGMA index_list('ra_blog_assets')").all().map(row=>row.name);
  assert.ok(assetIndexes.some(name=>name.includes('uploader')),'uploader index missing');
  const postIndexes=f.env.DB.sql.prepare("PRAGMA index_list('ra_blog_post_assets')").all().map(row=>row.name);
  assert.ok(postIndexes.some(name=>name.includes('post')),'post relationship index missing');
});
test('quick writeup derives stable title slug and defaults category',async t=>{
  const f=setup(t);
  const r=await f.send('/api/studio/posts',{method:'POST',data:{content_type:'quick_post',body:'Airport arrivals should feel calm, clear and human.'}});
  assert.equal(r.status,201,await r.clone().text());
  const p=(await r.json()).post;
  assert.equal(p.content_type,'quick_post');
  assert.equal(p.title,'Airport arrivals should feel calm, clear and human.');
  assert.equal(p.category,'Company news');
  assert.match(p.slug,/^airport-arrivals-should-feel-calm-clear-and-human-[0-9a-f]{6}$/);
  const updated=await f.send('/api/studio/posts/'+p.id,{method:'PATCH',data:{content_type:'quick_post',body:'Updated short post body.',title:'',slug:'changed-by-browser',excerpt:'',category:'Company news',status:'draft',fact_checked:false,cover_media_id:null,cover_alt:'',editorial_note:'',version:p.version}});
  assert.equal(updated.status,200,await updated.clone().text());
  assert.equal((await updated.json()).post.slug,p.slug);
});
test('writer cannot publish quick writeup but editor can publish short body without excerpt',async t=>{
  const f=setup(t);
  const forged=await f.send('/api/studio/posts',{method:'POST',data:{content_type:'quick_post',body:'A short operational update.',status:'published',fact_checked:true}});
  assert.equal(forged.status,403);
  const ok=await f.send('/api/studio/posts',{method:'POST',as:'editor',data:{content_type:'quick_post',body:'A short operational update.',status:'published',fact_checked:true}});
  assert.equal(ok.status,201,await ok.clone().text());
  assert.equal((await ok.json()).post.status,'published');
});
const PDF=Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
const DOCX=Buffer.concat([Buffer.from([0x50,0x4b,0x03,0x04]),Buffer.alloc(40,1)]);
async function uploadAsset(f,{as='writer',name='source.txt',type='text/plain',kind='source',bytes=Buffer.from('hello world')}={}){
  const r=await f.send('/api/studio/assets',{method:'POST',as,raw:bytes,headers:{'Content-Type':type,'X-File-Name':name,'X-Asset-Kind':kind}});
  return {r,body:r.status===201?await r.clone().json():null};
}
test('generic assets accept allowed document and image types and generate storage keys',async t=>{
  const f=setup(t);
  const cases=[
    ['guide.pdf','application/pdf',PDF],
    ['guide.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',DOCX],
    ['guide.md','text/markdown',Buffer.from('# Hello')],
    ['guide.txt','text/plain',Buffer.from('Hello')],
    ['guide.json','application/json',Buffer.from('{"title":"Hello"}')],
    ['guide.png','image/png',PNG],
  ];
  for(const [name,type,bytes] of cases){
    const {r,body}=await uploadAsset(f,{name,type,bytes,kind:name.endsWith('.png')?'image':'source'});
    assert.equal(r.status,201,`${name}: ${await r.clone().text()}`);
    assert.match(body.asset.object_key,/^(images|sources)\/[0-9a-f-]+\./);
  }
});
test('generic assets reject MIME extension spoofing denied active types and size limits',async t=>{
  const f=setup(t);
  assert.equal((await uploadAsset(f,{name:'fake.pdf',type:'text/plain',bytes:Buffer.from('not pdf')})).r.status,400);
  assert.equal((await uploadAsset(f,{name:'page.html',type:'text/html',bytes:Buffer.from('<h1>x</h1>')})).r.status,400);
  assert.equal((await uploadAsset(f,{name:'bad.svg',type:'image/svg+xml',kind:'image',bytes:Buffer.from('<svg></svg>')})).r.status,400);
  assert.equal((await uploadAsset(f,{name:'archive.zip',type:'application/zip',bytes:DOCX})).r.status,400);
  assert.equal((await uploadAsset(f,{name:'too-big.txt',type:'text/plain',bytes:Buffer.alloc(15*1024*1024+1)})).r.status,413);
  assert.equal((await uploadAsset(f,{name:'too-big.png',type:'image/png',kind:'image',bytes:Buffer.alloc(5*1024*1024+1)})).r.status,413);
});
test('writers list only their assets while editors list all',async t=>{
  const f=setup(t);
  await uploadAsset(f,{as:'writer'});await uploadAsset(f,{as:'other',name:'other.txt'});
  const own=await(await f.send('/api/studio/assets')).json();assert.equal(own.assets.length,1);assert.equal(own.assets[0].uploaded_by,IDS.writer);
  const all=await(await f.send('/api/studio/assets',{as:'editor'})).json();assert.equal(all.assets.length,2);
});
test('asset relationships enforce writer ownership and public attachments download safely',async t=>{
  const f=setup(t);
  const post=await create(f,{status:'published',fact_checked:true},'editor');
  const {body}=await uploadAsset(f,{as:'editor',name:'brief.pdf',type:'application/pdf',kind:'attachment',bytes:PDF});
  const linked=await f.send(`/api/studio/posts/${post.id}/assets`,{method:'POST',as:'editor',data:{asset_id:body.asset.id,relationship:'attachment'}});assert.equal(linked.status,201,await linked.clone().text());
  const pub=await f.send('/attachments/'+body.asset.id,{as:null,origin:null});assert.equal(pub.status,200);assert.equal(pub.headers.get('x-content-type-options'),'nosniff');assert.match(pub.headers.get('content-disposition'),/^attachment;/);assert.equal(pub.headers.get('content-type'),'application/pdf');
  const source=(await uploadAsset(f,{as:'editor',name:'source.pdf',type:'application/pdf',kind:'source',bytes:PDF})).body.asset;
  await f.send(`/api/studio/posts/${post.id}/assets`,{method:'POST',as:'editor',data:{asset_id:source.id,relationship:'source'}});
  assert.equal((await f.send('/attachments/'+source.id,{as:null,origin:null})).status,404);
  const otherAsset=(await uploadAsset(f,{as:'other',name:'private.txt'})).body.asset;
  const writerPost=await create(f,{slug:'writer-asset-post'});
  assert.equal((await f.send(`/api/studio/posts/${writerPost.id}/assets`,{method:'POST',data:{asset_id:otherAsset.id,relationship:'attachment'}})).status,403);
});
test('unlink removes relationship but keeps asset and protected asset read works',async t=>{
  const f=setup(t);const post=await create(f);const asset=(await uploadAsset(f,{kind:'attachment'})).body.asset;
  assert.equal((await f.send(`/api/studio/posts/${post.id}/assets`,{method:'POST',data:{asset_id:asset.id,relationship:'attachment'}})).status,201);
  assert.equal((await f.send('/api/studio/assets/'+asset.id)).status,200);
  assert.equal((await f.send(`/api/studio/posts/${post.id}/assets/${asset.id}?relationship=attachment`,{method:'DELETE'})).status,200);
  assert.ok(f.env.DB.sql.prepare('SELECT * FROM ra_blog_assets WHERE id=?').get(asset.id));
  assert.equal(f.env.DB.sql.prepare('SELECT COUNT(*) n FROM ra_blog_post_assets WHERE asset_id=?').get(asset.id).n,0);
});
test('failed D1 asset insert cleans up the newly written R2 object',async t=>{
  const f=setup(t);const original=f.env.DB.prepare.bind(f.env.DB);
  f.env.DB.prepare=(sql)=>{if(String(sql).startsWith('INSERT INTO ra_blog_assets')) return {bind(){return this},async run(){throw Error('forced insert failure')}};return original(sql)};
  const {r}=await uploadAsset(f);assert.equal(r.status,500);assert.equal(f.env.MEDIA.files.size,0);
});
test('asset upload preflight allows x-asset-kind only through trusted origin',async t=>{
  const f=setup(t);const r=await f.send('/api/studio/assets',{method:'OPTIONS',as:null,headers:{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type,x-file-name,x-asset-kind'}});assert.equal(r.status,204);assert.match(r.headers.get('access-control-allow-headers'),/X-Asset-Kind/i);
});
test('import endpoint creates a draft and preserves linked source regardless of forged lifecycle fields',async t=>{
  const f=setup(t);const source=(await uploadAsset(f,{name:'import.md',type:'text/markdown',kind:'source',bytes:Buffer.from('# Imported\n\nBody')})).body.asset;
  const r=await f.send('/api/studio/import',{method:'POST',data:{asset_id:source.id,content_type:'article',status:'published',fact_checked:true,published_at:'2026-10-13T12:00:00Z',draft:{title:'Imported story',excerpt:'Imported excerpt for review before publishing.',body:'Imported body for editorial review.',category:'Mobility',status:'published',fact_checked:true}}});
  assert.equal(r.status,201,await r.clone().text());const b=await r.json();
  assert.equal(b.post.status,'draft');assert.equal(b.post.fact_checked,false);assert.equal(b.post.published_at,null);assert.equal(b.post.content_type,'article');assert.equal(b.source_asset.id,source.id);
  const rel=f.env.DB.sql.prepare("SELECT * FROM ra_blog_post_assets WHERE post_id=? AND asset_id=? AND relationship='source'").get(b.post.id,source.id);assert.ok(rel);
});
test('import source ownership is enforced for writers while editors may import team sources',async t=>{
  const f=setup(t);const other=(await uploadAsset(f,{as:'other',name:'other.md',type:'text/markdown',kind:'source',bytes:Buffer.from('# Other')})).body.asset;
  const payload={asset_id:other.id,draft:{title:'Team source',excerpt:'',body:'Review me',category:'Company news'}};
  assert.equal((await f.send('/api/studio/import',{method:'POST',data:payload})).status,403);
  assert.equal((await f.send('/api/studio/import',{method:'POST',as:'editor',data:payload})).status,201);
});
test('import rejects non-source assets and keeps uploaded source available after post failure',async t=>{
  const f=setup(t);const attachment=(await uploadAsset(f,{name:'attachment.txt',kind:'attachment'})).body.asset;
  assert.equal((await f.send('/api/studio/import',{method:'POST',data:{asset_id:attachment.id,draft:{title:'Bad import',body:'x',category:'Mobility'}}})).status,400);
  const source=(await uploadAsset(f,{name:'retry.md',type:'text/markdown',kind:'source',bytes:Buffer.from('# Retry')})).body.asset;
  await create(f,{slug:'duplicate-import-slug'});
  const failed=await f.send('/api/studio/import',{method:'POST',data:{asset_id:source.id,draft:{title:'Duplicate import slug',slug:'duplicate-import-slug',excerpt:'',body:'Retry later',category:'Mobility'}}});
  assert.equal(failed.status,409);assert.ok(f.env.DB.sql.prepare('SELECT * FROM ra_blog_assets WHERE id=?').get(source.id));assert.ok(await f.env.MEDIA.get(source.object_key));
  assert.equal(f.env.DB.sql.prepare("SELECT COUNT(*) n FROM ra_blog_post_assets WHERE asset_id=? AND relationship='source'").get(source.id).n,0);
});
test('post asset relationship list survives reopening an article',async t=>{
  const f=setup(t);const post=await create(f,{slug:'asset-reopen'});const asset=(await uploadAsset(f,{name:'brief.txt',kind:'attachment'})).body.asset;
  await f.send(`/api/studio/posts/${post.id}/assets`,{method:'POST',data:{asset_id:asset.id,relationship:'attachment'}});
  const r=await f.send(`/api/studio/posts/${post.id}/assets`);assert.equal(r.status,200);const b=await r.json();assert.equal(b.assets.length,1);assert.equal(b.assets[0].asset.id,asset.id);assert.equal(b.assets[0].relationship,'attachment');
});
test('asset uploads imports and relationship changes are recorded in the editorial audit trail',async t=>{
  const f=setup(t);
  const source=(await uploadAsset(f,{name:'audit-source.md',type:'text/markdown',kind:'source',bytes:Buffer.from('# Audit source')})).body.asset;
  const imported=await f.send('/api/studio/import',{method:'POST',data:{asset_id:source.id,draft:{title:'Audit import',excerpt:'',body:'Imported audit body',category:'Company news'}}});
  assert.equal(imported.status,201,await imported.clone().text());
  const post=(await imported.json()).post;
  const attachment=(await uploadAsset(f,{name:'audit.txt',kind:'attachment'})).body.asset;
  assert.equal((await f.send(`/api/studio/posts/${post.id}/assets`,{method:'POST',data:{asset_id:attachment.id,relationship:'attachment'}})).status,201);
  assert.equal((await f.send(`/api/studio/posts/${post.id}/assets/${attachment.id}?relationship=attachment`,{method:'DELETE'})).status,200);
  const events=f.env.DB.sql.prepare('SELECT event,asset_id,post_id,relationship FROM ra_blog_asset_events ORDER BY created_at,id').all();
  assert.ok(events.some(e=>e.event==='uploaded'&&e.asset_id===source.id));
  assert.ok(events.some(e=>e.event==='imported'&&e.asset_id===source.id&&e.post_id===post.id&&e.relationship==='source'));
  assert.ok(events.some(e=>e.event==='linked'&&e.asset_id===attachment.id&&e.relationship==='attachment'));
  assert.ok(events.some(e=>e.event==='unlinked'&&e.asset_id===attachment.id&&e.relationship==='attachment'));
  const audit=await f.send('/api/studio/audit');assert.equal(audit.status,200);const body=await audit.json();
  assert.ok(body.events.some(e=>e.event==='uploaded'&&e.title==='audit.txt'));
  assert.ok(body.events.some(e=>e.event==='imported'&&e.title==='Audit import'));
  assert.equal(JSON.stringify(body).includes('Imported audit body'),false);
});
