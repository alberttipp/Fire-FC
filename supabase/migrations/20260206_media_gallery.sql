-- ============================================
-- MEDIA GALLERY
-- Photo uploads for teams, organized by event
-- ============================================

-- 1. Create media_gallery table
CREATE TABLE IF NOT EXISTS media_gallery (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    caption TEXT,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_media_gallery_team ON media_gallery(team_id);
CREATE INDEX idx_media_gallery_event ON media_gallery(event_id);
CREATE INDEX idx_media_gallery_created ON media_gallery(created_at DESC);
CREATE INDEX idx_media_gallery_uploader ON media_gallery(uploaded_by);

-- 2. Enable RLS
ALTER TABLE media_gallery ENABLE ROW LEVEL SECURITY;

-- 3. VIEW: Team members can view media (via team_memberships)
DROP POLICY IF EXISTS "Team members can view media" ON media_gallery;
CREATE POLICY "Team members can view media"
ON media_gallery FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM team_memberships
        WHERE team_id = media_gallery.team_id
        AND user_id = auth.uid()
    )
);

-- 4. VIEW: Parents via family_members can view media
DROP POLICY IF EXISTS "Parents via family can view media" ON media_gallery;
CREATE POLICY "Parents via family can view media"
ON media_gallery FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM family_members fm
        JOIN players p ON p.id = fm.player_id
        WHERE fm.user_id = auth.uid()
        AND p.team_id = media_gallery.team_id
    )
);

-- 5. INSERT: Coaches/managers/parents can upload
DROP POLICY IF EXISTS "Staff and parents can upload media" ON media_gallery;
CREATE POLICY "Staff and parents can upload media"
ON media_gallery FOR INSERT
WITH CHECK (
    uploaded_by = auth.uid()
    AND (
        -- Via team_memberships (coach, manager, parent)
        EXISTS (
            SELECT 1 FROM team_memberships
            WHERE team_id = media_gallery.team_id
            AND user_id = auth.uid()
            AND role IN ('manager', 'coach', 'parent')
        )
        OR
        -- Via family_members (guardian)
        EXISTS (
            SELECT 1 FROM family_members fm
            JOIN players p ON p.id = fm.player_id
            WHERE fm.user_id = auth.uid()
            AND p.team_id = media_gallery.team_id
        )
    )
);

-- 6. DELETE: Uploader can delete own photos
DROP POLICY IF EXISTS "Users can delete own media" ON media_gallery;
CREATE POLICY "Users can delete own media"
ON media_gallery FOR DELETE
USING (uploaded_by = auth.uid());

-- 7. DELETE: Coaches/managers can delete any team photo
DROP POLICY IF EXISTS "Coaches can delete team media" ON media_gallery;
CREATE POLICY "Coaches can delete team media"
ON media_gallery FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM team_memberships
        WHERE team_id = media_gallery.team_id
        AND user_id = auth.uid()
        AND role IN ('manager', 'coach')
    )
);

-- 8. Grant permissions
GRANT ALL ON media_gallery TO authenticated;
GRANT SELECT ON media_gallery TO anon;

-- 9. Storage bucket (run manually in Supabase Dashboard if this fails)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true)
-- ON CONFLICT (id) DO NOTHING;

-- 10. Refresh schema cache
NOTIFY pgrst, 'reload schema';
