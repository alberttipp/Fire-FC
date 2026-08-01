-- Flow A: store the auto-created Stripe product id + platform webhook signing
-- secret on the platform_settings singleton (populated by the admin-stripe-setup
-- edge function). Additive, idempotent.
alter table public.platform_settings
  add column if not exists stripe_product_id       text,
  add column if not exists webhook_secret_platform text;
