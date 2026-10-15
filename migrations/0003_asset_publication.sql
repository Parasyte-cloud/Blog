ALTER TABLE ra_blog_assets
  ADD COLUMN public_at TEXT;

ALTER TABLE ra_blog_assets
  ADD COLUMN public_by TEXT;

CREATE INDEX IF NOT EXISTS ra_blog_assets_publication
  ON ra_blog_assets(public_at, created_at DESC);
