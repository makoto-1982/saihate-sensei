CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  delete_token_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS posts_created_at
ON posts(created_at DESC);

CREATE TABLE IF NOT EXISTS rate_limits (
  client_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  post_count INTEGER NOT NULL
);
