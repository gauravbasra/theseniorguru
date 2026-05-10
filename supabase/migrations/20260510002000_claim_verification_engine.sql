create type public.provider_claim_status as enum (
  'submitted',
  'email_pending',
  'phone_pending',
  'document_pending',
  'admin_review',
  'approved',
  'rejected',
  'conflict'
);

create type public.provider_verification_method as enum (
  'business_email',
  'business_phone',
  'license_document',
  'domain_dns',
  'admin_manual'
);

create type public.provider_outreach_status as enum (
  'queued',
  'sent',
  'opened',
  'clicked',
  'claimed',
  'bounced',
  'unsubscribed',
  'blocked'
);

create table public.provider_claims (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  claimant_name text not null,
  claimant_email text not null,
  claimant_phone text,
  claimant_role text,
  business_domain text,
  status public.provider_claim_status not null default 'submitted',
  verification_method public.provider_verification_method,
  verification_payload jsonb not null default '{}'::jsonb,
  policy_check_id uuid references public.policy_checks(id) on delete set null,
  admin_notes text,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index provider_claims_provider_idx on public.provider_claims (provider_id);
create index provider_claims_email_idx on public.provider_claims (claimant_email);
create index provider_claims_status_idx on public.provider_claims (status);

create table public.provider_verification_attempts (
  id uuid primary key default gen_random_uuid(),
  provider_claim_id uuid not null references public.provider_claims(id) on delete cascade,
  method public.provider_verification_method not null,
  status text not null check (status in ('pending', 'passed', 'failed', 'expired')),
  target text,
  attempt_payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.provider_outreach_sequences (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  sequence_key text not null,
  status public.provider_outreach_status not null default 'queued',
  channel text not null check (channel in ('email', 'phone', 'sms', 'mail', 'manual')),
  recipient text,
  subject text,
  body text,
  policy_check_id uuid references public.policy_checks(id) on delete set null,
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.provider_visibility_reports (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  report_payload jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.provider_claims enable row level security;
alter table public.provider_verification_attempts enable row level security;
alter table public.provider_outreach_sequences enable row level security;
alter table public.provider_visibility_reports enable row level security;

