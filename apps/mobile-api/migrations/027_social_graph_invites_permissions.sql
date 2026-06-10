-- Social graph, viral invitations, and explicit trust-circle permissions.

ALTER TABLE trusted_connections
  ADD COLUMN IF NOT EXISTS connection_type TEXT NOT NULL DEFAULT 'family'
    CHECK (connection_type IN ('family','friend','caregiver')),
  ADD COLUMN IF NOT EXISTS health_access_status TEXT NOT NULL DEFAULT 'not_requested'
    CHECK (health_access_status IN ('not_requested','pending_senior_approval','approved','denied','revoked')),
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invite_channel TEXT,
  ADD COLUMN IF NOT EXISTS invite_message TEXT;

ALTER TABLE trusted_invites
  ADD COLUMN IF NOT EXISTS connection_type TEXT NOT NULL DEFAULT 'family'
    CHECK (connection_type IN ('family','friend','caregiver')),
  ADD COLUMN IF NOT EXISTS invited_name TEXT,
  ADD COLUMN IF NOT EXISTS invite_channel TEXT,
  ADD COLUMN IF NOT EXISTS invite_message TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','expired','revoked')),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS social_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  group_type TEXT NOT NULL DEFAULT 'community'
    CHECK (group_type IN ('family','friends','caregivers','community','activity')),
  visibility TEXT NOT NULL DEFAULT 'invite_only'
    CHECK (visibility IN ('private','invite_only','community')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','archived')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES social_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_role TEXT NOT NULL DEFAULT 'member'
    CHECK (member_role IN ('owner','admin','member')),
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('invited','active','removed','left')),
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS social_feed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_post_id UUID UNIQUE REFERENCES community_posts(id) ON DELETE CASCADE,
  group_id UUID REFERENCES social_groups(id) ON DELETE SET NULL,
  resident_id UUID REFERENCES residents(id) ON DELETE SET NULL,
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  media_object_ids UUID[] NOT NULL DEFAULT '{}',
  visibility TEXT NOT NULL DEFAULT 'community'
    CHECK (visibility IN ('community','group','circle','private')),
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published','hidden','deleted')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  feed_post_id UUID REFERENCES social_feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL DEFAULT 'heart',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, reaction_type),
  UNIQUE (feed_post_id, user_id, reaction_type)
);

CREATE TABLE IF NOT EXISTS social_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  feed_post_id UUID REFERENCES social_feed_posts(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES social_post_comments(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published','hidden','deleted')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS imported_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_hash TEXT NOT NULL,
  display_name TEXT,
  phone TEXT,
  email TEXT,
  source TEXT NOT NULL DEFAULT 'phone_contacts',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, contact_hash)
);

CREATE TABLE IF NOT EXISTS social_invite_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  invited_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_name TEXT,
  invited_phone TEXT,
  invited_email TEXT,
  connection_type TEXT NOT NULL CHECK (connection_type IN ('family','friend','caregiver')),
  invite_channel TEXT NOT NULL DEFAULT 'copy_link',
  invite_message TEXT NOT NULL,
  invite_token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','expired','revoked')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_groups_resident ON social_groups(resident_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_group_members_user ON social_group_members(user_id, status);
CREATE INDEX IF NOT EXISTS idx_social_feed_posts_group ON social_feed_posts(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_post_comments_post ON social_post_comments(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_post_reactions_post ON social_post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_imported_contacts_owner ON imported_contacts(owner_user_id, display_name);
CREATE INDEX IF NOT EXISTS idx_social_invite_events_inviter ON social_invite_events(inviter_user_id, created_at DESC);
