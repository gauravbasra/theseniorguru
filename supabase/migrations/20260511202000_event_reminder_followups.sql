create type public.event_automation_delivery_status as enum (
  'queued',
  'sent',
  'blocked'
);

create table public.event_reminders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  rsvp_id uuid not null references public.event_rsvps(id) on delete cascade,
  reminder_type text not null default 'event_reminder_48h',
  status public.event_automation_delivery_status not null default 'queued',
  scheduled_for timestamptz not null,
  recipient_email text not null,
  delivery_provider text,
  delivery_payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, rsvp_id, reminder_type)
);

create table public.event_followups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  rsvp_id uuid not null references public.event_rsvps(id) on delete cascade,
  followup_type text not null default 'post_event_review',
  status public.event_automation_delivery_status not null default 'queued',
  scheduled_for timestamptz not null,
  recipient_email text not null,
  delivery_provider text,
  delivery_payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, rsvp_id, followup_type)
);

create index event_reminders_status_schedule_idx on public.event_reminders (status, scheduled_for);
create index event_followups_status_schedule_idx on public.event_followups (status, scheduled_for);

alter table public.event_reminders enable row level security;
alter table public.event_followups enable row level security;
