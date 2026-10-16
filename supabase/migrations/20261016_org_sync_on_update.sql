-- ============================================================
-- ORG SYNC ON UPDATE (2026-10-16) — ChatGPT review follow-up.
--
-- The 20261016 tenancy-hardening trigger derived org_id from
-- team_id on INSERT only; a later UPDATE that changes team_id
-- (player moved between teams, etc.) could leave org_id stale /
-- cross-org. Re-create every trigger as INSERT OR UPDATE OF
-- team_id so org_id always follows the team.
-- ============================================================

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c1.table_name
    FROM information_schema.columns c1
    JOIN information_schema.columns c2
      ON c2.table_schema = c1.table_schema AND c2.table_name = c1.table_name AND c2.column_name = 'team_id'
    JOIN information_schema.tables t
      ON t.table_schema = c1.table_schema AND t.table_name = c1.table_name AND t.table_type = 'BASE TABLE'
    WHERE c1.table_schema = 'public' AND c1.column_name = 'org_id' AND c1.table_name <> 'teams'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_sync_org_from_team ON public.%I', r.table_name);
    EXECUTE format('CREATE TRIGGER trg_sync_org_from_team BEFORE INSERT OR UPDATE OF team_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.sync_org_id_from_team()', r.table_name);
  END LOOP;
END $$;
