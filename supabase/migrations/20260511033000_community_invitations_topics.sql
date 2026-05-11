create table public.community_invitations (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  inviter_user_key text not null,
  recipient_email text not null,
  recipient_name text,
  role public.community_member_role not null default 'family',
  status text not null default 'queued' check (status in ('queued', 'sent', 'accepted', 'declined', 'blocked')),
  delivery_channel text not null default 'email' check (delivery_channel in ('email', 'sms', 'manual')),
  delivery_provider text,
  delivery_id text,
  delivery_payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index community_invitations_community_status_idx
  on public.community_invitations (community_id, status, created_at desc);

create index community_invitations_recipient_idx
  on public.community_invitations (lower(recipient_email), created_at desc);

create table public.community_topic_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  topic_key text not null,
  topic_label text,
  city text,
  state text,
  scope_key text not null default '*:*',
  status text not null default 'active' check (status in ('active', 'paused', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_key, topic_key, scope_key)
);

create index community_topic_subscriptions_topic_scope_idx
  on public.community_topic_subscriptions (topic_key, scope_key, status, updated_at desc);

create index community_topic_subscriptions_user_idx
  on public.community_topic_subscriptions (user_key, updated_at desc);

alter table public.community_invitations enable row level security;
alter table public.community_topic_subscriptions enable row level security;

create policy "Public can read sent community invitations"
  on public.community_invitations for select
  using (status in ('sent', 'accepted'));

create policy "Public can read active topic subscriptions"
  on public.community_topic_subscriptions for select
  using (status = 'active');
