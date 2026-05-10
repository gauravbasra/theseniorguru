create type public.community_post_status as enum (
  'published',
  'pending_moderation',
  'hidden',
  'removed',
  'blocked_by_policy'
);

create type public.community_post_type as enum (
  'question',
  'recommendation',
  'event',
  'provider_update',
  'expert_answer',
  'educational_tip',
  'offer',
  'safety_alert',
  'support_request'
);

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  city text,
  state text,
  description text,
  created_at timestamptz not null default now()
);

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references public.communities(id) on delete set null,
  provider_id uuid references public.providers(id) on delete set null,
  author_name text,
  post_type public.community_post_type not null default 'question',
  status public.community_post_status not null default 'pending_moderation',
  title text not null,
  body text,
  city text,
  state text,
  is_sponsored boolean not null default false,
  disclosure_label text,
  policy_check_id uuid references public.policy_checks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index community_posts_status_created_idx on public.community_posts (status, created_at desc);
create index community_posts_city_state_idx on public.community_posts (city, state);

create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_name text,
  body text not null,
  status public.community_post_status not null default 'pending_moderation',
  policy_check_id uuid references public.policy_checks(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid not null,
  reporter_email text,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

alter table public.communities enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reports enable row level security;

create policy "Public can read communities"
  on public.communities for select
  using (true);

create policy "Public can read published community posts"
  on public.community_posts for select
  using (status = 'published');

create policy "Public can read published community comments"
  on public.community_comments for select
  using (status = 'published');

create policy "Public can create community reports"
  on public.community_reports for insert
  with check (true);

