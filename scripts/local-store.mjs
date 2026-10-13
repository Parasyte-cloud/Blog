/** Local-only SQLite/R2 adapters. No production or authentication fallback. */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
export class LocalDatabase {
  constructor(path){this.sqlite=new DatabaseSync(path);this.sqlite.exec(readFileSync(new URL('../migrations/0001_blog_studio.sql',import.meta.url),'utf8'));}
  withSession(){return this;}
  prepare(sql){const db=this.sqlite;const statement=(args=[])=>({bind(...values){return statement(values);},async first(col){const row=db.prepare(sql).get(...args)??null;return col&&row?row[col]:row;},async all(){return {success:true,results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}};}});return statement();}
  async batch(statements){this.sqlite.exec('BEGIN');try{const out=[];for(const stmt of statements)out.push(await stmt.run());this.sqlite.exec('COMMIT');return out;}catch(e){this.sqlite.exec('ROLLBACK');throw e;}}
}
export class LocalImages {
  constructor(folder){this.folder=folder;mkdirSync(folder,{recursive:true});}
  path(key){if(!/^covers\/[a-f0-9-]+\.(png|jpg|webp)$/.test(key))throw Error('Invalid local object key');return join(this.folder,key.slice(7));}
  async put(key,bytes){writeFileSync(this.path(key),bytes);}
  async get(key){const path=this.path(key);return existsSync(path)?{body:readFileSync(path)}:null;}
  async delete(key){const {rm}=await import('node:fs/promises');await rm(this.path(key),{force:true});}
}
