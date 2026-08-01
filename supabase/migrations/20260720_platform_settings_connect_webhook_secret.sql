-- Flow B: store the Stripe Connect webhook signing secret (created by
-- admin-stripe-setup) so the stripe-webhook-connect function can verify events
-- from connected accounts. Additive.
alter table public.platform_settings
  add column if not exists webhook_secret_connect text;
