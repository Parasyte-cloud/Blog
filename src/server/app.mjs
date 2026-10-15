import { HttpError, CATEGORIES, MAX_IMAGE_BYTES, MAX_ASSET_BYTES, isUuid, sniffImage, validateOrigin, validateAssetUpload, sanitizeFilename } from './policy.mjs';
import { authorize, workspaceRpc } from './auth.mjs';
import { dbFor, listingOptions, publicFeed, publicPost, publicView, listEditorial, ownedPost, editorView, savePost, removePost, VISIBLE_SQL, assetView, listAssets, getAsset, createAssetRecord, linkAsset, unlinkAsset, createImportedDraft, listPostAssets, setAssetPublication, deleteAssetRecord } from './content.mjs';
const json=(body,status=200)=>Response.json(body,{status});
export async function readBytes(request,max) {
  const length=request.headers.get('Content-Length');
  if (length && (!/^\d+$/.test(length) || Number(length)>max)) throw new HttpError(413,'This upload or request is too large.');
  if (!request.body) return new Uint8Array();
  const reader=request.body.getReader(),parts=[];let size=0;
  try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new HttpError(413,'This upload or request is too large.');}parts.push(value);} }
  finally { reader.releaseLock(); }
  const out=new Uint8Array(size);let offset=0;for(const p of parts){out.set(p,offset);offset+=p.byteLength;}return out;
}
async function readJson(request) {
  if ((request.headers.get('Content-Type')||'').split(';')[0].trim()!=='application/json') throw new HttpError(415,'Use application/json for this request.');
  const bytes=await readBytes(request,128*1024);
  try{const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(!data||typeof data!=='object'||Array.isArray(data))throw Error();return data;}catch{throw new HttpError(400,'The request does not contain a valid JSON object.');}
}
function requirePermission(value){if(!value)throw new HttpError(403,'Your blog role does not permit this action.');}
function mediaView(row){const {id,mime,bytes,filename,uploaded_by,uploaded_at}=row;return {id,mime,bytes,filename,uploaded_by,uploaded_at};}
async function mediaResponse(env,row) {
  if(!env.MEDIA)throw new HttpError(503,'Image storage is not configured.');
  const obj=await env.MEDIA.get(row.object_key);if(!obj)throw new HttpError(404,'Image not found.');
  return new Response(obj.body,{headers:{'Content-Type':row.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'}});
}

async function assetResponse(env,row,{publicAttachment=false,publicAsset=false}={}) {
  if(!env.MEDIA)throw new HttpError(503,'File storage is not configured.');
  const obj=await env.MEDIA.get(row.object_key);if(!obj)throw new HttpError(404,'Asset not found.');
  const disposition=publicAttachment||row.asset_kind!=='image'?'attachment':'inline';
  const safe=row.original_filename.replace(/["\r\n]/g,'_');
  return new Response(obj.body,{headers:{'Content-Type':row.mime_type,'Cache-Control':publicAsset||publicAttachment?'public, max-age=300':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`${disposition}; filename="${safe}"`}});
}

async function studio(request,env,services,url) {
  const {identity,permissions}=await authorize(request,env,services.fetch);
  const path=url.pathname.replace(/\/$/,'');const method=request.method;
  if(path==='/api/studio/me' && method==='GET')return json({identity,permissions,categories:CATEGORIES});
  if(path==='/api/studio/access' || path==='/api/studio/access-audit'){
    requirePermission(permissions.manage_access);
    if(method==='GET')return json({people: path.endsWith('access-audit') ? undefined : await workspaceRpc(request,env,'workspace_blog_people',{p_query:(url.searchParams.get('q')||'').slice(0,100)},services.fetch),events:path.endsWith('access-audit')?await workspaceRpc(request,env,'workspace_blog_access_log',{},services.fetch):undefined});
    if(method==='POST' && path==='/api/studio/access'){
      const input=await readJson(request);
      if(!isUuid(input.employee_id)||![null,'writer','editor','blog_admin'].includes(input.role))throw new HttpError(400,'Select an existing employee and a valid blog role.');
      await workspaceRpc(request,env,'workspace_blog_set_access',{p_employee_id:input.employee_id,p_role:input.role},services.fetch);
      return json({ok:true});
    }
    throw new HttpError(405,'Method not allowed.');
  }
  requirePermission(permissions.write);
  const db=dbFor(env),now=services.now();
  if(path==='/api/studio/import'){
    if(method!=='POST')throw new HttpError(405,'Method not allowed.');
    const input=await readJson(request);
    if(!isUuid(input.asset_id))throw new HttpError(400,'Select a valid source asset.');
    const result=await createImportedDraft(db,input.asset_id,input.draft,identity,now);
    return json(result,201);
  }
  if(path==='/api/studio/posts') {
    if(method==='GET')return json(await listEditorial(db,listingOptions(url),identity));
    if(method==='POST')return json({post:await savePost(db,await readJson(request),null,identity,now)},201);
    throw new HttpError(405,'Method not allowed.');
  }
  const postMatch=/^\/api\/studio\/posts\/([^/]+)(\/revisions)?$/.exec(path);
  if(postMatch){
    if(method==='DELETE')requirePermission(permissions.remove);
    const post=await ownedPost(db,postMatch[1],identity);
    if(postMatch[2]){
      if(method!=='GET')throw new HttpError(405,'Method not allowed.');
      const result=await db.prepare('SELECT id,version,event,actor_id,snapshot,created_at FROM ra_blog_revisions WHERE post_id=? ORDER BY version DESC,created_at DESC LIMIT 50').bind(post.id).all();
      return json({revisions:result.results.map(r=>({...r,snapshot:JSON.parse(r.snapshot)}))});
    }
    if(method==='GET')return json({post:editorView(post,identity)});
    if(method==='PATCH')return json({post:await savePost(db,await readJson(request),post,identity,now)});
    if(method==='DELETE'){await removePost(db,post,await readJson(request),identity,now);return json({ok:true});}
    throw new HttpError(405,'Method not allowed.');
  }
  if(path==='/api/studio/assets'){
    if(method==='GET')return json(await listAssets(db,identity,listingOptions(url).page));
    if(method==='POST'){
      if(!env.MEDIA)throw new HttpError(503,'File storage is not configured.');
      const kind=(request.headers.get('X-Asset-Kind')||'').trim().toLowerCase();
      const max=kind==='image'?MAX_IMAGE_BYTES:MAX_ASSET_BYTES;
      const bytes=await readBytes(request,max);
      let rawName;try{rawName=decodeURIComponent(request.headers.get('X-File-Name')||'');}catch{throw new HttpError(400,'Invalid filename.');}
      const filename=sanitizeFilename(rawName);
      const type=(request.headers.get('Content-Type')||'').split(';')[0].trim();
      const validated=validateAssetUpload(bytes,type,filename,kind);
      const id=crypto.randomUUID();const prefix=kind==='image'?'images':kind==='source'?'sources':'attachments';
      const object_key=`${prefix}/${id}.${validated.extension}`;const created_at=now.toISOString();
      await env.MEDIA.put(object_key,bytes,{httpMetadata:{contentType:validated.mime_type}});
      try{
        const asset=await createAssetRecord(db,{id,object_key,original_filename:validated.filename,mime_type:validated.mime_type,byte_size:bytes.byteLength,asset_kind:kind,uploaded_by:identity.employee_id,alt_text:'',sha256:null,created_at});
        return json({asset},201);
      }catch(error){try{await env.MEDIA.delete(object_key);}catch{console.error('Blog asset cleanup needs attention.');}throw error;}
    }
    throw new HttpError(405,'Method not allowed.');
  }
  const assetMatch=/^\/api\/studio\/assets\/([^/]+)$/.exec(path);
  if(assetMatch){
    if(method==='GET'){
      return assetResponse(
        env,
        await getAsset(db,assetMatch[1],identity)
      );
    }

    if(method==='PATCH'){
      requirePermission(permissions.publish);
      const input=await readJson(request);
      const asset=await setAssetPublication(
        db,
        assetMatch[1],
        input.published,
        identity,
        now
      );
      return json({asset});
    }

    if(method==='DELETE'){
      requirePermission(permissions.remove);
      const asset=await deleteAssetRecord(db,assetMatch[1]);

      try{
        if(env.MEDIA) await env.MEDIA.delete(asset.object_key);
      }catch{
        console.error('Deleted Blog asset left an R2 object requiring cleanup.');
      }

      return json({ok:true});
    }

    throw new HttpError(405,'Method not allowed.');
  }
  const relationMatch=/^\/api\/studio\/posts\/([^/]+)\/assets(?:\/([^/]+))?$/.exec(path);
  if(relationMatch){
    if(method==='GET'&&!relationMatch[2])return json({assets:await listPostAssets(db,relationMatch[1],identity)});
    if(method==='POST'&&!relationMatch[2]){const input=await readJson(request);return json({link:await linkAsset(db,relationMatch[1],input.asset_id,input.relationship,identity,now)},201);}
    if(method==='DELETE'&&relationMatch[2]){await unlinkAsset(db,relationMatch[1],relationMatch[2],url.searchParams.get('relationship')||'',identity);return json({ok:true});}
    throw new HttpError(405,'Method not allowed.');
  }
  if(path==='/api/studio/media'){
    if(method==='GET'){
      const page=listingOptions(url).page;
      const own=identity.role==='writer';
      const result=await db.prepare(`SELECT * FROM ra_blog_media ${own?'WHERE uploaded_by=?':''} ORDER BY uploaded_at DESC,id LIMIT 40 OFFSET ?`).bind(...(own?[identity.employee_id]:[]),(page-1)*40).all();
      return json({media:result.results.map(mediaView),page,has_more:result.results.length===40});
    }
    if(method==='POST'){
      if(!env.MEDIA)throw new HttpError(503,'Image storage is not configured.');
      const bytes=await readBytes(request,MAX_IMAGE_BYTES);
      const type=(request.headers.get('Content-Type')||'').split(';')[0].trim();const detected=sniffImage(bytes,type);
      const id=crypto.randomUUID();const object_key=`covers/${id}.${detected.extension}`;
      let filename;try{filename=decodeURIComponent(request.headers.get('X-File-Name')||`cover.${detected.extension}`);}catch{throw new HttpError(400,'Invalid filename.');}
      filename=filename.split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f]/g,'').slice(0,120)||`cover.${detected.extension}`;
      await env.MEDIA.put(object_key,bytes,{httpMetadata:{contentType:detected.mime}});
      try {await db.prepare('INSERT INTO ra_blog_media (id,object_key,mime,bytes,filename,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?)').bind(id,object_key,detected.mime,bytes.byteLength,filename,identity.employee_id,now.toISOString()).run();}
      catch(e){try{await env.MEDIA.delete(object_key);}catch{console.error('Blog upload cleanup needs attention.');}throw e;}
      return json({media:{id,mime:detected.mime,bytes:bytes.byteLength,filename,uploaded_by:identity.employee_id,uploaded_at:now.toISOString()}},201);
    }
    throw new HttpError(405,'Method not allowed.');
  }
  const imageMatch=/^\/api\/studio\/media\/([^/]+)$/.exec(path);
  if(imageMatch&&method==='GET'){
    if(!isUuid(imageMatch[1]))throw new HttpError(404,'Image not found.');
    const row=await db.prepare('SELECT * FROM ra_blog_media WHERE id=?').bind(imageMatch[1]).first();
    if(!row||(identity.role==='writer'&&row.uploaded_by!==identity.employee_id))throw new HttpError(404,'Image not found.');
    return mediaResponse(env,row);
  }
  if(path==='/api/studio/audit'&&method==='GET'){
    const own=identity.role==='writer';
    const result=await db.prepare(`SELECT id,post_id,version,event,actor_id,title,created_at FROM ra_blog_revisions ${own?'WHERE author_id=?':''}
      UNION ALL
      SELECT e.id,e.post_id,0 AS version,e.event,e.actor_id,COALESCE(p.title,a.original_filename) AS title,e.created_at
      FROM ra_blog_asset_events e LEFT JOIN ra_blog_posts p ON p.id=e.post_id LEFT JOIN ra_blog_assets a ON a.id=e.asset_id ${own?'WHERE e.actor_id=?':''}
      ORDER BY created_at DESC,id DESC LIMIT 50`).bind(...(own?[identity.employee_id,identity.employee_id]:[])).all();
    return json({events:result.results});
  }
  throw new HttpError(404,'API route not found.');
}
function withHeaders(response,request,env) {
  const h=new Headers(response.headers);
  h.set('X-Content-Type-Options','nosniff');h.set('Referrer-Policy','strict-origin-when-cross-origin');h.set('X-Frame-Options','DENY');
  h.set('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=()');
  h.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  h.set('Cache-Control','no-store');
  const origin=request.headers.get('Origin'),workspace=env.WORKSPACE_ORIGIN||'https://intranet.ridearrivo.com';
  if(new URL(request.url).pathname.startsWith('/api/studio')){
    h.set('Vary','Origin');if(validateOrigin(origin,[workspace]))h.set('Access-Control-Allow-Origin',origin);
  }
  return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers:h});
}
export async function handleRequest(request,env,services={}) {
  services={fetch:globalThis.fetch,now:()=>new Date(),...services};
  const url=new URL(request.url);let response;
  try{
    if(url.pathname.startsWith('/api/studio')){
      const origin=request.headers.get('Origin'),workspace=env.WORKSPACE_ORIGIN||'https://intranet.ridearrivo.com';
      if((origin&&!validateOrigin(origin,[workspace]))||(!['GET','HEAD'].includes(request.method)&&!validateOrigin(origin,[workspace])))throw new HttpError(403,'This origin is not allowed to access Blog Studio.');
      if(request.method==='OPTIONS'){
        if(!['GET','POST','PATCH','DELETE'].includes(request.headers.get('Access-Control-Request-Method')||'GET'))throw new HttpError(405,'Method not allowed.');
        const requested=(request.headers.get('Access-Control-Request-Headers')||'').toLowerCase().split(',').map(v=>v.trim()).filter(Boolean);
        if(requested.some(v=>!['authorization','content-type','x-file-name','x-asset-kind'].includes(v)))throw new HttpError(403,'Requested headers are not allowed.');
        response=new Response(null,{status:204,headers:{'Access-Control-Allow-Methods':'GET, POST, PATCH, DELETE, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, X-File-Name, X-Asset-Kind','Access-Control-Max-Age':'600'}});
      }else response=await studio(request,env,services,url);
    }else if(url.pathname==='/api/articles'&&request.method==='GET'){
      response=json(await publicFeed(dbFor(env),listingOptions(url),services.now()));
    }else if(/^\/attachments\/[a-f0-9-]+$/.test(url.pathname)&&['GET','HEAD'].includes(request.method)){
      const id=url.pathname.slice('/attachments/'.length);if(!isUuid(id))throw new HttpError(404,'Attachment not found.');
      const row=await dbFor(env).prepare(`SELECT a.* FROM ra_blog_assets a JOIN ra_blog_post_assets pa ON pa.asset_id=a.id JOIN ra_blog_posts p ON p.id=pa.post_id WHERE a.id=? AND pa.relationship='attachment' AND ${VISIBLE_SQL} LIMIT 1`).bind(id,services.now().toISOString()).first();
      if(!row)throw new HttpError(404,'Attachment not found.');response=await assetResponse(env,row,{publicAttachment:true});
    }else if(/^\/files\/[a-f0-9-]+$/.test(url.pathname)&&['GET','HEAD'].includes(request.method)){
      const id=url.pathname.slice('/files/'.length);

      if(!isUuid(id)){
        throw new HttpError(404,'File not found.');
      }

      const row=await dbFor(env).prepare(
        `SELECT *
         FROM ra_blog_assets
         WHERE id=?
           AND public_at IS NOT NULL
           AND asset_kind!='source'
         LIMIT 1`
      ).bind(id).first();

      if(!row){
        throw new HttpError(404,'File not found.');
      }

      response=await assetResponse(
        env,
        row,
        {
          publicAttachment:row.asset_kind!=='image',
          publicAsset:true
        }
      );
    }else if(url.pathname==='/api/health'&&request.method==='GET'){
      await dbFor(env).prepare('SELECT 1 AS ok').first();response=json({ok:true,storage:'d1',media_connected:Boolean(env.MEDIA)});
    }else if(/^\/media\/[a-f0-9-]+$/.test(url.pathname)&&['GET','HEAD'].includes(request.method)){
      const id=url.pathname.slice(7);if(!isUuid(id))throw new HttpError(404,'Image not found.');
      const row=await dbFor(env).prepare(`SELECT m.* FROM ra_blog_media m WHERE m.id=? AND EXISTS(SELECT 1 FROM ra_blog_posts WHERE cover_media_id=m.id AND ${VISIBLE_SQL})`).bind(id,services.now().toISOString()).first();
      if(!row)throw new HttpError(404,'Image not found.');response=await mediaResponse(env,row);
    }else if(url.pathname.startsWith('/api/'))throw new HttpError(404,'API route not found.');
    else if(url.pathname==='/admin'||url.pathname==='/admin/'){
      const destination=new URL(env.WORKSPACE_ORIGIN||'https://intranet.ridearrivo.com');destination.searchParams.set('section','blog');response=Response.redirect(destination,302);
    }else if(['/journal.css','/journal.js','/favicon.png','/robots.txt'].includes(url.pathname)||url.pathname.startsWith('/assets/')){
      response=env.ASSETS?await env.ASSETS.fetch(request):new Response('Not found',{status:404});
    }else{
      // Public renderer is loaded separately so the editor API has no UI dependencies.
      const { routePublic }=await import('./render.mjs');
      response=await routePublic(request,env,services);
    }
  }catch(error){
    const status=error instanceof HttpError?error.status:500;
    if(status===500)console.error('Blog request failed. Check database/storage bindings and migrations.');
    response=json({error:error instanceof HttpError?error.message:'The blog could not complete this request. No success has been confirmed.'},status);
  }
  return withHeaders(response,request,env);
}
