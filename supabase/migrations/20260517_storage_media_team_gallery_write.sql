-- Gallery write/delete RLS for media/team-{team_uuid}/* paths.
-- Applied to prod (bcfemytoburctssnemwn) 2026-05-17 via MCP apply_migration.
--
-- Pre-state: only media/players/* had Storage RLS (avatar uploader).
-- Gallery's path convention is team-{uuid}/{filename} and had no write
-- policy at all, so every gallery upload silently failed RLS and the
-- generic UI toast said "Check connection" — masking the real issue.
--
-- Permission model: any team member (any role on team_memberships)
-- can upload + delete in their team's gallery folder. The UI gates
-- visibility of upload + delete buttons to manager/coach/parent so
-- this is well-aligned with what's exposed. Read is via the bucket's
-- public flag — no SELECT policy needed.

CREATE POLICY "media_team_gallery_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] LIKE 'team-%'
    AND EXISTS (
        SELECT 1
        FROM public.team_memberships tm
        WHERE tm.user_id = auth.uid()
          AND tm.team_id::text = SUBSTRING((storage.foldername(objects.name))[1] FROM 6)
    )
);

CREATE POLICY "media_team_gallery_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] LIKE 'team-%'
    AND EXISTS (
        SELECT 1
        FROM public.team_memberships tm
        WHERE tm.user_id = auth.uid()
          AND tm.team_id::text = SUBSTRING((storage.foldername(objects.name))[1] FROM 6)
    )
);

CREATE POLICY "media_team_gallery_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] LIKE 'team-%'
    AND EXISTS (
        SELECT 1
        FROM public.team_memberships tm
        WHERE tm.user_id = auth.uid()
          AND tm.team_id::text = SUBSTRING((storage.foldername(objects.name))[1] FROM 6)
    )
)
WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] LIKE 'team-%'
    AND EXISTS (
        SELECT 1
        FROM public.team_memberships tm
        WHERE tm.user_id = auth.uid()
          AND tm.team_id::text = SUBSTRING((storage.foldername(objects.name))[1] FROM 6)
    )
);
