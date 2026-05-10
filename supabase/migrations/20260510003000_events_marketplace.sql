create type public.event_status as enum (
  'draft',
  'published',
  'featured',
  'canceled',
  'completed',
  'blocked_by_policy'
);

create type public.event_rsvp_status as enum (
  'confirmed',
  'waitlisted',
  'canceled',
  'attended',
  'no_show'
);

create type public.event_promotion_status as enum (
  'draft',
  'pending_policy',
  'active',
  'paused',
  'completed',
  'blocked'
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers(id) on delete set null,
  title text not null,
  slug text not null unique,
  description text,
  event_type text not null,
  status public.event_status not null default 'draft',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'America/Denver',
  venue_name text,
  address_line1 text,
  city text,
  state text,
  postal_code text,
  capacity integer,
  is_free boolean not null default true,
  registration_url text,
  policy_check_id uuid references public.policy_checks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_time_order check (ends_at > starts_at)
);

create index events_status_starts_idx on public.events (status, starts_at);
create index events_city_state_idx on public.events (city, state);

create table public.event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  attendee_name text not null,
  attendee_email text not null,
  attendee_phone text,
  party_size integer not null default 1 check (party_size > 0),
  status public.event_rsvp_status not null default 'confirmed',
  consent_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (event_id, attendee_email)
);

create table public.event_promotions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  status public.event_promotion_status not null default 'draft',
  placement_key text not null,
  budget_cents integer not null default 0 check (budget_cents >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  disclosure_label text not null default 'Sponsored',
  policy_check_id uuid references public.policy_checks(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.event_promotions enable row level security;

create policy "Public can read published events"
  on public.events for select
  using (status in ('published', 'featured'));

create policy "Public can create event RSVPs"
  on public.event_rsvps for insert
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_rsvps.event_id
        and e.status in ('published', 'featured')
    )
  );

