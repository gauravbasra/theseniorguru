-- Feed editor, member preferences, media attachments, and business ad insertion.

ALTER TABLE social_feed_posts
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS post_type TEXT NOT NULL DEFAULT 'status'
    CHECK (post_type IN ('status','photo','question','announcement','activity')),
  ADD COLUMN IF NOT EXISTS target_connection_types TEXT[] NOT NULL DEFAULT '{family,friend,caregiver}'::text[],
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS media_object_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_connection_types TEXT[] NOT NULL DEFAULT '{family,friend,caregiver}'::text[],
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS social_feed_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  show_family BOOLEAN NOT NULL DEFAULT TRUE,
  show_friends BOOLEAN NOT NULL DEFAULT TRUE,
  show_caregivers BOOLEAN NOT NULL DEFAULT TRUE,
  show_community BOOLEAN NOT NULL DEFAULT TRUE,
  show_business_ads BOOLEAN NOT NULL DEFAULT TRUE,
  muted_group_ids UUID[] NOT NULL DEFAULT '{}',
  muted_user_ids UUID[] NOT NULL DEFAULT '{}',
  preferred_categories TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, resident_id)
);

CREATE TABLE IF NOT EXISTS business_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_media_object_id UUID REFERENCES media_objects(id) ON DELETE SET NULL,
  cta_label TEXT NOT NULL DEFAULT 'Learn more',
  cta_url TEXT,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  target_connection_types TEXT[] NOT NULL DEFAULT '{family,friend,caregiver}'::text[],
  target_communities TEXT[] NOT NULL DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'services',
  placement TEXT NOT NULL DEFAULT 'feed',
  frequency INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft','pending_review','active','paused','rejected','archived')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_ad_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id UUID NOT NULL REFERENCES business_ads(id) ON DELETE CASCADE,
  viewer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resident_id UUID REFERENCES residents(id) ON DELETE SET NULL,
  feed_position INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_feed_preferences_user ON social_feed_preferences(user_id, resident_id);
CREATE INDEX IF NOT EXISTS idx_business_ads_status_category ON business_ads(status, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_ad_impressions_ad_created ON business_ad_impressions(ad_id, created_at DESC);
