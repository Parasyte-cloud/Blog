PRAGMA foreign_keys = ON;

ALTER TABLE ra_blog_posts
  ADD COLUMN content_type TEXT NOT NULL DEFAULT 'article'
  CHECK (content_type IN ('article','quick_post'));

CREATE TABLE IF NOT EXISTS ra_blog_assets (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 15728640),
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('image','source','attachment')),
  uploaded_by TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  sha256 TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ra_blog_assets_uploader
  ON ra_blog_assets(uploaded_by, created_at DESC);

CREATE TABLE IF NOT EXISTS ra_blog_post_assets (
  post_id TEXT NOT NULL REFERENCES ra_blog_posts(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES ra_blog_assets(id) ON DELETE RESTRICT,
  relationship TEXT NOT NULL CHECK (relationship IN ('cover','source','attachment','inline')),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TEXT NOT NULL,
  UNIQUE(post_id, asset_id, relationship)
);

CREATE INDEX IF NOT EXISTS ra_blog_post_assets_post
  ON ra_blog_post_assets(post_id, relationship, sort_order, created_at);
CREATE INDEX IF NOT EXISTS ra_blog_post_assets_asset
  ON ra_blog_post_assets(asset_id, post_id);

CREATE TABLE IF NOT EXISTS ra_blog_asset_events (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL CHECK (event IN ('uploaded','linked','unlinked','imported')),
  actor_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  post_id TEXT,
  relationship TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ra_blog_asset_events_time
  ON ra_blog_asset_events(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS ra_blog_asset_events_actor
  ON ra_blog_asset_events(actor_id, created_at DESC);
