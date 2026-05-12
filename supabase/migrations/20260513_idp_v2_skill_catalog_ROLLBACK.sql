-- ============================================================
-- 20260513_idp_v2_skill_catalog_ROLLBACK.sql
-- Undoes the IDP v2 migration. Drops the new tables, trigger, and
-- seeded rows. Does NOT remove the columns added to existing tables
-- (current_block / block_duration_days / tagged_skills) since they
-- are nullable and harmless to leave in place — easier to roll forward
-- again if needed.
-- ============================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_award_badge_on_skill_mastery ON public.idp_skill_progress;
DROP FUNCTION IF EXISTS public.award_badge_on_skill_mastery();

DROP TABLE IF EXISTS public.idp_skill_progress CASCADE;
DROP TABLE IF EXISTS public.skills CASCADE;

-- Remove the seeded skill-move badges
DELETE FROM public.badges WHERE category = 'Skill Move';

-- Clean the backfilled tagged_skills (keep the column, just null it)
UPDATE public.drills SET tagged_skills = NULL WHERE tagged_skills IS NOT NULL;

NOTIFY pgrst, 'reload schema';
COMMIT;
