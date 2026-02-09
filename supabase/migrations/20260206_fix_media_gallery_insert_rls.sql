-- ============================================
-- FIX: media_gallery INSERT policy
-- The original policy only checks team_memberships,
-- but coaches may be identified via teams.coach_id
-- or profiles.role instead.
-- ============================================

-- Drop the old restrictive INSERT policy
DROP POLICY IF EXISTS "Staff and parents can upload media" ON media_gallery;

-- Create a broader INSERT policy that covers all auth paths
CREATE POLICY "Staff and parents can upload media"
ON media_gallery FOR INSERT
WITH CHECK (
    uploaded_by = auth.uid()
    AND (
        -- Path 1: Via team_memberships (coach, manager, parent role)
        EXISTS (
            SELECT 1 FROM team_memberships
            WHERE team_id = media_gallery.team_id
            AND user_id = auth.uid()
            AND role IN ('manager', 'coach', 'parent')
        )
        OR
        -- Path 2: Via family_members (guardian/parent linked to player on team)
        EXISTS (
            SELECT 1 FROM family_members fm
            JOIN players p ON p.id = fm.player_id
            WHERE fm.user_id = auth.uid()
            AND p.team_id = media_gallery.team_id
        )
        OR
        -- Path 3: Coach via teams.coach_id
        EXISTS (
            SELECT 1 FROM teams
            WHERE id = media_gallery.team_id
            AND coach_id = auth.uid()
        )
        OR
        -- Path 4: Manager/coach via profiles.role
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('manager', 'coach')
        )
    )
);
