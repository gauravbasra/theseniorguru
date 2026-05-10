create type public.review_status as enum (
  'pending_moderation',
  'published',
  'hidden',
  'removed',
  'blocked_by_policy'
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  reviewer_name text not null,
  reviewer_email text,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text,
  status public.review_status not null default 'pending_moderation',
  source text not null default 'first_party',
  verification_payload jsonb not null default '{}'::jsonb,
  policy_check_id uuid references public.policy_checks(id) on delete set null,
  created_at timestamptz not null default now()
);

create index reviews_provider_status_idx on public.reviews (provider_id, status);

create table public.review_responses (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  provider_id uuid references public.providers(id) on delete set null,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'published', 'blocked')),
  generated_by_ai boolean not null default false,
  policy_check_id uuid references public.policy_checks(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table public.review_requests (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  recipient_name text,
  recipient_email text,
  channel text not null default 'email',
  status text not null default 'queued',
  consent_payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;
alter table public.review_responses enable row level security;
alter table public.review_requests enable row level security;

create policy "Public can read published reviews"
  on public.reviews for select
  using (status = 'published');

create policy "Public can submit reviews"
  on public.reviews for insert
  with check (true);

create policy "Public can read published review responses"
  on public.review_responses for select
  using (status = 'published');

