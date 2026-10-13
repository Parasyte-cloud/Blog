import { CATEGORIES, HttpError, mayEdit, validatePost, isUuid } from './policy.mjs';
export const VISIBLE_SQL = "status IN ('published','scheduled') AND published_at IS NOT NULL AND published_at <= ?";
export function dbFor(env) {
  if (!env.DB) throw new HttpError(503, 'The blog database is not connected.');
  return typeof env.DB.withSession === 'function' ? env.DB.withSession('first-primary') : env.DB;
}
export const readingMinutes = body => Math.max(1, Math.ceil(String(body || '').trim().split(/\s+/).length / 220));
export function editorView(row, identity) { return { ...row, fact_checked: Boolean(row.fact_checked), ever_published: Boolean(row.ever_published), can_edit: mayEdit(identity, row), reading_minutes: readingMinutes(row.body) }; }
export function slugify(value) { return String(value || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/-+/g,'-'); }
export function preparePostInput(input, current, identity, now, id) {
  const requested = input?.content_type ?? current?.content_type ?? 'article';
  if (requested !== 'quick_post') return { ...input, content_type: requested };
  if (current?.content_type && current.content_type !== 'quick_post') throw new HttpError(400,'Content type cannot be changed after creation.');
  const body = typeof input?.body === 'string' ? input.body : '';
  const opening = body.replace(/\s+/g,' ').trim().slice(0,80) || 'RideArrivo update';
  const title = typeof input?.title === 'string' && input.title.trim() ? input.title.trim() : opening;
  const suffix = String(current?.id || id || '').replace(/[^0-9a-f]/gi,'').slice(0,6).toLowerCase() || 'update';
  const base = (slugify(title).slice(0,105).replace(/-+$/,'') || 'ridearrivo-update');
  return {
    ...input,
    content_type: 'quick_post',
    title,
    slug: current?.slug || `${base}-${suffix}`,
    excerpt: typeof input?.excerpt === 'string' ? input.excerpt : '',
    category: input?.category || current?.category || 'Company news',
    status: input?.status || current?.status || 'draft',
    fact_checked: input?.fact_checked === true,
    cover_media_id: input?.cover_media_id || null,
    cover_alt: typeof input?.cover_alt === 'string' ? input.cover_alt : '',
    editorial_note: typeof input?.editorial_note === 'string' ? input.editorial_note : '',
  };
}
export function publicView(row) {
  const { id, content_type='article', title, slug, excerpt, body, category, published_at, cover_media_id, cover_alt, author_name, updated_at } = row;
  return { id, content_type, title, slug, excerpt, ...(content_type==='quick_post'?{body}:{}), category, published_at, cover_media_id, cover_alt, author_name, updated_at, reading_minutes: readingMinutes(body) };
}
export function listingOptions(url) {
  const query = (url.searchParams.get('q') || '').trim().slice(0, 100);
  const category = url.searchParams.get('category') || '';
  const status = url.searchParams.get('status') || '';
  if (category && !CATEGORIES.includes(category)) throw new HttpError(400, 'Unknown category.');
  if (status && !['draft','review','scheduled','published','archived'].includes(status)) throw new HttpError(400, 'Unknown status.');
  const rawPage = url.searchParams.get('page') || '1';
  if (!/^\d{1,5}$/.test(rawPage) || Number(rawPage) < 1 || Number(rawPage) > 10000) throw new HttpError(400, 'Invalid page number.');
  return { query, category, status, page: Number(rawPage), page_size: 12 };
}
function searchConditions(options, where, args) {
  if (options.category) { where.push('category = ?'); args.push(options.category); }
  if (options.query) { where.push("(title LIKE ? ESCAPE '\\' OR excerpt LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')"); const q = `%${options.query.replace(/[\\%_]/g, '\\$&')}%`; args.push(q, q, q); }
}
export async function publicFeed(db, options, now) {
  const where = [VISIBLE_SQL], args = [now.toISOString()]; searchConditions(options, where, args);
  const clause = where.join(' AND ');
  const count = await db.prepare(`SELECT COUNT(*) AS n FROM ra_blog_posts WHERE ${clause}`).bind(...args).first();
  const rows = await db.prepare(`SELECT * FROM ra_blog_posts WHERE ${clause} ORDER BY published_at DESC, id LIMIT ? OFFSET ?`).bind(...args, options.page_size, (options.page-1)*options.page_size).all();
  return { ...options, total: count.n, posts: rows.results.map(publicView) };
}
export async function publicPost(db, slug, now) {
  return db.prepare(`SELECT * FROM ra_blog_posts WHERE slug = ? AND ${VISIBLE_SQL}`).bind(slug, now.toISOString()).first();
}
export async function publicAttachments(db, postId) {
  const result=await db.prepare(`SELECT a.id,a.original_filename,a.mime_type,a.byte_size FROM ra_blog_post_assets pa JOIN ra_blog_assets a ON a.id=pa.asset_id WHERE pa.post_id=? AND pa.relationship='attachment' ORDER BY pa.sort_order,pa.created_at,a.id`).bind(postId).all();
  return result.results;
}
export async function listEditorial(db, options, identity) {
  const where = ['1=1'], args = [];
  if (identity.role === 'writer') { where.push('author_id = ?'); args.push(identity.employee_id); }
  if (options.status) { where.push('status = ?'); args.push(options.status); }
  searchConditions(options,where,args);
  const clause=where.join(' AND ');
  const count=await db.prepare(`SELECT COUNT(*) n FROM ra_blog_posts WHERE ${clause}`).bind(...args).first();
  const result=await db.prepare(`SELECT * FROM ra_blog_posts WHERE ${clause} ORDER BY updated_at DESC,id LIMIT ? OFFSET ?`).bind(...args,options.page_size,(options.page-1)*options.page_size).all();
  const stats=await db.prepare(`SELECT status, COUNT(*) n FROM ra_blog_posts ${identity.role==='writer'?'WHERE author_id=?':''} GROUP BY status`).bind(...(identity.role==='writer'?[identity.employee_id]:[])).all();
  return {...options,total:count.n,posts:result.results.map(row=>editorView(row,identity)),counts:Object.fromEntries(stats.results.map(row=>[row.status,row.n]))};
}
export async function ownedPost(db,id,identity) {
  if (!isUuid(id)) throw new HttpError(404,'Article not found.');
  const row=await db.prepare('SELECT * FROM ra_blog_posts WHERE id=?').bind(id).first();
  if (!row || (identity.role==='writer' && row.author_id!==identity.employee_id)) throw new HttpError(404,'Article not found.');
  return row;
}
export async function ensureCover(db,id,identity) {
  if (!id) return;
  const media=await db.prepare('SELECT * FROM ra_blog_media WHERE id=?').bind(id).first();
  if (!media || (identity.role==='writer' && media.uploaded_by!==identity.employee_id)) throw new HttpError(403,'You cannot use this private cover image.');
}
export async function savePost(db,input,current,identity,now) {
  const id=current?.id || crypto.randomUUID();
  const prepared=preparePostInput(input,current,identity,now,id);
  const clean=validatePost(prepared,current,identity,now);
  if (current && (!Number.isSafeInteger(input.version) || input.version!==current.version)) throw new HttpError(409,'This article changed since you opened it. Copy your unsaved text, then reload the latest version.');
  await ensureCover(db,clean.cover_media_id,identity);
  const fields=Object.keys(clean),values=Object.values(clean),timestamp=now.toISOString();
  const publicHistory=Number(Boolean(current?.ever_published) || ['published','scheduled'].includes(clean.status));
  try {
    if (!current) {
      await db.prepare(`INSERT INTO ra_blog_posts (id,${fields.join(',')},author_id,author_name,updated_by,created_at,updated_at,ever_published) VALUES (${Array(fields.length+7).fill('?').join(',')})`).bind(id,...values,identity.employee_id,identity.full_name,identity.employee_id,timestamp,timestamp,publicHistory).run();
    } else {
      const result=await db.prepare(`UPDATE ra_blog_posts SET ${fields.map(f=>`${f}=?`).join(',')},updated_by=?,updated_at=?,ever_published=?,version=version+1 WHERE id=? AND version=?`).bind(...values,identity.employee_id,timestamp,publicHistory,id,input.version).run();
      if (result.meta.changes!==1) throw new HttpError(409,'Another editor saved first. Reload the article before saving again.');
    }
  } catch(error) {
    if (String(error.message).includes('UNIQUE constraint failed: ra_blog_posts.slug')) throw new HttpError(409,'That article slug is already in use. Choose another.');
    throw error;
  }
  return editorView(await db.prepare('SELECT * FROM ra_blog_posts WHERE id=?').bind(id).first(),identity);
}
export async function removePost(db,post,input,identity,now) {
  if (post.status!=='archived') throw new HttpError(409,'Archive the article before permanently deleting it.');
  if (input.confirm!==post.slug) throw new HttpError(400,'Type the exact article slug to confirm deletion.');
  if (!Number.isSafeInteger(input.version) || input.version!==post.version) throw new HttpError(409,'The article changed. Refresh before deleting.');
  const result=await db.batch([
    db.prepare("INSERT INTO ra_blog_revisions (id,post_id,version,event,actor_id,author_id,title,snapshot,created_at) SELECT ?,id,version,'deleted',?,author_id,title,?,? FROM ra_blog_posts WHERE id=? AND version=? AND status='archived'").bind(crypto.randomUUID(),identity.employee_id,JSON.stringify(post),now.toISOString(),post.id,input.version),
    db.prepare("DELETE FROM ra_blog_posts WHERE id=? AND version=? AND status='archived'").bind(post.id,input.version),
  ]);
  if (result[1].meta.changes!==1) throw new HttpError(409,'The article changed. Refresh before deleting.');
}

