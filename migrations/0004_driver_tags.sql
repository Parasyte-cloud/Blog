-- Topics for driver posts. A post can carry more than one topic, and a topic can be renamed
-- without breaking its public link, because the link uses the stable slug, not the label.
CREATE TABLE IF NOT EXISTS ra_blog_tags (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ra_blog_post_tags (
  post_id TEXT NOT NULL REFERENCES ra_blog_posts(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES ra_blog_tags(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (post_id, tag_id)
);
CREATE INDEX IF NOT EXISTS ra_blog_post_tags_tag ON ra_blog_post_tags(tag_id, post_id);
