-- Mobile domain action parity plus first-pass scale primitives.

create table if not exists community_event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  resident_id uuid references residents(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  status text not null default 'interested' check (status in ('interested','going','cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, user_id)
);

create table if not exists resident_messages (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid references residents(id) on delete cascade,
  sender_user_id uuid references users(id) on delete set null,
  recipient_key text,
  priority text not null default 'normal',
  body text not null,
  status text not null default 'sent',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_community_event_rsvps_user_created
  on community_event_rsvps(user_id, created_at desc);

create index if not exists idx_resident_messages_resident_created
  on resident_messages(resident_id, created_at desc);

-- Hot/event tables need tenant/user/time indexes before traffic grows.
create index if not exists idx_audit_logs_created_entity
  on audit_logs(created_at desc, entity_type);

create index if not exists idx_notifications_user_status_created
  on notifications(user_id, status, created_at desc);

create index if not exists idx_health_vitals_created_resident
  on health_vitals(created_at desc, resident_id);

create index if not exists idx_wearable_telemetry_created_resident
  on wearable_telemetry(created_at desc, resident_id);

create index if not exists idx_safety_telemetry_created_resident
  on safety_telemetry(created_at desc, resident_id);
