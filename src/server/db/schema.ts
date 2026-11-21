export const schemaSql = `
-- Schéma CARDMail (Neon / PostgreSQL). Appliqué automatiquement au premier appel (IF NOT EXISTS).
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY, email text UNIQUE NOT NULL, first_name text NOT NULL, last_name text NOT NULL,
  password_hash text NOT NULL, avatar_url text, role text NOT NULL DEFAULT 'USER', is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS inboxes (
  id text PRIMARY KEY, resend_inbox_id text UNIQUE NOT NULL, email_address text UNIQUE NOT NULL, display_name text NOT NULL DEFAULT '',
  from_name text NOT NULL DEFAULT '', sync_status text NOT NULL DEFAULT 'ACTIVE', last_sync_at timestamptz, last_error text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS user_inboxes (
  id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, inbox_id text NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
  is_default boolean NOT NULL DEFAULT false, assigned_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, inbox_id));
CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY, token_hash text UNIQUE NOT NULL, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address text, user_agent text, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS password_resets (
  id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS contacts (
  id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, name text NOT NULL, email text NOT NULL,
  organization text, phone text, notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email));
CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, inbox_id text NOT NULL,
  thread_id text, title text NOT NULL, body text NOT NULL DEFAULT '', read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, endpoint text UNIQUE NOT NULL,
  p256dh text NOT NULL, auth text NOT NULL, user_agent text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS preferences (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, theme text NOT NULL DEFAULT 'system',
  signature_html text NOT NULL DEFAULT '', push_enabled boolean NOT NULL DEFAULT false, compact_density boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS starred_threads (
  id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, inbox_id text NOT NULL, thread_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, inbox_id, thread_id));
CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY, actor_user_id text, actor_email text, action text NOT NULL, target_type text, target_id text,
  status text NOT NULL, ip_address text, details text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_logs(created_at DESC);
CREATE TABLE IF NOT EXISTS webhook_events (
  svix_id text PRIMARY KEY, event_type text NOT NULL, inbox_id text, status text NOT NULL, error_message text,
  received_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY, count integer NOT NULL, reset_at timestamptz NOT NULL);
`;
