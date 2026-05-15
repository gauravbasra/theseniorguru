create table if not exists public.campaign_recommendation_actions (
  id uuid primary key default gen_random_uuid(),
  provider_id text,
  recommendation_id text not null,
  campaign_id text,
  action_type text not null check (action_type in ('create_task', 'queue_internal', 'mark_reviewed', 'dismiss')),
  status text not null default 'queued' check (status in ('queued', 'completed', 'dismissed', 'blocked_by_policy')),
  priority text not null check (priority in ('critical', 'high', 'medium', 'low')),
  category text not null check (category in ('launch', 'creative', 'traffic', 'conversion', 'measurement')),
  title text not null,
  action_payload jsonb not null default '{}'::jsonb,
  due_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.campaign_recommendation_actions enable row level security;

create index if not exists campaign_recommendation_actions_provider_idx
  on public.campaign_recommendation_actions (provider_id, created_at desc);

create index if not exists campaign_recommendation_actions_status_idx
  on public.campaign_recommendation_actions (status, priority, created_at desc);

create index if not exists campaign_recommendation_actions_recommendation_idx
  on public.campaign_recommendation_actions (recommendation_id, created_at desc);
