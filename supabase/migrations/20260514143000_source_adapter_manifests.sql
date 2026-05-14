create table if not exists public.source_adapter_manifests (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null references public.data_sources(id) on delete cascade,
  payload_kind text not null,
  file_name text not null,
  file_url text,
  checksum_sha256 text not null check (checksum_sha256 ~ '^[A-Fa-f0-9]{64}$'),
  record_count integer not null check (record_count > 0),
  storage_status text not null default 'registered' check (storage_status in ('registered', 'verified', 'blocked')),
  mapping_status text not null default 'pending' check (mapping_status in ('pending', 'approved', 'blocked')),
  approved_by text,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (data_source_id, checksum_sha256)
);

alter table public.source_adapter_manifests enable row level security;

create index if not exists source_adapter_manifests_source_idx
  on public.source_adapter_manifests (data_source_id, created_at desc);

create index if not exists source_adapter_manifests_readiness_idx
  on public.source_adapter_manifests (storage_status, mapping_status);
