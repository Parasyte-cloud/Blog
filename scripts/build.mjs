import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
const root=new URL('../',import.meta.url);
await rm(new URL('dist/',root),{recursive:true,force:true});
await mkdir(new URL('dist/',root),{recursive:true});
await cp(new URL('public/',root),new URL('dist/',root),{recursive:true});
// Pages uses this to avoid a misleading SPA fallback if Functions are missing.
await writeFile(new URL('dist/404.html',root),'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found | RideArrivo</title><h1>This page is not available.</h1><p>The journal requires its Cloudflare Pages Functions deployment.</p><a href="/">Return to the journal</a></html>');
console.log('Built dist/ static assets. Cloudflare Pages compiles root functions/ automatically.');
