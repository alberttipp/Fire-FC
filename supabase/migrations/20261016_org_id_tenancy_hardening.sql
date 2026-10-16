-- ============================================================
-- ORG TENANCY HARDENING (2026-10-16)
--
-- The 20260429 hotfix gave every tenant table a DEFAULT org_id of
-- Rock City's org so legacy inserts kept working. With real
-- white-label tenants (Raptors, Raptors Futsal) that default is a
-- silent-misfiling foot-gun: any insert that omits org_id lands in
-- Rock City. (Audit 2026-10-16: zero misplaced rows so far.)
--
-- 1. sync_org_id_from_team(): BEFORE INSERT trigger on every table
--    that carries BOTH org_id and team_id — org_id is always derived
--    from the team, so team-scoped rows can never be misfiled no
--    matter what the client sends or omits.
-- 2. teams.org_id loses its DEFAULT: team creation must say which
--    club it belongs to (CreateTeamModal / OnboardingWizard always
--    do) — a missing org now errors loudly instead of silently
--    becoming a Rock City team.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_org_id_from_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_org uuid;
BEGIN
  IF NEW.team_id IS NOT NULL THEN
    SELECT t.org_id INTO v_org FROM public.teams t WHERE t.id = NEW.team_id;
    IF v_org IS NOT NULL THEN
      NEW.org_id := v_org;
    END IF;
  END IF;
  RETURN NEW;
END $$;

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
    EXECUTE format('CREATE TRIGGER trg_sync_org_from_team BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.sync_org_id_from_team()', r.table_name);
  END LOOP;
END $$;

ALTER TABLE public.teams ALTER COLUMN org_id DROP DEFAULT;
