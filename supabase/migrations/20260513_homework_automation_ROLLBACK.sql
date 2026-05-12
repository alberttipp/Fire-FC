-- ============================================================
-- 20260513_homework_automation_ROLLBACK.sql
-- Stop the cron jobs and drop the on-demand RPC + redefined helpers.
-- Leaves pg_cron extension in place (cheap to keep installed).
-- ============================================================

BEGIN;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN ('fire-fc-sat-reminder','fire-fc-sun-clear','fire-fc-sun-auto-assign');

DROP FUNCTION IF EXISTS public.auto_fill_team_homework(UUID);
DROP FUNCTION IF EXISTS public.auto_assign_weekly_drills();
DROP FUNCTION IF EXISTS public.create_assignment_reminders();
DROP FUNCTION IF EXISTS public.pick_solo_drills(INTEGER);
DROP FUNCTION IF EXISTS public.check_coach_has_weekly_assignments(UUID, UUID);

NOTIFY pgrst, 'reload schema';
COMMIT;
