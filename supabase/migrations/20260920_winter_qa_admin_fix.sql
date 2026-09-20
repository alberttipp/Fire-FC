-- Fix: list_winter_questions_admin as plpgsql hit an OUT-param/column ambiguity
-- on "id". Rewrite as a plain SQL function gated by _rc_is_org_staff in the
-- WHERE (returns rows only to org staff), and add am_i_winter_staff() so the
-- portal can decide when to show the answer controls.

create or replace function public.am_i_winter_staff(p_org_slug text)
returns boolean language sql stable security definer set search_path = public as $$
    select public._rc_is_org_staff(o.id)
    from public.organizations o where o.slug = p_org_slug;
$$;

drop function if exists public.list_winter_questions_admin(text);
create function public.list_winter_questions_admin(p_org_slug text)
returns table(id uuid, team_id uuid, question text, asker_name text, asker_contact text,
              answer text, answered_by_name text, status text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
    select q.id, q.team_id, q.question, q.asker_name, q.asker_contact, q.answer, q.answered_by_name, q.status, q.created_at
    from public.winter_questions q
    join public.organizations o on o.id = q.org_id
    where o.slug = p_org_slug and q.status <> 'hidden' and public._rc_is_org_staff(q.org_id)
    order by (q.status = 'pending') desc, q.created_at desc;
$$;

grant execute on function public.am_i_winter_staff(text) to anon, authenticated;
grant execute on function public.list_winter_questions_admin(text) to authenticated;
