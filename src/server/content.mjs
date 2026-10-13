import { CATEGORIES, HttpError, mayEdit, validatePost, isUuid } from './policy.mjs';
export const VISIBLE_SQL = "status IN ('published','scheduled') AND published_at IS NOT NULL AND published_at <= ?";
export function dbFor(env) {
  if (!env.DB) throw new HttpError(503, 'The blog database is not connected.');
  return typeof env.DB.withSession === 'function' ? env.DB.withSession('first-primary') : env.DB;
}
export const readingMinutes = body => Math.max(1, Math.ceil(String(body || '').trim().split(/\s+/).length / 220));
export function editorView(row, identity) { return { ...row, fact_checked: Boolean(row.fact_checked), ever_published: Boolean(row.ever_published), can_edit: mayEdit(identity, row), reading_minutes: readingMinutes(row.body) }; }
export function publicView(row) {
  const { id, title, slug, excerpt, category, published_at, cover_media_id, cover_alt, author_name, updated_at } = row;
  return { id, title, slug, excerpt, category, published_at, cover_media_id, cover_alt, author_name, updated_at, reading_minutes: readingMinutes(row.body) };
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
  const clean=validatePost(input,current,identity,now);
  if (current && (!Number.isSafeInteger(input.version) || input.version!==current.version)) throw new HttpError(409,'This article changed since you opened it. Copy your unsaved text, then reload the latest version.');
  await ensureCover(db,clean.cover_media_id,identity);
  const fields=Object.keys(clean),values=Object.values(clean),timestamp=now.toISOString();
  const publicHistory=Number(Boolean(current?.ever_published) || ['published','scheduled'].includes(clean.status));
  let id=current?.id || crypto.randomUUID();
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
