create table if not exists public.voice_campaigns (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  assistant_name text not null,
  status text not null default 'preview' check (status in ('preview', 'queued', 'configured', 'blocked_by_policy', 'failed')),
  delivery_provider text not null default 'manual_export' check (
    delivery_provider in ('manual_export', 'internal_notification_queue', 'twilio', 'retell', 'elevenlabs')
  ),
  phone_number text,
  transfer_number text,
  greeting text not null,
  missed_call_policy text not null default 'capture_callback' check (
    missed_call_policy in ('capture_callback', 'route_to_staff', 'send_sms_followup')
  ),
  readiness_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.voice_campaigns enable row level security;

create index if not exists voice_campaigns_provider_created_idx
  on public.voice_campaigns (provider_id, created_at desc);

create index if not exists voice_campaigns_status_provider_idx
  on public.voice_campaigns (status, delivery_provider, created_at desc);
