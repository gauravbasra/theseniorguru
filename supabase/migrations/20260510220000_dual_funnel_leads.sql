create table if not exists public.family_inquiries (
  id uuid primary key default gen_random_uuid(),
  requester_name text not null,
  requester_email text,
  requester_phone text,
  city text,
  state text,
  care_type text,
  timeline text,
  budget text,
  message text,
  consent_to_contact boolean not null default false,
  status text not null default 'submitted',
  policy_decision text not null default 'approved',
  created_at timestamptz not null default now()
);

create table if not exists public.operator_demo_requests (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  contact_email text,
  contact_phone text,
  organization_name text not null,
  role text,
  community_count text,
  occupancy_challenge text,
  requested_product text,
  consent_to_contact boolean not null default false,
  status text not null default 'submitted',
  policy_decision text not null default 'approved',
  created_at timestamptz not null default now()
);

create table if not exists public.free_listing_requests (
  id uuid primary key default gen_random_uuid(),
  community_name text not null,
  contact_name text not null,
  contact_email text,
  contact_phone text,
  city text,
  state text,
  website_url text,
  care_types text[] not null default '{}',
  message text,
  consent_to_contact boolean not null default false,
  status text not null default 'submitted',
  policy_decision text not null default 'approved',
  created_at timestamptz not null default now()
);

alter table public.family_inquiries enable row level security;
alter table public.operator_demo_requests enable row level security;
alter table public.free_listing_requests enable row level security;

create index if not exists family_inquiries_location_idx on public.family_inquiries (state, city, care_type);
create index if not exists operator_demo_requests_created_idx on public.operator_demo_requests (created_at desc);
create index if not exists free_listing_requests_location_idx on public.free_listing_requests (state, city);
