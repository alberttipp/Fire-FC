-- Phase 3: discount codes + capacity/waitlist support for registration. Additive.

create table if not exists public.discount_codes (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  program_id  uuid references public.registration_programs(id) on delete cascade,  -- null = all programs
  code        text not null,
  kind        text not null check (kind in ('percent','amount')),
  value       integer not null check (value >= 0),   -- percent (0-100) or cents off
  max_uses    integer,
  used_count  integer not null default 0,
  active      boolean not null default true,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);
create unique index if not exists discount_codes_org_code_idx on public.discount_codes (org_id, upper(code));
alter table public.discount_codes enable row level security;
create policy "discount staff manage" on public.discount_codes
  for all to authenticated
  using (public.is_platform_owner() or public.has_org_role(auth.uid(), org_id, 'club_director'))
  with check (public.is_platform_owner() or public.has_org_role(auth.uid(), org_id, 'club_director'));

-- Track the applied discount on each registration.
alter table public.registrations
  add column if not exists discount_code  text,
  add column if not exists discount_cents integer;

-- Public preview of a code's validity/value (anon-safe). Returns nothing if invalid.
create or replace function public.validate_discount_code(p_slug text, p_code text, p_program_id uuid)
returns table (kind text, value integer)
language sql security definer set search_path to 'public','pg_temp' stable
as $$
  select d.kind, d.value
  from public.discount_codes d
  join public.organizations o on o.id = d.org_id
  where o.slug = p_slug and o.deleted_at is null and d.active
    and upper(d.code) = upper(p_code)
    and (d.program_id is null or d.program_id = p_program_id)
    and (d.expires_at is null or d.expires_at > now())
    and (d.max_uses is null or d.used_count < d.max_uses)
  limit 1;
$$;
grant execute on function public.validate_discount_code(text, text, uuid) to anon, authenticated;
