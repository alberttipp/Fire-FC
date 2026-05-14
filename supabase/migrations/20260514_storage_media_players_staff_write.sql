-- Storage RLS: allow team staff (coach / manager / etc.) to write player
-- avatars under media/players/{player_id}/*. Read stays public via the
-- bucket's public=true setting; this migration only governs writes.
--
-- Path convention: media/players/{player.id}/avatar-{timestamp}.{ext}
-- The second segment of the path = the target player_id; we look that
-- player up in public.players and check the uploader has the team_staff
-- role on that player's team via the existing has_team_role helper.
--
-- Applied to prod (bcfemytoburctssnemwn) 2026-05-14 via MCP apply_migration.

CREATE POLICY "media_players_staff_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] = 'players'
  AND EXISTS (
    SELECT 1
    FROM public.players p
    WHERE p.id::text = (storage.foldername(name))[2]
      AND public.has_team_role(auth.uid(), p.team_id, 'team_staff')
  )
);

CREATE POLICY "media_players_staff_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] = 'players'
  AND EXISTS (
    SELECT 1
    FROM public.players p
    WHERE p.id::text = (storage.foldername(name))[2]
      AND public.has_team_role(auth.uid(), p.team_id, 'team_staff')
  )
)
WITH CHECK (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] = 'players'
  AND EXISTS (
    SELECT 1
    FROM public.players p
    WHERE p.id::text = (storage.foldername(name))[2]
      AND public.has_team_role(auth.uid(), p.team_id, 'team_staff')
  )
);

CREATE POLICY "media_players_staff_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] = 'players'
  AND EXISTS (
    SELECT 1
    FROM public.players p
    WHERE p.id::text = (storage.foldername(name))[2]
      AND public.has_team_role(auth.uid(), p.team_id, 'team_staff')
  )
);
