DO $$ BEGIN
  CREATE TYPE gender_identity AS ENUM ('female', 'male', 'non_binary', 'prefer_not_to_say', 'self_describe', 'unspecified');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS gender gender_identity NOT NULL DEFAULT 'unspecified';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

ALTER TABLE users
  ALTER COLUMN role DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower_email_unique ON users (lower(email)) WHERE email IS NOT NULL;
