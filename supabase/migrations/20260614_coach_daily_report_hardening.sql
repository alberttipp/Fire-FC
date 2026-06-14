-- Applied to prod via MCP 2026-06-14. Lock down the Team Pulse functions:
-- Postgres grants EXECUTE to PUBLIC by default, which would let anon/
-- authenticated trigger report builds, fire staff pushes, or read any team's
-- aggregate engagement. These run only via pg_cron / the SECURITY DEFINER
-- get_team_pulse wrapper.
REVOKE EXECUTE ON FUNCTION public.coach_engagement_window(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.build_daily_coach_report(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.build_daily_coach_report_all() FROM PUBLIC, anon, authenticated;
-- get_team_pulse keeps `authenticated` (self-checks staff membership via auth.uid()).
REVOKE EXECUTE ON FUNCTION public.get_team_pulse(uuid) FROM PUBLIC, anon;
ALTER FUNCTION public.fmt_delta(int, int) SET search_path = pg_catalog;

-- pg_cron (scheduled separately, mirrors the Sunday roundup):
--   coach-daily-report-0100utc : '0 1 * * *' -> SELECT public.build_daily_coach_report_all()
--   coach-daily-report-0200utc : '0 2 * * *' -> SELECT public.build_daily_coach_report_all()
-- build_daily_coach_report_all() guards on America/Chicago hour = 20, so it
-- fires once at 8 PM Central (01:00 UTC CDT / 02:00 UTC CST).
