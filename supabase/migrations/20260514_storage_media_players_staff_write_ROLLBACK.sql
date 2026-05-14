-- Rollback for 20260514_storage_media_players_staff_write.sql
-- After this rollback, writes to media bucket fall back to whatever
-- default RLS state applies (currently none → blocked by RLS).

DROP POLICY IF EXISTS "media_players_staff_insert" ON storage.objects;
DROP POLICY IF EXISTS "media_players_staff_update" ON storage.objects;
DROP POLICY IF EXISTS "media_players_staff_delete" ON storage.objects;
