create table public.provider_claim_document_reviews (
  id uuid primary key default gen_random_uuid(),
  provider_claim_id uuid not null references public.provider_claims(id) on delete cascade,
  provider_verification_attempt_id uuid references public.provider_verification_attempts(id) on delete set null,
  decision text not null check (decision in ('approved', 'rejected')),
  reviewer_id uuid,
  reviewer_notes text,
  evidence_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index provider_claim_document_reviews_claim_idx
  on public.provider_claim_document_reviews (provider_claim_id, created_at desc);

create index provider_claim_document_reviews_attempt_idx
  on public.provider_claim_document_reviews (provider_verification_attempt_id);

alter table public.provider_claim_document_reviews enable row level security;
