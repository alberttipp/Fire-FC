-- ============================================
-- CREATE ASSIGNMENTS TABLE (was missing)
-- ============================================

CREATE TABLE IF NOT EXISTS assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    drill_id UUID NOT NULL REFERENCES drills(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES auth.users(id),
    status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')) DEFAULT 'pending',
    custom_duration INTEGER,
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_assignments_player ON assignments(player_id);
CREATE INDEX IF NOT EXISTS idx_assignments_drill ON assignments(drill_id);
CREATE INDEX IF NOT EXISTS idx_assignments_team ON assignments(team_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_player_status ON assignments(player_id, status);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- Coaches/Managers can view all assignments for their teams
CREATE POLICY "Team staff can view team assignments"
ON assignments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM team_memberships tm
        WHERE tm.team_id = assignments.team_id
          AND tm.user_id = auth.uid()
          AND tm.role IN ('coach', 'manager')
    )
);

-- Players can view their own assignments
CREATE POLICY "Players can view own assignments"
ON assignments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM players p
        WHERE p.id = assignments.player_id
          AND p.user_id = auth.uid()
    )
);

-- Parents can view their children's assignments
CREATE POLICY "Parents can view children assignments"
ON assignments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM family_members fm
        JOIN players p ON p.id = fm.player_id
        WHERE p.id = assignments.player_id
          AND fm.user_id = auth.uid()
          AND fm.relationship IN ('guardian', 'fan')
    )
);

-- Coaches/Managers can insert assignments for their teams
CREATE POLICY "Team staff can create assignments"
ON assignments FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM team_memberships tm
        WHERE tm.team_id = assignments.team_id
          AND tm.user_id = auth.uid()
          AND tm.role IN ('coach', 'manager')
    )
);

-- Coaches/Managers can update assignments for their teams
CREATE POLICY "Team staff can update team assignments"
ON assignments FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM team_memberships tm
        WHERE tm.team_id = assignments.team_id
          AND tm.user_id = auth.uid()
          AND tm.role IN ('coach', 'manager')
    )
);

-- Players can update their own assignments (mark complete)
CREATE POLICY "Players can update own assignments"
ON assignments FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM players p
        WHERE p.id = assignments.player_id
          AND p.user_id = auth.uid()
    )
);

-- Coaches/Managers can delete assignments
CREATE POLICY "Team staff can delete assignments"
ON assignments FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM team_memberships tm
        WHERE tm.team_id = assignments.team_id
          AND tm.user_id = auth.uid()
          AND tm.role IN ('coach', 'manager')
    )
);
