create type public.care_note_visibility as enum (
  'private',
  'care_circle'
);

create type public.tour_plan_status as enum (
  'planned',
  'requested',
  'scheduled',
  'completed',
  'canceled'
);

create table public.comparison_lists (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  name text not null,
  provider_ids uuid[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comparison_lists_user_created_idx on public.comparison_lists (user_key, created_at desc);

create table public.comparison_list_providers (
  id uuid primary key default gen_random_uuid(),
  comparison_list_id uuid not null references public.comparison_lists(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comparison_list_id, provider_id)
);

create index comparison_list_providers_list_idx on public.comparison_list_providers (comparison_list_id);

create table public.care_notes (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  care_circle_id uuid references public.care_circles(id) on delete cascade,
  provider_id uuid references public.providers(id) on delete set null,
  note text not null,
  visibility public.care_note_visibility not null default 'private',
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index care_notes_user_created_idx on public.care_notes (user_key, created_at desc);
create index care_notes_circle_idx on public.care_notes (care_circle_id);

create table public.tour_plans (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  provider_id uuid not null references public.providers(id) on delete cascade,
  care_circle_id uuid references public.care_circles(id) on delete set null,
  status public.tour_plan_status not null default 'requested',
  preferred_dates text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tour_plans_user_created_idx on public.tour_plans (user_key, created_at desc);
create index tour_plans_provider_idx on public.tour_plans (provider_id);

create table public.app_notification_preferences (
  user_key text primary key,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  push_enabled boolean not null default true,
  quiet_hours jsonb not null default '{}'::jsonb,
  topics text[] not null default array['saved_providers', 'tour_reminders', 'community_replies', 'local_events'],
  updated_at timestamptz not null default now()
);

create table public.provider_profile_audits (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  actor_id text,
  change_type text not null,
  changed_fields text[] not null default '{}',
  proposed_payload jsonb not null default '{}'::jsonb,
  policy_decision public.policy_decision_status not null,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected', 'applied')),
  reviewer_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index provider_profile_audits_provider_created_idx on public.provider_profile_audits (provider_id, created_at desc);

alter table public.comparison_lists enable row level security;
alter table public.comparison_list_providers enable row level security;
alter table public.care_notes enable row level security;
alter table public.tour_plans enable row level security;
alter table public.app_notification_preferences enable row level security;
alter table public.provider_profile_audits enable row level security;
