-- Phase 2 (Flow B) data model: family registration into club programs, paid via
-- Stripe Connect. Additive; all tables org-scoped + RLS. No existing behavior changes.

-- Effective platform fee (Albert's cut) for an org on a given amount. Per-club
-- override on organizations; falls back to platform_settings defaults; a club with
-- platform_fee_enabled=false pays no fee. Used by the registration-checkout fn.
create or replace function public.org_platform_fee_cents(p_org_id uuid, p_amount_cents integer)
returns integer language sql stable security definer set search_path to 'public','pg_temp'
as $$
  with cfg as (
    select
      coalesce(o.platform_fee_enabled, true)                                   as enabled,
      coalesce(o.platform_fee_percent, ps.default_platform_fee_percent, 0)     as pct,
      coalesce(o.platform_fee_flat_cents, ps.default_platform_fee_flat_cents, 0) as flat
    from public.organizations o
    left join public.platform_settings ps on ps.id = true
    where o.id = p_org_id
  )
  select case when (select enabled from cfg)
              then floor(p_amount_cents * (select pct from cfg) / 100.0)::int + (select flat from cfg)
              else 0 end;
$$;
grant execute on function public.org_platform_fee_cents(uuid, integer) to authenticated, anon;

-- A club's registration offering (season / program families sign up for).
create table if not exists public.registration_programs (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  team_id        uuid references public.teams(id) on delete set null,   -- null = club-wide
  name           text not null,
  season         text,
  age_group      text,
  description    text,
  price_cents    integer not null check (price_cents >= 0),
  billing_type   text not null check (billing_type in ('one_time','monthly','annual')),
  stripe_price_id text,        -- price on the club's connected account (recurring)
  currency       text not null default 'usd',
  capacity       integer,      -- null = unlimited
  opens_at       timestamptz,
  closes_at      timestamptz,
  waitlist_enabled boolean not null default false,
  required_fields jsonb not null default '{}'::jsonb,
  waiver_text    text,
  active         boolean not null default true,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists reg_programs_org_idx on public.registration_programs(org_id) where active;
alter table public.registration_programs enable row level security;
create policy "programs staff read" on public.registration_programs
  for select to authenticated
  using (public.is_platform_owner() or public.has_org_role(auth.uid(), org_id, 'club_director'));
create policy "programs staff manage" on public.registration_programs
  for all to authenticated
  using (public.is_platform_owner() or public.has_org_role(auth.uid(), org_id, 'club_director'))
  with check (public.is_platform_owner() or public.has_org_role(auth.uid(), org_id, 'club_director'));

-- A family's registration of a player into a program.
create table if not exists public.registrations (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  program_id     uuid not null references public.registration_programs(id) on delete cascade,
  player_id      uuid references public.players(id) on delete set null,  -- set once roster player created
  family_user_id uuid,                                                   -- parent (if logged in)
  player_first_name text not null,
  player_last_name  text not null,
  player_dob     date,
  player_gender  text,
  jersey_size    text,
  grade          text,
  school         text,
  guardian_name  text not null,
  guardian_email text not null,
  guardian_phone text,
  emergency_name  text,
  emergency_phone text,
  medical_notes  text,
  status         text not null default 'pending'
                 check (status in ('pending','paid','active','waitlisted','approved','canceled','refunded')),
  stripe_checkout_session_id text,
  stripe_subscription_id     text,
  stripe_payment_intent_id   text,
  amount_cents       integer,
  platform_fee_cents integer,
  waiver_signed_at timestamptz,
  waiver_signature text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists registrations_org_idx on public.registrations(org_id);
create index if not exists registrations_program_idx on public.registrations(program_id);
alter table public.registrations enable row level security;
-- Staff of the club (or platform owner) see/manage; a family sees its own rows.
-- Public submissions are created by the registration-checkout edge fn (service role).
create policy "registrations staff or owner read" on public.registrations
  for select to authenticated
  using (public.is_platform_owner()
         or public.has_org_role(auth.uid(), org_id, 'club_director')
         or family_user_id = auth.uid());
create policy "registrations staff manage" on public.registrations
  for all to authenticated
  using (public.is_platform_owner() or public.has_org_role(auth.uid(), org_id, 'club_director'))
  with check (public.is_platform_owner() or public.has_org_role(auth.uid(), org_id, 'club_director'));

-- Public (anon-safe) list of a club's open programs for the registration page.
create or replace function public.get_org_programs(p_slug text)
returns table (
  id uuid, name text, season text, age_group text, description text,
  price_cents integer, billing_type text, currency text, waiver_text text,
  capacity integer, spots_left integer
)
language sql security definer set search_path to 'public','pg_temp' stable
as $$
  select p.id, p.name, p.season, p.age_group, p.description,
         p.price_cents, p.billing_type, p.currency, p.waiver_text,
         p.capacity,
         case when p.capacity is null then null
              else greatest(p.capacity - (select count(*) from public.registrations r
                                          where r.program_id = p.id and r.status in ('paid','active','approved')), 0) end
  from public.registration_programs p
  join public.organizations o on o.id = p.org_id
  where o.slug = p_slug and o.deleted_at is null and p.active
    and (p.opens_at  is null or p.opens_at  <= now())
    and (p.closes_at is null or p.closes_at >= now())
  order by p.created_at;
$$;
grant execute on function public.get_org_programs(text) to anon, authenticated;
