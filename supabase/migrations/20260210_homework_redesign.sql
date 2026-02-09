-- ============================================
-- HOMEWORK SYSTEM REDESIGN
-- 1. Add 'source' column to distinguish coach vs parent assignments
-- 2. RLS policies for parent insert/update/delete
-- 3. Update get_player_assignments RPC with source_filter
-- 4. Sunday auto-clear function
-- ============================================

-- 1A. Add source column (existing rows default to 'coach')
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS source TEXT
    CHECK (source IN ('coach', 'parent')) DEFAULT 'coach';
CREATE INDEX IF NOT EXISTS idx_assignments_source ON assignments(source);
CREATE INDEX IF NOT EXISTS idx_assignments_player_source ON assignments(player_id, source);

-- 1B. RLS: Parents can INSERT assignments for their children (source='parent' only)
DROP POLICY IF EXISTS "Parents can create assignments for their children" ON assignments;
CREATE POLICY "Parents can create assignments for their children"
ON assignments FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM family_members fm
        WHERE fm.user_id = auth.uid()
          AND fm.player_id = assignments.player_id
          AND fm.relationship = 'guardian'
    )
    AND assignments.source = 'parent'
);

-- 1C. RLS: Parents can UPDATE their own parent-assignments
DROP POLICY IF EXISTS "Parents can update their own assignments" ON assignments;
CREATE POLICY "Parents can update their own assignments"
ON assignments FOR UPDATE
USING (assigned_by = auth.uid() AND source = 'parent');

-- 1D. RLS: Parents can DELETE their own parent-assignments
DROP POLICY IF EXISTS "Parents can delete their own assignments" ON assignments;
CREATE POLICY "Parents can delete their own assignments"
ON assignments FOR DELETE
USING (assigned_by = auth.uid() AND source = 'parent');

-- 1E. Update get_player_assignments RPC to accept optional source_filter
-- Must drop old signature first (1 param) before creating new one (2 params)
DROP FUNCTION IF EXISTS get_player_assignments(UUID);
CREATE OR REPLACE FUNCTION get_player_assignments(
    target_player_id UUID,
    source_filter TEXT DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    drill_id UUID,
    status TEXT,
    due_date TIMESTAMPTZ,
    custom_duration INTEGER,
    source TEXT,
    assigned_by UUID,
    drill_name TEXT,
    drill_duration INTEGER,
    drill_category TEXT,
    drill_video_url TEXT,
    drill_description TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.drill_id,
        a.status,
        a.due_date,
        a.custom_duration,
        a.source,
        a.assigned_by,
        d.name AS drill_name,
        d.duration AS drill_duration,
        d.category AS drill_category,
        d.video_url AS drill_video_url,
        d.description AS drill_description
    FROM assignments a
    JOIN drills d ON d.id = a.drill_id
    WHERE a.player_id = target_player_id
      AND (source_filter IS NULL OR a.source = source_filter)
      AND a.status != 'skipped'
    ORDER BY
        CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END,
        a.due_date ASC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_player_assignments TO authenticated, anon;

-- 1F. Sunday auto-clear function
CREATE OR REPLACE FUNCTION clear_weekly_assignments()
RETURNS void AS $$
BEGIN
    -- Delete all pending/in-progress assignments from previous weeks
    DELETE FROM assignments
    WHERE status IN ('pending', 'in_progress')
      AND created_at < date_trunc('week', CURRENT_DATE);

    -- Reset weekly_minutes
    UPDATE player_stats SET weekly_minutes = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION clear_weekly_assignments TO authenticated, anon;

-- To schedule: enable pg_cron in Supabase Dashboard, then run:
-- SELECT cron.schedule('sunday-clear-assignments', '0 6 * * 0', 'SELECT clear_weekly_assignments()');

NOTIFY pgrst, 'reload schema';
