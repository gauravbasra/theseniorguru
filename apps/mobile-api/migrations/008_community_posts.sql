create table if not exists community_posts (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid references residents(id) on delete set null,
  author_user_id uuid references users(id) on delete set null,
  body text not null,
  audience text not null default 'community',
  status text not null default 'published' check (status in ('draft','published','hidden','reported')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_community_posts_created on community_posts(created_at desc);
create index if not exists idx_community_posts_author on community_posts(author_user_id);
