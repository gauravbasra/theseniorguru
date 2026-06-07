-- Native onboarding evidence and wearable connection state.
-- Binary media remains on-device or in object storage; this table stores capture metadata only.

alter table identity_evidence
  drop constraint if exists identity_evidence_verification_status_check;

alter table identity_evidence
  add constraint identity_evidence_verification_status_check
  check (verification_status in ('captured','pending','verified','failed','manual_review','expired'));

alter table identity_evidence
  drop constraint if exists identity_evidence_capture_method_check;

alter table identity_evidence
  add constraint identity_evidence_capture_method_check
  check (capture_method in ('camera','live_camera','upload','external_verification','healthkit','health_connect'));

create table if not exists wearable_connections (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid references residents(id) on delete cascade,
  account_id text,
  provider text not null,
  status text not null default 'pending' check (status in ('pending','connected','failed','revoked')),
  source text not null,
  requested_data_types text[] not null default '{}',
  native_diagnostics jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_wearable_connections_resident
  on wearable_connections(resident_id, provider);
