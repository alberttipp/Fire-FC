-- Winter portal Q&A: parents ask questions on the public sign-up page; club
-- staff (Albert + coaches) answer inline; answered Q&As show publicly as a
-- growing FAQ. New questions notify winter-team staff via enqueue_notification.

create table if not exists public.winter_questions (
    id                uuid primary key default gen_random_uuid(),
    org_id            uuid not null references public.organizations(id),
    team_id           uuid references public.teams(id),
    question          text not null,
    asker_name        text,                 -- optional; shown publicly if given
    asker_contact     text,                 -- optional; PRIVATE (staff-only)
    answer            text,
    answered_by_name  text,
    answered_by_user  uuid references auth.users(id),
    answered_at       timestamptz,
    status            text not null default 'pending',  -- pending | answered | hidden
    created_at        timestamptz not null default now()
);
alter table public.winter_questions enable row level security;  -- access via RPCs only
create index if not exists winter_questions_org_idx on public.winter_questions(org_id, status);

-- staff check: is auth.uid() a manager/coach on any team in the org
create or replace function public._rc_is_org_staff(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
    select exists(
        select 1 from public.team_memberships tm
        join public.teams t on t.id = tm.team_id
        where t.org_id = p_org and tm.user_id = auth.uid()
          and tm.role in ('manager','coach','head_coach','assistant_coach','team_manager','club_director')
    );
$$;

-- PUBLIC: ask a question (anon). Notifies winter-team staff.
create or replace function public.submit_winter_question(
    p_org_slug text, p_question text, p_asker_name text, p_asker_contact text, p_team_id uuid default null)
returns json language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_qid uuid; v_staff uuid;
begin
    select id into v_org from public.organizations where slug = p_org_slug and deleted_at is null;
    if v_org is null then return json_build_object('success', false, 'message', 'Unknown club.'); end if;
    if coalesce(trim(p_question), '') = '' then return json_build_object('success', false, 'message', 'Please enter a question.'); end if;
    if length(p_question) > 1000 then return json_build_object('success', false, 'message', 'Question is too long.'); end if;

    insert into public.winter_questions(org_id, team_id, question, asker_name, asker_contact)
    values (v_org, p_team_id, trim(p_question), nullif(trim(p_asker_name), ''), nullif(trim(p_asker_contact), ''))
    returning id into v_qid;

    for v_staff in
        select distinct tm.user_id
        from public.team_memberships tm join public.teams t on t.id = tm.team_id
        where t.org_id = v_org and t.season = 'Winter 2026-27'
          and tm.role in ('manager','coach','head_coach','assistant_coach','team_manager')
    loop
        perform public.enqueue_notification(
            v_staff, 'winter_question', 'New winter question',
            left(trim(p_question), 140), '/winter-signup?club=' || p_org_slug, 'winter_qa_' || v_qid::text, v_org);
    end loop;

    return json_build_object('success', true, 'id', v_qid);
end;
$$;

-- PUBLIC: answered Q&A only (the growing FAQ). No contact info.
create or replace function public.list_winter_qa(p_org_slug text)
returns table(id uuid, question text, asker_name text, answer text, answered_by_name text, answered_at timestamptz)
language sql stable security definer set search_path = public as $$
    select q.id, q.question, q.asker_name, q.answer, q.answered_by_name, q.answered_at
    from public.winter_questions q join public.organizations o on o.id = q.org_id
    where o.slug = p_org_slug and q.status = 'answered'
    order by q.answered_at desc;
$$;

-- STAFF: all questions (pending first) incl. asker contact. Errors if not staff.
create or replace function public.list_winter_questions_admin(p_org_slug text)
returns table(id uuid, team_id uuid, question text, asker_name text, asker_contact text,
              answer text, answered_by_name text, status text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_org uuid;
begin
    select id into v_org from public.organizations where slug = p_org_slug;
    if v_org is null or not public._rc_is_org_staff(v_org) then
        raise exception 'not authorized';
    end if;
    return query
        select q.id, q.team_id, q.question, q.asker_name, q.asker_contact, q.answer, q.answered_by_name, q.status, q.created_at
        from public.winter_questions q
        where q.org_id = v_org and q.status <> 'hidden'
        order by (q.status = 'pending') desc, q.created_at desc;
end;
$$;

-- STAFF: answer a question (makes it public).
create or replace function public.answer_winter_question(p_question_id uuid, p_answer text, p_answered_by_name text)
returns json language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
    select org_id into v_org from public.winter_questions where id = p_question_id;
    if v_org is null then return json_build_object('success', false, 'message', 'Question not found.'); end if;
    if not public._rc_is_org_staff(v_org) then raise exception 'not authorized'; end if;
    if coalesce(trim(p_answer), '') = '' then return json_build_object('success', false, 'message', 'Answer cannot be empty.'); end if;
    update public.winter_questions
        set answer = trim(p_answer), answered_by_name = nullif(trim(p_answered_by_name), ''),
            answered_by_user = auth.uid(), answered_at = now(), status = 'answered'
        where id = p_question_id;
    return json_build_object('success', true);
end;
$$;

-- STAFF: hide a spam/irrelevant question.
create or replace function public.hide_winter_question(p_question_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
    select org_id into v_org from public.winter_questions where id = p_question_id;
    if v_org is null then return json_build_object('success', false); end if;
    if not public._rc_is_org_staff(v_org) then raise exception 'not authorized'; end if;
    update public.winter_questions set status = 'hidden' where id = p_question_id;
    return json_build_object('success', true);
end;
$$;

grant execute on function public.submit_winter_question(text, text, text, text, uuid) to anon, authenticated;
grant execute on function public.list_winter_qa(text) to anon, authenticated;
grant execute on function public.list_winter_questions_admin(text) to authenticated;
grant execute on function public.answer_winter_question(uuid, text, text) to authenticated;
grant execute on function public.hide_winter_question(uuid) to authenticated;
grant execute on function public._rc_is_org_staff(uuid) to authenticated;
