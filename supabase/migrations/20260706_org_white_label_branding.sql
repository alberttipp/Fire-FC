-- White-label foundation: per-org branding. Purely ADDITIVE — new nullable
-- columns + a new public branding-lookup RPC. Does NOT touch org_id defaults,
-- RLS, or any existing behavior. Rockford is seeded to match today's hardcoded look.

alter table public.organizations
  add column if not exists display_name  text,
  add column if not exists short_name    text,
  add column if not exists logo_url      text,
  add column if not exists primary_color text,
  add column if not exists accent_color  text,
  add column if not exists ai_persona    text,
  add column if not exists tagline        text,
  add column if not exists theme         jsonb not null default '{}'::jsonb,
  add column if not exists features      jsonb not null default '{}'::jsonb;

update public.organizations
set display_name  = coalesce(display_name,  'Rockford Fire FC'),
    short_name    = coalesce(short_name,    'Fire'),
    logo_url      = coalesce(logo_url,      '/branding/logo.png'),
    primary_color = coalesce(primary_color, '#3b82f6'),
    accent_color  = coalesce(accent_color,  '#d4af37')
where slug = 'rockford-fire-fc';

create or replace function public.get_org_branding(p_slug text)
returns table (
  display_name text, short_name text, logo_url text,
  primary_color text, accent_color text, ai_persona text, tagline text
)
language sql
security definer
set search_path to 'public', 'pg_temp'
stable
as $$
  select o.display_name, o.short_name, o.logo_url,
         o.primary_color, o.accent_color, o.ai_persona, o.tagline
  from public.organizations o
  where o.slug = p_slug and o.deleted_at is null
  limit 1;
$$;
grant execute on function public.get_org_branding(text) to anon, authenticated;
