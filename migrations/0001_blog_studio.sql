-- New, namespaced tables only. Inspect existing D1 tables before applying.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS ra_blog_media (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  mime TEXT NOT NULL CHECK (mime IN ('image/jpeg','image/png','image/webp')),
  bytes INTEGER NOT NULL CHECK (bytes > 0 AND bytes <= 5242880),
  filename TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  uploaded_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ra_blog_posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('Mobility','Travel guides','Company news','For drivers')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','scheduled','published','archived')),
  published_at TEXT,
  cover_media_id TEXT REFERENCES ra_blog_media(id) ON DELETE RESTRICT,
  cover_alt TEXT NOT NULL DEFAULT '',
  editorial_note TEXT NOT NULL DEFAULT '',
  fact_checked INTEGER NOT NULL DEFAULT 0 CHECK (fact_checked IN (0,1)),
  ever_published INTEGER NOT NULL DEFAULT 0 CHECK (ever_published IN (0,1)),
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
);
CREATE INDEX IF NOT EXISTS ra_blog_public ON ra_blog_posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS ra_blog_author ON ra_blog_posts(author_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS ra_blog_media_owner ON ra_blog_media(uploaded_by, uploaded_at DESC);
CREATE TABLE IF NOT EXISTS ra_blog_revisions (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('created','updated','deleted')),
  actor_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  title TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ra_blog_revisions_post ON ra_blog_revisions(post_id, created_at DESC);
CREATE TRIGGER IF NOT EXISTS ra_blog_revision_insert AFTER INSERT ON ra_blog_posts
BEGIN
  INSERT INTO ra_blog_revisions VALUES (
    lower(hex(randomblob(16))), NEW.id, NEW.version, 'created', NEW.updated_by, NEW.author_id, NEW.title,
    json_object('title',NEW.title,'slug',NEW.slug,'excerpt',NEW.excerpt,'body',NEW.body,'category',NEW.category,'status',NEW.status,'published_at',NEW.published_at,'cover_media_id',NEW.cover_media_id,'cover_alt',NEW.cover_alt,'editorial_note',NEW.editorial_note,'fact_checked',NEW.fact_checked), NEW.updated_at
  );
END;
CREATE TRIGGER IF NOT EXISTS ra_blog_revision_update AFTER UPDATE ON ra_blog_posts WHEN NEW.version > OLD.version
BEGIN
  INSERT INTO ra_blog_revisions VALUES (
    lower(hex(randomblob(16))), NEW.id, NEW.version, 'updated', NEW.updated_by, NEW.author_id, NEW.title,
    json_object('title',NEW.title,'slug',NEW.slug,'excerpt',NEW.excerpt,'body',NEW.body,'category',NEW.category,'status',NEW.status,'published_at',NEW.published_at,'cover_media_id',NEW.cover_media_id,'cover_alt',NEW.cover_alt,'editorial_note',NEW.editorial_note,'fact_checked',NEW.fact_checked), NEW.updated_at
  );
END;
