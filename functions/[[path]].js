import { handleRequest } from '../src/server/app.mjs';
/** Cloudflare Pages Function. DB and MEDIA are server-side bindings only. */
export function onRequest(context) {
  return handleRequest(context.request, context.env);
}
