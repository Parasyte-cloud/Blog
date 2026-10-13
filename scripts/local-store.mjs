/** Local-only SQLite/R2 adapters. No production or authentication fallback. */
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';

const migrationRoot = new URL('../migrations/', import.meta.url);

export class LocalDatabase {
  constructor(path){
    this.sqlite=new DatabaseSync(path);
    this.sqlite.exec('PRAGMA foreign_keys = ON');
    this.sqlite.exec('CREATE TABLE IF NOT EXISTS ra_local_schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
    const migrations=readdirSync(migrationRoot).filter(name=>/^\d+_.+\.sql$/.test(name)).sort();
    for(const name of migrations){
      const applied=this.sqlite.prepare('SELECT 1 FROM ra_local_schema_migrations WHERE name=?').get(name);
      if(applied)continue;
      const sql=readFileSync(new URL(name,migrationRoot),'utf8').replace(/^\s*PRAGMA foreign_keys\s*=\s*ON;\s*/i,'');
      this.sqlite.exec('BEGIN');
      try{
        this.sqlite.exec(sql);
        this.sqlite.prepare('INSERT INTO ra_local_schema_migrations (name,applied_at) VALUES (?,?)').run(name,new Date().toISOString());
        this.sqlite.exec('COMMIT');
      }catch(error){
        this.sqlite.exec('ROLLBACK');
        throw error;
      }
    }
  }
  withSession(){return this;}
  prepare(sql){const db=this.sqlite;const statement=(args=[])=>({bind(...values){return statement(values);},async first(col){const row=db.prepare(sql).get(...args)??null;return col&&row?row[col]:row;},async all(){return {success:true,results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}};}});return statement();}
  async batch(statements){this.sqlite.exec('BEGIN');try{const out=[];for(const stmt of statements)out.push(await stmt.run());this.sqlite.exec('COMMIT');return out;}catch(e){this.sqlite.exec('ROLLBACK');throw e;}}
}
export class LocalImages {
  constructor(folder){this.folder=folder;mkdirSync(folder,{recursive:true});}
  path(key){
    if(!/^(covers|images|sources|attachments)\/[a-f0-9-]+\.[a-z0-9]{1,8}$/.test(key))throw Error('Invalid local object key');
    return key.startsWith('covers/')?join(this.folder,key.slice(7)):join(this.folder,key);
  }
  async put(key,bytes){const path=this.path(key);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,bytes);}
  async get(key){const path=this.path(key);return existsSync(path)?{body:readFileSync(path)}:null;}
  async delete(key){const {rm}=await import('node:fs/promises');await rm(this.path(key),{force:true});}
}
