create table if not exists public.vendor_feed_connections (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null references public.data_sources(id) on delete cascade,
  vendor_name text not null,
  auth_type text not null default 'manual_upload' check (auth_type in ('api_key', 'sftp', 'oauth', 'manual_upload')),
  contract_status text not null default 'pending' check (contract_status in ('missing', 'pending', 'approved', 'blocked')),
  credential_storage_status text not null default 'missing' check (
    credential_storage_status in ('missing', 'reference_recorded', 'verified')
  ),
  field_mapping_status text not null default 'pending' check (field_mapping_status in ('missing', 'pending', 'approved', 'blocked')),
  credential_reference text,
  sample_file_url text,
  approved_by text,
  last_validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (data_source_id)
);

alter table public.vendor_feed_connections enable row level security;

create index if not exists vendor_feed_connections_source_idx
  on public.vendor_feed_connections (data_source_id);

create index if not exists vendor_feed_connections_readiness_idx
  on public.vendor_feed_connections (contract_status, credential_storage_status, field_mapping_status);
