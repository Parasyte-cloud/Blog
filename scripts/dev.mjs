import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { LocalDatabase, LocalImages } from './local-store.mjs';
import { handleRequest } from '../src/server/app.mjs';
import { savePost } from '../src/server/content.mjs';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
mkdirSync('.local',{recursive:true});
const demo=process.argv.includes('--demo'), db=new LocalDatabase(demo?':memory:':'.local/blog.sqlite');
const publicRoot=resolve('public');
const types={'.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.txt':'text/plain; charset=utf-8'};
const env={DB:db,MEDIA:new LocalImages('.local/media'),SITE_URL:process.env.SITE_URL||'https://blog.ridearrivo.com',WORKSPACE_ORIGIN:process.env.WORKSPACE_ORIGIN||'http://localhost:5173',WORKSPACE_SUPABASE_URL:process.env.WORKSPACE_SUPABASE_URL,WORKSPACE_SUPABASE_ANON_KEY:process.env.WORKSPACE_SUPABASE_ANON_KEY,ASSETS:{async fetch(request){const pathname=decodeURIComponent(new URL(request.url).pathname);const path=resolve(publicRoot,'.'+pathname);if(!path.startsWith(publicRoot+sep)||!existsSync(path))return new Response('Not found',{status:404});const extension=path.slice(path.lastIndexOf('.'));return new Response(readFileSync(path),{headers:{'Content-Type':types[extension]||'application/octet-stream'}});}}};
if(demo){
  const source=JSON.parse(readFileSync('content/uber-next-chapter.article.json','utf8'));
  const titles=[source,{title:'A little planning. A calmer arrival.',slug:'a-calmer-arrival',excerpt:'Make room for the journey: a thoughtful guide to preparing for your arrival in Lagos.',category:'Travel guides',body:'## Before you travel\n\nKeep your arrival details together. Check the date, terminal and meeting arrangements before setting off.\n\n## Leave room for the unexpected\n\nBuild flexibility into your plans and agree a way to get in touch if things change.'},{title:'The person behind the journey.',slug:'person-behind-the-journey',excerpt:'A good journey is about more than the destination. It starts with the people who make it possible.',category:'For drivers',body:'## The human side of mobility\n\nEvery journey brings a different person, purpose and expectation. Clear communication and thoughtful preparation can make a meaningful difference.'}];
  for(const [i,post] of titles.entries())await savePost(db,{...post,status:'published',fact_checked:true,published_at:new Date(Date.now()-i*86400000).toISOString()},null,{employee_id:'44444444-4444-4444-8444-444444444444',full_name:'RideArrivo Editorial',role:'blog_admin'},new Date());
  console.log('DEMO: temporary in-memory stories for visual review only. No deployment or live database changes.');
}
const server=createServer(async(req,res)=>{try{const request=new Request('http://127.0.0.1:8788'+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});const response=await handleRequest(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));if(response.body)Readable.fromWeb(response.body).pipe(res);else res.end();}catch(error){res.writeHead(500,{'Content-Type':'text/plain'});res.end('Local server error.');console.error(error);}});
server.listen(8788,'127.0.0.1',()=>console.log('Public preview: http://127.0.0.1:8788 (local only). Protected APIs require a real configured workspace session.'));
