import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export class LocalD1 {
  constructor() { this.sql = new DatabaseSync(':memory:'); this.sql.exec(readFileSync(new URL('../migrations/0001_blog_studio.sql',import.meta.url),'utf8')); }
  withSession() { return this; }
  prepare(sql) {
    const db=this.sql;
    const make=(args=[])=>({
      bind(...values){return make(values);},
      async first(column){const row=db.prepare(sql).get(...args) ?? null;return column&&row?row[column]:row;},
      async all(){return {success:true,results:db.prepare(sql).all(...args)};},
      async run(){const r=db.prepare(sql).run(...args);return {success:true,results:[],meta:{changes:Number(r.changes)}};},
    });
    return make();
  }
  async batch(statements) { this.sql.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());this.sql.exec('COMMIT');return out;}catch(e){this.sql.exec('ROLLBACK');throw e;} }
  close(){this.sql.close();}
}
export class LocalR2 {
  files=new Map();
  async put(key,bytes,options={}){this.files.set(key,{bytes:new Uint8Array(bytes),options});}
  async get(key){const v=this.files.get(key);return v?{body:v.bytes.slice(),httpMetadata:v.options.httpMetadata}:null;}
  async delete(key){this.files.delete(key);}
}
export const IDS={writer:'11111111-1111-4111-8111-111111111111',other:'22222222-2222-4222-8222-222222222222',editor:'33333333-3333-4333-8333-333333333333',admin:'44444444-4444-4444-8444-444444444444',workspace:'55555555-5555-4555-8555-555555555555'};
export const SAMPLE={title:'A calmer arrival',slug:'a-calmer-arrival',excerpt:'Thoughtful planning for your next journey to Lagos.',body:'# Before your journey\n\nA little planning goes a long way. '.repeat(4),category:'Travel guides',status:'draft',fact_checked:false,cover_media_id:null,cover_alt:'',editorial_note:''};
export const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
export function fixture(handleRequest){
 const identities=new Map(Object.entries(IDS).map(([name,id])=>[`${name}.jwt.token`,{employee_id:id,full_name:`Test ${name}`,active:true,role:name==='admin'?'blog_admin':name==='workspace'?null:name==='other'?'writer':name,can_manage_access:['admin','workspace'].includes(name)}]));
 let now=new Date('2026-10-13T12:00:00Z');let unavailable=false;let identityCalls=0;
 const env={DB:new LocalD1(),MEDIA:new LocalR2(),WORKSPACE_SUPABASE_URL:'https://workspace-example.supabase.co',WORKSPACE_SUPABASE_ANON_KEY:'public-anon-key',WORKSPACE_ORIGIN:'https://intranet.ridearrivo.com',SITE_URL:'https://blog.ridearrivo.com'};
 const services={now:()=>now,fetch:async(url,options)=>{identityCalls++;if(unavailable)throw Error('upstream down');assertSafeUrl(url);const token=options.headers.Authorization.replace('Bearer ','');const who=identities.get(token);if(!who)return new Response('{}',{status:401});return Response.json(who);}};
 function assertSafeUrl(url){if(!String(url).startsWith(env.WORKSPACE_SUPABASE_URL+'/rest/v1/rpc/'))throw Error('Unexpected upstream');}
 const send=(path,opts={})=>{const{as='writer',method='GET',data,raw,origin='https://intranet.ridearrivo.com',headers={}}=opts;const h={...headers};if(as)h.Authorization=`Bearer ${as}.jwt.token`;if(origin)h.Origin=origin;if(data!==undefined)h['Content-Type']='application/json';return handleRequest(new Request(`https://blog.ridearrivo.com${path}`,{method,headers:h,body:data!==undefined?JSON.stringify(data):raw}),env,services);};
 return {env,identities,send,now:(date)=>now=new Date(date),unavailable:()=>unavailable=true,identityCalls:()=>identityCalls,close:()=>env.DB.close()};
}
