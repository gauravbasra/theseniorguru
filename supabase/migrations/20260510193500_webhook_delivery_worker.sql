create table public.webhook_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.webhook_deliveries(id) on delete cascade,
  target_url text not null,
  status text not null check (status in ('delivered', 'failed', 'blocked', 'dry_run')),
  status_code integer,
  error text,
  signature_preview text,
  created_at timestamptz not null default now()
);

create index webhook_delivery_attempts_delivery_created_idx
  on public.webhook_delivery_attempts (delivery_id, created_at desc);

alter table public.webhook_delivery_attempts enable row level security;

create or replace function public.increment_webhook_delivery_attempts(delivery_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.webhook_deliveries
  set attempts = attempts + 1
  where id = delivery_id_input;
end;
$$;
