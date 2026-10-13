/** Shared, fail-closed editorial policy. No browser-provided role is trusted. */
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const CATEGORIES = ['Mobility', 'Travel guides', 'Company news', 'For drivers'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const EDITORS = new Set(['editor', 'blog_admin']);
const ROLES = new Set(['writer', ...EDITORS]);
export function permissionsFor(identity = {}) {
  return { write: ROLES.has(identity.role), publish: EDITORS.has(identity.role), archive: EDITORS.has(identity.role), remove: identity.role === 'blog_admin', manage_access: identity.can_manage_access === true };
}
export function isUuid(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
export function mayEdit(identity, post) {
  if (EDITORS.has(identity.role)) return true;
  return identity.role === 'writer' && post.author_id === identity.employee_id && ['draft', 'review'].includes(post.status) && Number(post.ever_published) === 0;
}
export function isPublic(post, now = new Date()) {
  const at = Date.parse(post?.published_at);
  return ['published', 'scheduled'].includes(post?.status) && Number.isFinite(at) && at <= now.getTime();
}
export function validateOrigin(origin, allowed) { return typeof origin === 'string' && origin !== 'null' && allowed.includes(origin); }
function text(value, name, max, required = false) {
  if (typeof value !== 'string') throw new HttpError(400, `${name} must be text.`);
  const v = value.trim();
  if (v.length > max || (required && !v)) throw new HttpError(400, `${name} is missing or too long (maximum ${max} characters).`);
  if (v.includes('\0')) throw new HttpError(400, `${name} contains an invalid character.`);
  return v;
}
export function validatePost(input, current, identity, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'Article must be an object.');
  const perms = permissionsFor(identity);
  if (!perms.write || (current && !mayEdit(identity, current))) throw new HttpError(403, 'You do not have permission to edit this article.');
  const title = text(input.title, 'Title', 160, true);
  const slug = text(input.slug, 'Slug', 120, true);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3) throw new HttpError(400, 'Use a slug with at least 3 lowercase letters/numbers and hyphens only.');
  if (current?.ever_published && current.slug !== slug) throw new HttpError(400, 'The slug is locked after first publication to preserve shared links.');
  const excerpt = text(input.excerpt ?? '', 'Excerpt', 320);
  const body = text(input.body ?? '', 'Body', 100000);
  const category = input.category;
  if (!CATEGORIES.includes(category)) throw new HttpError(400, 'Select a valid category.');
  const status = input.status ?? 'draft';
  if (!['draft', 'review', 'scheduled', 'published', 'archived'].includes(status)) throw new HttpError(400, 'Invalid article status.');
  if (!perms.publish && !['draft', 'review'].includes(status)) throw new HttpError(403, 'Your role cannot publish, schedule or archive articles.');
  const cover_media_id = input.cover_media_id || null;
  if (cover_media_id !== null && !isUuid(cover_media_id)) throw new HttpError(400, 'Invalid cover image.');
  const cover_alt = text(input.cover_alt ?? '', 'Cover alt text', 240);
  const editorial_note = text(input.editorial_note ?? '', 'Editorial note', 1000);
  if (input.fact_checked !== undefined && typeof input.fact_checked !== 'boolean') throw new HttpError(400, 'Accuracy confirmation must be a checkbox value.');
  const fact_checked = input.fact_checked === true;
  let published_at = null;
  if (['published', 'scheduled'].includes(status)) {
    if (!fact_checked) throw new HttpError(400, 'Confirm that you have reviewed this article for accuracy before publishing.');
    if (body.length < 80 || excerpt.length < 30) throw new HttpError(400, 'Publication needs a body of at least 80 characters and an excerpt of at least 30 characters.');
    if (cover_media_id && !cover_alt) throw new HttpError(400, 'Add descriptive alt text for the cover image.');
    const dateValue = input.published_at || (status === 'published' ? (current?.published_at || now.toISOString()) : '');
    if (typeof dateValue !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(dateValue) || !Number.isFinite(Date.parse(dateValue))) throw new HttpError(400, 'Provide a valid date and time with a timezone.');
    published_at = new Date(dateValue).toISOString();
    if (status === 'scheduled' && Date.parse(published_at) <= now.getTime()) throw new HttpError(400, 'Scheduled publication must be in the future.');
    if (status === 'published' && Date.parse(published_at) > now.getTime()) throw new HttpError(400, 'Use Scheduled for a future publication time.');
  } else if (current?.ever_published) {
    published_at = current.published_at;
  }
  return { title, slug, excerpt, body, category, status, cover_media_id, cover_alt, editorial_note, fact_checked: Number(fact_checked), published_at };
}
export function sniffImage(bytes, claimedType) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 32 || bytes.byteLength > MAX_IMAGE_BYTES) throw new HttpError(400, 'Upload a valid image no larger than 5 MiB.');
  let mime, extension;
  const matches = (offset, sequence) => sequence.every((v, i) => bytes[offset + i] === v);
  if (matches(0, [137,80,78,71,13,10,26,10]) && matches(12,[73,72,68,82])) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16), height = view.getUint32(20);
    if (!width || !height || width > 10000 || height > 10000 || width * height > 40000000) throw new HttpError(400, 'Image dimensions are too large.');
    mime='image/png'; extension='png';
  } else if (matches(0,[255,216,255]) && matches(bytes.length-2,[255,217])) { mime='image/jpeg'; extension='jpg'; }
  else if (matches(0,[82,73,70,70]) && matches(8,[87,69,66,80]) && new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(4,true)+8===bytes.length) { mime='image/webp'; extension='webp'; }
  else throw new HttpError(400, 'Unsupported image format. Use JPEG, PNG or WebP, not SVG.');
  if (claimedType !== mime) throw new HttpError(400, 'Image format does not match its MIME type.');
  return { mime, extension };
}
