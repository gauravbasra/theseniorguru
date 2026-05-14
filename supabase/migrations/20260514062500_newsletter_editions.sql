create table if not exists public.newsletter_editions (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'scheduled', 'sent', 'blocked_by_policy')),
  subject text not null,
  audience text[] not null default '{}',
  article_ids text[] not null default '{}',
  intro text,
  scheduled_for timestamptz,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  policy_check_id uuid references public.policy_checks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.newsletter_editions enable row level security;
