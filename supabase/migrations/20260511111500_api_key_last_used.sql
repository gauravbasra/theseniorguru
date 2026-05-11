alter table public.api_keys
  add column if not exists last_used_at timestamptz;

create index if not exists api_keys_last_used_idx
  on public.api_keys (last_used_at desc)
  where last_used_at is not null;
