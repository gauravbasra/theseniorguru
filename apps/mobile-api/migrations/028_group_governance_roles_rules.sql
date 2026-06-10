-- Group governance: roles, member permissions, rules, and moderation controls.

ALTER TABLE social_groups
  ADD COLUMN IF NOT EXISTS rules JSONB NOT NULL DEFAULT '{
    "posting": "members",
    "invites": "admins",
    "memberApproval": "admins",
    "commenting": "members",
    "visibility": "invite_only"
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{
    "owner": ["manage_group","manage_rules","manage_roles","add_members","remove_members","post","comment","react","moderate_content"],
    "admin": ["add_members","remove_members","post","comment","react","moderate_content"],
    "moderator": ["post","comment","react","moderate_content"],
    "member": ["post","comment","react"]
  }'::jsonb;

ALTER TABLE social_group_members
  ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
  DROP CONSTRAINT IF EXISTS social_group_members_member_role_check;

ALTER TABLE social_group_members
  ADD CONSTRAINT social_group_members_member_role_check
  CHECK (member_role IN ('owner','admin','moderator','member'));

CREATE TABLE IF NOT EXISTS social_group_rule_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES social_groups(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  before_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_group_rule_events_group_created
  ON social_group_rule_events(group_id, created_at DESC);
