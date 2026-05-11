alter table public.webhook_subscriptions
  add column if not exists signing_secret_ciphertext text;
