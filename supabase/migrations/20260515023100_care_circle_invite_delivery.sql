alter table public.care_circle_members
  add column if not exists invite_delivery_provider text check (invite_delivery_provider in ('manual_export', 'internal_notification_queue')),
  add column if not exists invite_delivery_status text check (invite_delivery_status in ('pending', 'ready', 'manual_exported', 'queued', 'sent', 'blocked')),
  add column if not exists invite_sent_at timestamptz,
  add column if not exists invite_delivery_payload jsonb not null default '{}'::jsonb;

create index if not exists care_circle_members_invite_delivery_idx
  on public.care_circle_members (care_circle_id, invite_delivery_status, invite_sent_at desc);
