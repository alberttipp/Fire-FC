-- ============================================================
-- 20260510_tryout_waitlist_rls_ROLLBACK.sql
-- Restores the looser pre-2026-05-10 policies on tryout_waitlist.
-- WARNING: re-enables an anon-readable policy that leaks every
-- prospect's PII. Use only if the new policy set breaks something.
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS "Anyone can submit a tryout application" ON public.tryout_waitlist;
DROP POLICY IF EXISTS "Org staff can view tryout waitlist" ON public.tryout_waitlist;
DROP POLICY IF EXISTS "Org staff can update tryout waitlist" ON public.tryout_waitlist;
DROP POLICY IF EXISTS "Org staff can delete tryout waitlist" ON public.tryout_waitlist;

CREATE POLICY "Anyone can view tryout_waitlist"
ON public.tryout_waitlist FOR SELECT TO public
USING (true);

CREATE POLICY "Managers can view waitlist"
ON public.tryout_waitlist FOR SELECT TO public
USING (true);

CREATE POLICY "Authenticated can manage tryout_waitlist"
ON public.tryout_waitlist FOR ALL TO public
USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
COMMIT;
