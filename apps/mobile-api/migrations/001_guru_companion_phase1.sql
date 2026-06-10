-- Guru Companion Phase 1
-- Run after the base schema when using PostgreSQL-backed production mode.

create table if not exists guru_conversations (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid null,
  message text not null,
  reply text not null,
  intent text not null default 'general',
  navigate_to text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists guru_tasks (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid null,
  title text not null,
  status text not null default 'open',
  source text not null default 'guru',
  due_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);

create table if not exists guru_scan_intents (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid null,
  scan_type text not null,
  label text not null,
  status text not null default 'created',
  image_url text null,
  vision_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);

create index if not exists idx_guru_conversations_created_at on guru_conversations(created_at desc);
create index if not exists idx_guru_tasks_status on guru_tasks(status);
create index if not exists idx_guru_scan_intents_status on guru_scan_intents(status);
