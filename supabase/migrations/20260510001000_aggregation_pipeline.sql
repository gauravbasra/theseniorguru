create type public.import_batch_status as enum (
  'draft',
  'queued',
  'running',
  'completed',
  'completed_with_errors',
  'failed',
  'blocked_by_policy'
);

create type public.crawl_job_status as enum (
  'queued',
  'running',
  'completed',
  'failed',
  'blocked_by_policy'
);

create type public.entity_review_status as enum (
  'pending',
  'approved',
  'rejected',
  'duplicate',
  'needs_human_review',
  'needs_legal_review'
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid references public.data_sources(id) on delete set null,
  status public.import_batch_status not null default 'draft',
  name text not null,
  source_kind text not null,
  total_records integer not null default 0,
  imported_records integer not null default 0,
  rejected_records integer not null default 0,
  error_records integer not null default 0,
  policy_check_id uuid references public.policy_checks(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.crawl_jobs (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null references public.data_sources(id) on delete cascade,
  status public.crawl_job_status not null default 'queued',
  seed_url text not null,
  max_pages integer not null default 50,
  pages_seen integer not null default 0,
  pages_imported integer not null default 0,
  robots_decision text,
  policy_check_id uuid references public.policy_checks(id) on delete set null,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.crawl_pages (
  id uuid primary key default gen_random_uuid(),
  crawl_job_id uuid not null references public.crawl_jobs(id) on delete cascade,
  url text not null,
  status_code integer,
  content_hash text,
  title text,
  extracted_text text,
  fetched_at timestamptz not null default now(),
  unique (crawl_job_id, url)
);

create table public.extracted_entities (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid references public.import_batches(id) on delete set null,
  crawl_page_id uuid references public.crawl_pages(id) on delete set null,
  review_status public.entity_review_status not null default 'pending',
  entity_type text not null default 'provider',
  name text not null,
  normalized_name text,
  address_line1 text,
  city text,
  state text,
  postal_code text,
  phone text,
  website_url text,
  categories text[] not null default '{}',
  raw_payload jsonb not null default '{}'::jsonb,
  extracted_fields jsonb not null default '{}'::jsonb,
  confidence_score numeric(4,3) not null default 0,
  matched_provider_id uuid references public.providers(id) on delete set null,
  created_at timestamptz not null default now()
);

create index extracted_entities_name_trgm_idx on public.extracted_entities using gin (name extensions.gin_trgm_ops);
create index extracted_entities_review_status_idx on public.extracted_entities (review_status);

create table public.entity_match_candidates (
  id uuid primary key default gen_random_uuid(),
  extracted_entity_id uuid not null references public.extracted_entities(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  match_score numeric(4,3) not null default 0,
  match_reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (extracted_entity_id, provider_id)
);

create table public.data_quality_flags (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  flag_key text not null,
  message text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.import_batches enable row level security;
alter table public.crawl_jobs enable row level security;
alter table public.crawl_pages enable row level security;
alter table public.extracted_entities enable row level security;
alter table public.entity_match_candidates enable row level security;
alter table public.data_quality_flags enable row level security;

