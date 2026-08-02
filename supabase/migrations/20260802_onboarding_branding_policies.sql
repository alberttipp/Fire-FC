-- Onboarding wizard — branding enablers.
-- Verified against live prod 2026-08-02: organizations had ONLY a SELECT policy,
-- and storage.objects had no policy for media/branding/ or media/sponsors/ paths
-- (existing coverage: event-covers/, players/, team-*/). So the wizard's Step 1
-- branding save + logo upload — and the staff SponsorsDrilldown logo upload —
-- were blocked by RLS.
--
-- We deliberately DO NOT add a blanket organizations UPDATE policy: RLS is
-- row-level, so it would let a club_director rewrite ANY column (slug,
-- sponsor_fee_percent, autopilot_enabled, owner_user_id). Instead a
-- column-restricted SECURITY DEFINER RPC writes only the 4 branding fields.

-- 1) Column-restricted branding update (club_director of the org, or owner).
create or replace function public.update_org_branding(
    p_org_id uuid,
    p_name text,
    p_display_name text,
    p_logo_url text,
    p_primary_color text
) returns void
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
begin
    if not (public.has_org_role(auth.uid(), p_org_id, 'club_director') or public.is_platform_owner()) then
        raise exception 'not authorized to update this club';
    end if;
    update public.organizations set
        name = coalesce(nullif(p_name,''), name),
        display_name = coalesce(nullif(p_display_name,''), display_name),
        logo_url = p_logo_url,
        primary_color = p_primary_color
    where id = p_org_id;
end; $$;
grant execute on function public.update_org_branding(uuid, text, text, text, text) to authenticated;

-- 2) Club directors may write branding + sponsor logos to media/{branding|sponsors}/{org_id}/...
--    Narrowly scoped: path's org-id segment must be a club the caller directs.
--    (media is a public-read bucket; uploads use getPublicUrl.)
drop policy if exists "directors write club media assets" on storage.objects;
create policy "directors write club media assets" on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'media'
        and (storage.foldername(name))[1] in ('branding', 'sponsors')
        and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
        and public.has_org_role(auth.uid(), ((storage.foldername(name))[2])::uuid, 'club_director')
    );

drop policy if exists "directors update club media assets" on storage.objects;
create policy "directors update club media assets" on storage.objects
    for update to authenticated
    using (
        bucket_id = 'media'
        and (storage.foldername(name))[1] in ('branding', 'sponsors')
        and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
        and public.has_org_role(auth.uid(), ((storage.foldername(name))[2])::uuid, 'club_director')
    )
    with check (
        bucket_id = 'media'
        and (storage.foldername(name))[1] in ('branding', 'sponsors')
        and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
        and public.has_org_role(auth.uid(), ((storage.foldername(name))[2])::uuid, 'club_director')
    );
