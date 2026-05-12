create table public.event_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  rsvp_id uuid not null references public.event_rsvps(id) on delete cascade,
  status public.event_rsvp_status not null check (status in ('attended', 'no_show')),
  checked_in_at timestamptz,
  attendance_source text not null default 'provider_console',
  notes text,
  actor_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, rsvp_id)
);

create index event_attendance_event_status_idx on public.event_attendance (event_id, status);

alter table public.event_attendance enable row level security;
