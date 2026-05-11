alter table public.extracted_entities
  add column if not exists address_line2 text,
  add column if not exists county text,
  add column if not exists latitude numeric(10, 7),
  add column if not exists longitude numeric(10, 7),
  add column if not exists email text,
  add column if not exists description text,
  add column if not exists care_types text[] not null default '{}',
  add column if not exists amenities text[] not null default '{}',
  add column if not exists services text[] not null default '{}',
  add column if not exists pricing_signals jsonb not null default '{}'::jsonb,
  add column if not exists license_fields jsonb not null default '{}'::jsonb,
  add column if not exists accreditation_fields jsonb not null default '{}'::jsonb,
  add column if not exists source_url text,
  add column if not exists source_record_id text,
  add column if not exists fetched_at timestamptz,
  add column if not exists license_terms_status text not null default 'unknown',
  add column if not exists robots_decision text not null default 'unknown',
  add column if not exists extraction_confidence numeric(4,3) not null default 0,
  add column if not exists duplicate_match_data jsonb not null default '{}'::jsonb,
  add column if not exists image_assets jsonb not null default '[]'::jsonb,
  add column if not exists audit_trail jsonb not null default '[]'::jsonb;

create index if not exists extracted_entities_source_record_idx
  on public.extracted_entities (source_record_id);

create index if not exists extracted_entities_location_quality_idx
  on public.extracted_entities (state, city, county);

create table if not exists public.extracted_entity_images (
  id uuid primary key default gen_random_uuid(),
  extracted_entity_id uuid not null references public.extracted_entities(id) on delete cascade,
  image_url text not null,
  source_url text not null,
  fetched_at timestamptz,
  license_terms_status text not null default 'unknown',
  robots_decision text not null default 'unknown',
  review_status text not null default 'pending_review' check (
    review_status in ('pending_review', 'approved_for_storage', 'rejected', 'needs_rights_review')
  ),
  storage_status text not null default 'not_stored' check (
    storage_status in ('not_stored', 'queued_for_storage', 'stored', 'blocked')
  ),
  alt_text text,
  credit text,
  ordinal integer not null default 1,
  created_at timestamptz not null default now(),
  unique (extracted_entity_id, image_url)
);

alter table public.extracted_entity_images enable row level security;

create index if not exists extracted_entity_images_entity_idx
  on public.extracted_entity_images (extracted_entity_id, ordinal);
