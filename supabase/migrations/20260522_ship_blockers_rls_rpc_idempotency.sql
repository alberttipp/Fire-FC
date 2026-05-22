-- ============================================================
-- 2026-05-22 ship-blocker bundle (applied to prod via MCP).
--
-- This bundle closes the security and correctness gaps that an
-- audit surfaced before opening the app to Fire FC families:
--
--   * notifications: drop WITH CHECK (TRUE) insert policy. Any
--     authenticated user could previously insert into another
--     user's bell badge. SECURITY DEFINER triggers (owned by
--     postgres, which has BYPASSRLS) keep working.
--   * notifications: outbox_id column + UNIQUE(outbox_id, user_id).
--     The dispatcher now passes outbox_id on the in-app insert,
--     so a push retry can't double-insert the same notification.
--   * player_stats: drop wide-open ALL/INSERT policies and the
--     duplicate SELECT policy. The "Coaches can update team
--     player stats" scoped policy stays. SELECT remains public
--     (the leaderboard is intentionally readable).
--   * assignments: drop the three wide-open policies (auth.uid()
--     IS NOT NULL gates + WITH CHECK true insert) and replace
--     with player / family / team-staff scopes. complete_assignment
--     is SECURITY DEFINER so player+parent completions still work.
--   * Stat-mutation RPCs: revoke EXECUTE FROM anon. authenticated
--     keeps access; cron runs as postgres so server-side scheduling
--     is unaffected.
--   * Internal dispatch secret: stored in vault.secrets, exposed
--     to edge functions via get_internal_dispatch_secret() RPC
--     (service_role only). pg_cron's drain-notification-outbox
--     command reads it inline and passes it as
--     X-Internal-Dispatch-Secret. Both edge functions verify it
--     before doing any work.
-- ============================================================

-- 1. notifications: drop wide-open insert
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- 2. notifications: idempotency column
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS outbox_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_outbox_user
    ON public.notifications(outbox_id, user_id)
    WHERE outbox_id IS NOT NULL;

-- 3. player_stats: drop wide-open ALL/INSERT, drop duplicate SELECT
DROP POLICY IF EXISTS "System can update player_stats" ON public.player_stats;
DROP POLICY IF EXISTS "System can insert player stats" ON public.player_stats;
DROP POLICY IF EXISTS "Anyone can view player_stats"   ON public.player_stats;
-- ("Coaches can update team player stats" stays.
--  "Anyone can view player stats" stays — leaderboard is public.)

-- 4. assignments: drop wide-open, add scoped policies
DROP POLICY IF EXISTS "Authenticated can view assignments" ON public.assignments;
DROP POLICY IF EXISTS "Allow updates to assignments"        ON public.assignments;
DROP POLICY IF EXISTS "Team staff can create assignments"   ON public.assignments;

CREATE POLICY "Assignment scoped read" ON public.assignments
    FOR SELECT TO authenticated
    USING (
      EXISTS (SELECT 1 FROM public.players p
              WHERE p.id = assignments.player_id AND p.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.family_members fm
                 WHERE fm.player_id = assignments.player_id
                   AND fm.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.players p
                 JOIN public.team_memberships tm ON tm.team_id = p.team_id
                 WHERE p.id = assignments.player_id
                   AND tm.user_id = auth.uid()
                   AND tm.role IN ('coach','asst_coach','manager'))
    );

CREATE POLICY "Assignment staff insert" ON public.assignments
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (SELECT 1 FROM public.players p
              JOIN public.team_memberships tm ON tm.team_id = p.team_id
              WHERE p.id = assignments.player_id
                AND tm.user_id = auth.uid()
                AND tm.role IN ('coach','asst_coach','manager'))
    );

CREATE POLICY "Assignment staff update" ON public.assignments
    FOR UPDATE TO authenticated
    USING (
      EXISTS (SELECT 1 FROM public.players p
              JOIN public.team_memberships tm ON tm.team_id = p.team_id
              WHERE p.id = assignments.player_id
                AND tm.user_id = auth.uid()
                AND tm.role IN ('coach','asst_coach','manager'))
    );

CREATE POLICY "Assignment staff delete" ON public.assignments
    FOR DELETE TO authenticated
    USING (
      EXISTS (SELECT 1 FROM public.players p
              JOIN public.team_memberships tm ON tm.team_id = p.team_id
              WHERE p.id = assignments.player_id
                AND tm.user_id = auth.uid()
                AND tm.role IN ('coach','asst_coach','manager'))
    );

-- 5. Revoke anon EXECUTE on stat-mutation RPCs.
REVOKE EXECUTE ON FUNCTION public.log_training_minutes(uuid, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_assignment(uuid, uuid)              FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_completed_practices(uuid)            FROM anon;
REVOKE EXECUTE ON FUNCTION public.clear_weekly_assignments()                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_assign_weekly_drills()                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_assignment_reminders()                FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_practice_attendance(uuid, uuid)          FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_private_session(uuid)               FROM anon;

-- 6. Internal dispatch secret (vault) + service-role accessor RPC.
DO $$
DECLARE v_existing uuid;
BEGIN
    SELECT id INTO v_existing
    FROM vault.secrets
    WHERE name = 'internal_dispatch_secret';

    IF v_existing IS NULL THEN
        PERFORM vault.create_secret(
            gen_random_uuid()::text,
            'internal_dispatch_secret',
            'Shared HMAC between pg_cron and Edge Functions (drain-notification-outbox, send-push). 2026-05-22.'
        );
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_internal_dispatch_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT decrypted_secret
      FROM vault.decrypted_secrets
     WHERE name = 'internal_dispatch_secret'
     LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_internal_dispatch_secret() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_internal_dispatch_secret() FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_internal_dispatch_secret() TO service_role;

-- 7. Cron job 4 reads the vault secret inline and passes it as the
--    X-Internal-Dispatch-Secret header on every fire.
SELECT cron.alter_job(
    job_id := 4,
    command := $cmd$
        SELECT net.http_post(
            url := 'https://bcfemytoburctssnemwn.supabase.co/functions/v1/drain-notification-outbox',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'X-Internal-Dispatch-Secret',
                    (SELECT decrypted_secret
                       FROM vault.decrypted_secrets
                      WHERE name = 'internal_dispatch_secret'
                      LIMIT 1)
            ),
            timeout_milliseconds := 1000
        );
    $cmd$
);
