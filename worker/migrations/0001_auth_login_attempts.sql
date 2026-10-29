-- Shared D1-backed login throttling for Cloudflare Worker instances.
CREATE TABLE IF NOT EXISTS auth_login_attempts (
  attempt_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_window
  ON auth_login_attempts(window_start);
