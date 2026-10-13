import { HttpError, isUuid, permissionsFor } from './policy.mjs';
export function bearerToken(request) {
  const header = request.headers.get('Authorization') || '';
  const match = /^Bearer ([A-Za-z0-9._-]{10,8192})$/.exec(header);
  if (!match) throw new HttpError(401, 'Sign in to RA-Workspace to continue.');
  return match[1];
}
export async function workspaceRpc(request, env, name, args, fetcher = fetch) {
  const token = bearerToken(request);
  let base;
  try { base = new URL(env.WORKSPACE_SUPABASE_URL); } catch { throw new HttpError(503, 'Workspace identity is not configured.'); }
  if (base.protocol !== 'https:' || base.username || base.password || !env.WORKSPACE_SUPABASE_ANON_KEY) throw new HttpError(503, 'Workspace identity is not configured.');
  const allowed = ['workspace_blog_identity', 'workspace_blog_people', 'workspace_blog_set_access', 'workspace_blog_access_log'];
  if (!allowed.includes(name)) throw new HttpError(500, 'Unsupported identity operation.');
  let response;
  try {
    response = await fetcher(`${base.origin}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, apikey: env.WORKSPACE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {}), signal: AbortSignal.timeout(8000), redirect: 'error',
    });
  } catch { throw new HttpError(503, 'The workspace identity service is temporarily unavailable. No changes were made.'); }
  if (response.status === 401) throw new HttpError(401, 'Your workspace session has expired. Sign in again.');
  if (response.status === 403) throw new HttpError(403, 'Your workspace account does not have permission for this action.');
  if (response.status === 409) throw new HttpError(409, 'This access assignment changed. Refresh and try again.');
  if (!response.ok) throw new HttpError(response.status === 400 ? 400 : 503, name === 'workspace_blog_set_access' ? 'Access was not changed. Check that the employee is active and that you are not removing your own administrator access.' : 'Workspace access could not be checked. Check the Blog Studio migration and try again.');
  try { return await response.json(); } catch { throw new HttpError(503, 'The workspace returned an invalid identity response.'); }
}
export async function authorize(request, env, fetcher = fetch) {
  const identity = await workspaceRpc(request, env, 'workspace_blog_identity', {}, fetcher);
  if (!identity || identity.active !== true || !isUuid(identity.employee_id)) throw new HttpError(403, 'An approved, active workspace account is required.');
  const role = ['writer', 'editor', 'blog_admin'].includes(identity.role) ? identity.role : null;
  const verified = { employee_id: identity.employee_id, full_name: String(identity.full_name || 'RideArrivo Editorial').slice(0, 160), role, active: true, can_manage_access: identity.can_manage_access === true };
  return { identity: verified, permissions: permissionsFor(verified) };
}
