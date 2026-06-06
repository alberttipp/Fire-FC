-- Applied to prod (bcfemytoburctssnemwn) via MCP on 2026-06-06. Mirrored here.
-- Staff-only team adoption snapshot for the Coach HQ "Team Adoption" panel.
-- Returns jsonb { summary, players[], notifications_off[] }.
CREATE OR REPLACE FUNCTION public.get_team_adoption(p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE v_out jsonb;
BEGIN
    IF NOT (auth.role() = 'service_role'
            OR (auth.uid() IS NOT NULL AND public.has_team_role(auth.uid(), p_team_id, 'team_staff'))) THEN
        RAISE EXCEPTION 'not_authorized';
    END IF;

    WITH roster AS (
        SELECT p.id, p.first_name, left(coalesce(p.last_name,''),1) AS li
        FROM public.players p
        JOIN public.player_teams pt ON pt.player_id=p.id AND pt.team_id=p_team_id AND pt.status='active'
    ),
    guardians AS (
        SELECT DISTINCT fm.player_id, fm.user_id, pr.full_name,
               (SELECT count(*) FROM public.user_push_subscriptions s WHERE s.user_id=fm.user_id) > 0 AS push_on
        FROM public.family_members fm
        JOIN roster r ON r.id=fm.player_id
        LEFT JOIN public.profiles pr ON pr.id=fm.user_id
        WHERE fm.user_id IS NOT NULL
    ),
    player_rows AS (
        SELECT r.id, r.first_name, r.li,
            (b.player_id IS NOT NULL) AS baseline,
            COALESCE(ps.drills_completed,0) AS drills,
            COALESCE(ps.career_touches,0) AS touches,
            ps.last_training_date,
            (SELECT count(*) FROM guardians g WHERE g.player_id=r.id) AS guardians_total,
            (SELECT count(*) FROM guardians g WHERE g.player_id=r.id AND g.push_on) AS guardians_push
        FROM roster r
        LEFT JOIN public.juggle_baselines b ON b.player_id=r.id
        LEFT JOIN public.player_stats ps ON ps.player_id=r.id
    )
    SELECT jsonb_build_object(
        'summary', jsonb_build_object(
            'players', (SELECT count(*) FROM roster),
            'baselines_set', (SELECT count(*) FROM player_rows WHERE baseline),
            'guardians_total', (SELECT count(DISTINCT user_id) FROM guardians),
            'guardians_push_on', (SELECT count(DISTINCT user_id) FROM guardians WHERE push_on),
            'no_drills', (SELECT count(*) FROM player_rows WHERE drills = 0)
        ),
        'players', (SELECT COALESCE(jsonb_agg(to_jsonb(pr) ORDER BY pr.touches DESC), '[]'::jsonb) FROM player_rows pr),
        'notifications_off', (
            SELECT COALESCE(jsonb_agg(x ORDER BY x->>'name'), '[]'::jsonb) FROM (
                SELECT jsonb_build_object('name', COALESCE(g.full_name,'(no name)'),
                                          'kids', string_agg(DISTINCT r.first_name, ', ')) AS x
                FROM guardians g JOIN roster r ON r.id=g.player_id
                WHERE NOT g.push_on
                GROUP BY g.user_id, g.full_name
            ) s
        )
    ) INTO v_out;
    RETURN v_out;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_team_adoption(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_team_adoption(uuid) TO authenticated;
