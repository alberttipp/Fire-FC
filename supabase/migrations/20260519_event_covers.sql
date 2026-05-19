-- Event cover images (Phase A): client-rendered template overlays on
-- gradient backgrounds, saved to storage, displayed as hero + chat
-- preview. No AI yet — Phase C will add Gemini Imagen.
--
-- Columns:
--   events.cover_image_url   text  — public URL into media bucket
--   events.cover_template    jsonb — { template: 'match_day' | 'practice' | 'social',
--                                       bg: 'navy_lights' | 'sunset' | 'fire_red',
--                                       version: 1 }
--     (kept as jsonb so future template variants can add fields without
--      another migration)
--
-- Storage path convention: event-covers/<team_id>/<event_id>-<timestamp>.png
-- Reuses the existing public 'media' bucket.

ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS cover_image_url text,
    ADD COLUMN IF NOT EXISTS cover_template  jsonb;

-- Storage RLS: team staff can write event covers, anyone authenticated
-- can read (the cover ends up in chat and the bucket is public anyway).
-- The 'media' bucket already has gallery policies — adding event-covers
-- alongside without disturbing them.

DROP POLICY IF EXISTS "Staff can write event covers" ON storage.objects;
CREATE POLICY "Staff can write event covers"
ON storage.objects
FOR ALL
TO authenticated
USING (
    bucket_id = 'media'
    AND name LIKE 'event-covers/%'
    AND EXISTS (
        SELECT 1 FROM public.team_memberships tm
        WHERE tm.user_id = auth.uid()
          AND tm.role IN ('coach','manager','head_coach','assistant_coach','team_manager','director','admin')
          AND tm.team_id::text = split_part(storage.objects.name, '/', 2)
    )
)
WITH CHECK (
    bucket_id = 'media'
    AND name LIKE 'event-covers/%'
    AND EXISTS (
        SELECT 1 FROM public.team_memberships tm
        WHERE tm.user_id = auth.uid()
          AND tm.role IN ('coach','manager','head_coach','assistant_coach','team_manager','director','admin')
          AND tm.team_id::text = split_part(storage.objects.name, '/', 2)
    )
);
