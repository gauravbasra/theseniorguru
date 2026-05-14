create table if not exists public.policy_review_assignments (
  id uuid primary key default gen_random_uuid(),
  policy_check_id uuid not null references public.policy_checks(id) on delete cascade,
  assigned_to text not null,
  assigned_role text not null check (assigned_role in ('policy_reviewer', 'legal_reviewer', 'expert_reviewer', 'launch_owner')),
  assigned_by text not null default 'admin',
  notes text,
  due_at timestamptz,
  assigned_at timestamptz not null default now()
);

create index if not exists policy_review_assignments_policy_check_idx
  on public.policy_review_assignments (policy_check_id, assigned_at desc);

create index if not exists policy_review_assignments_role_due_idx
  on public.policy_review_assignments (assigned_role, due_at asc);

alter table public.policy_review_assignments enable row level security;
