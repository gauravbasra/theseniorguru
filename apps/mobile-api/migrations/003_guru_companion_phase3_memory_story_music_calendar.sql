-- Guru Companion Phase 3: memory graph, calendar/reminders, storyteller, music sessions.
CREATE TABLE IF NOT EXISTS guru_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'note',
  value TEXT NOT NULL,
  importance TEXT NOT NULL DEFAULT 'medium',
  source TEXT,
  visibility TEXT NOT NULL DEFAULT 'resident_and_trusted_circle',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guru_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  source TEXT NOT NULL DEFAULT 'guru',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guru_story_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'comfort',
  story TEXT NOT NULL,
  source TEXT,
  memory_ids UUID[] DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guru_music_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'youtube',
  query TEXT NOT NULL,
  mood TEXT,
  url TEXT,
  source TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guru_memories_resident_category ON guru_memories(resident_id, category, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_guru_calendar_events_resident_created ON guru_calendar_events(resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guru_story_sessions_resident_created ON guru_story_sessions(resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guru_music_sessions_resident_created ON guru_music_sessions(resident_id, created_at DESC);
