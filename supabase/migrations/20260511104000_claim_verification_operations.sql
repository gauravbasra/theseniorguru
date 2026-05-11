create index if not exists provider_verification_attempts_pending_method_idx
  on public.provider_verification_attempts (provider_claim_id, method, status, expires_at, created_at desc);

create index if not exists provider_verification_attempts_expiry_idx
  on public.provider_verification_attempts (expires_at)
  where status = 'pending' and expires_at is not null;
