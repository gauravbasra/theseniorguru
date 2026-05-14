create table if not exists public.newsletter_delivery_attempts (
  id text primary key,
  newsletter_edition_id text not null,
  delivery_provider text not null check (delivery_provider in ('mailjet', 'manual_export')),
  delivery_mode text not null default 'preview' check (delivery_mode in ('preview', 'live')),
  status text not null check (status in ('ready', 'sent', 'blocked', 'dry_run')),
  recipient_segments jsonb not null default '[]'::jsonb,
  payload_preview jsonb not null default '{}'::jsonb,
  provider_message_id text,
  error text,
  policy_decision text not null,
  actor_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists newsletter_delivery_attempts_edition_idx
  on public.newsletter_delivery_attempts(newsletter_edition_id, created_at desc);

alter table public.newsletter_delivery_attempts enable row level security;