export function assetView(row) {
  if(!row)return null;
  const {id,object_key,original_filename,mime_type,byte_size,asset_kind,uploaded_by,alt_text,sha256,created_at}=row;
  return {id,object_key,original_filename,mime_type,byte_size,asset_kind,uploaded_by,alt_text,sha256,created_at};
}
export async function listAssets(db,identity,page=1) {
  const own=identity.role==='writer';
  const result=await db.prepare(`SELECT * FROM ra_blog_assets ${own?'WHERE uploaded_by=?':''} ORDER BY created_at DESC,id LIMIT 50 OFFSET ?`).bind(...(own?[identity.employee_id]:[]),(page-1)*50).all();
  return {assets:result.results.map(assetView),page,has_more:result.results.length===50};
}
export async function getAsset(db,id,identity,{publicLookup=false}={}) {
  if(!isUuid(id)) throw new HttpError(404,'Asset not found.');
  const row=await db.prepare('SELECT * FROM ra_blog_assets WHERE id=?').bind(id).first();
  if(!row) throw new HttpError(404,'Asset not found.');
  if(!publicLookup && identity?.role==='writer' && row.uploaded_by!==identity.employee_id) throw new HttpError(404,'Asset not found.');
  return row;
}
export async function createAssetRecord(db,asset) {
  const insert=db.prepare('INSERT INTO ra_blog_assets (id,object_key,original_filename,mime_type,byte_size,asset_kind,uploaded_by,alt_text,sha256,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(asset.id,asset.object_key,asset.original_filename,asset.mime_type,asset.byte_size,asset.asset_kind,asset.uploaded_by,asset.alt_text||'',asset.sha256||null,asset.created_at);
  const audit=db.prepare('INSERT INTO ra_blog_asset_events (id,event,actor_id,asset_id,post_id,relationship,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),'uploaded',asset.uploaded_by,asset.id,null,null,asset.created_at);
  await db.batch([insert,audit]);
  return assetView(await db.prepare('SELECT * FROM ra_blog_assets WHERE id=?').bind(asset.id).first());
}
export async function linkAsset(db,postId,assetId,relationship,identity,now) {
  const post=await ownedPost(db,postId,identity);
  if(!mayEdit(identity,post)) throw new HttpError(403,'You do not have permission to change attachments for this article.');
  const asset=await getAsset(db,assetId,identity,{publicLookup:true});
  if(identity.role==='writer'&&asset.uploaded_by!==identity.employee_id) throw new HttpError(403,'You cannot use another writer’s private asset.');
  if(!['cover','source','attachment','inline'].includes(relationship)) throw new HttpError(400,'Invalid asset relationship.');
  if(relationship==='source'&&asset.asset_kind!=='source') throw new HttpError(400,'Only source assets can be linked as source files.');
  if(relationship==='cover'&&asset.asset_kind!=='image') throw new HttpError(400,'Only image assets can be used as covers.');
  const linkedAt=now.toISOString();
  const relation=db.prepare('INSERT INTO ra_blog_post_assets (post_id,asset_id,relationship,sort_order,created_at) VALUES (?,?,?,?,?)').bind(post.id,asset.id,relationship,0,linkedAt);
  const audit=db.prepare('INSERT INTO ra_blog_asset_events (id,event,actor_id,asset_id,post_id,relationship,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),'linked',identity.employee_id,asset.id,post.id,relationship,linkedAt);
  try{await db.batch([relation,audit]);}
  catch(error){if(String(error.message).includes('UNIQUE constraint failed'))throw new HttpError(409,'That asset is already linked in this way.');throw error;}
  return {post_id:post.id,asset:assetView(asset),relationship};
}
export async function unlinkAsset(db,postId,assetId,relationship,identity) {
  const post=await ownedPost(db,postId,identity);
  if(!mayEdit(identity,post)) throw new HttpError(403,'You do not have permission to change attachments for this article.');
  if(!isUuid(assetId)||!['cover','source','attachment','inline'].includes(relationship)) throw new HttpError(400,'Invalid asset relationship.');
  const createdAt=new Date().toISOString();
  const audit=db.prepare(`INSERT INTO ra_blog_asset_events (id,event,actor_id,asset_id,post_id,relationship,created_at) SELECT ?,'unlinked',?,asset_id,post_id,relationship,? FROM ra_blog_post_assets WHERE post_id=? AND asset_id=? AND relationship=?`).bind(crypto.randomUUID(),identity.employee_id,createdAt,post.id,assetId,relationship);
  const remove=db.prepare('DELETE FROM ra_blog_post_assets WHERE post_id=? AND asset_id=? AND relationship=?').bind(post.id,assetId,relationship);
  const result=await db.batch([audit,remove]);
  if(result[1].meta.changes!==1) throw new HttpError(404,'Asset relationship not found.');
}

export async function createImportedDraft(db,assetId,draft,identity,now) {
  if(!draft||typeof draft!=='object'||Array.isArray(draft)) throw new HttpError(400,'Import draft must be an object.');
  const source=await getAsset(db,assetId,identity,{publicLookup:true});
  if(source.asset_kind!=='source') throw new HttpError(400,'Only a preserved source asset can be imported.');
  if(identity.role==='writer'&&source.uploaded_by!==identity.employee_id) throw new HttpError(403,'You cannot import another writer’s private source.');
  const id=crypto.randomUUID();
  const title=typeof draft.title==='string'?draft.title:'';
  const suffix=id.replace(/[^0-9a-f]/gi,'').slice(0,6).toLowerCase();
  const generatedSlug=`${(slugify(title).slice(0,105).replace(/-+$/,'')||'imported-story')}-${suffix}`;
  const input={
    ...draft,
    content_type:'article',
    title,
    slug:typeof draft.slug==='string'&&draft.slug.trim()?draft.slug.trim():generatedSlug,
    excerpt:typeof draft.excerpt==='string'?draft.excerpt:'',
    body:typeof draft.body==='string'?draft.body:'',
    category:draft.category||'Company news',
    status:'draft',
    fact_checked:false,
    published_at:null,
    cover_media_id:null,
    cover_alt:'',
    editorial_note:typeof draft.editorial_note==='string'?draft.editorial_note:'',
  };
  const clean=validatePost(input,null,identity,now);
  const fields=Object.keys(clean),values=Object.values(clean),timestamp=now.toISOString();
  const insert=db.prepare(`INSERT INTO ra_blog_posts (id,${fields.join(',')},author_id,author_name,updated_by,created_at,updated_at,ever_published) VALUES (${Array(fields.length+7).fill('?').join(',')})`).bind(id,...values,identity.employee_id,identity.full_name,identity.employee_id,timestamp,timestamp,0);
  const relationship=db.prepare('INSERT INTO ra_blog_post_assets (post_id,asset_id,relationship,sort_order,created_at) VALUES (?,?,?,?,?)').bind(id,source.id,'source',0,timestamp);
  const audit=db.prepare('INSERT INTO ra_blog_asset_events (id,event,actor_id,asset_id,post_id,relationship,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),'imported',identity.employee_id,source.id,id,'source',timestamp);
  try{await db.batch([insert,relationship,audit]);}
  catch(error){if(String(error.message).includes('UNIQUE constraint failed: ra_blog_posts.slug'))throw new HttpError(409,'That article slug is already in use. Choose another.');throw error;}
  return {post:editorView(await db.prepare('SELECT * FROM ra_blog_posts WHERE id=?').bind(id).first(),identity),source_asset:assetView(source)};
}

export async function listPostAssets(db,postId,identity){
  const post=await ownedPost(db,postId,identity);
  const result=await db.prepare('SELECT a.*,pa.relationship,pa.sort_order,pa.created_at AS linked_at FROM ra_blog_post_assets pa JOIN ra_blog_assets a ON a.id=pa.asset_id WHERE pa.post_id=? ORDER BY pa.relationship,pa.sort_order,pa.created_at,a.id').bind(post.id).all();
  return result.results.map(row=>({asset:assetView(row),relationship:row.relationship,sort_order:row.sort_order,linked_at:row.linked_at}));
}
