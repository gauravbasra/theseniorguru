create table if not exists public.policy_approval_requests (
  id uuid primary key default gen_random_uuid(),
  policy_check_id uuid not null references public.policy_checks(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'expired')),
  reason text not null,
  requested_by text not null default 'admin',
  reviewed_by text,
  review_notes text,
  expires_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists policy_approval_requests_status_created_idx
  on public.policy_approval_requests (status, created_at desc);

create index if not exists policy_approval_requests_policy_check_idx
  on public.policy_approval_requests (policy_check_id, created_at desc);

create table if not exists public.policy_overrides (
  id uuid primary key default gen_random_uuid(),
  approval_request_id uuid not null references public.policy_approval_requests(id) on delete cascade,
  policy_check_id uuid not null references public.policy_checks(id) on delete cascade,
  reason text not null,
  approved_by text not null default 'admin',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists policy_overrides_policy_check_created_idx
  on public.policy_overrides (policy_check_id, created_at desc);

alter table public.policy_approval_requests enable row level security;
alter table public.policy_overrides enable row level security;
