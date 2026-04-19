-- ============================================
-- PHASE 3: COACH NOTES + 90-DAY IDP
-- 1. coach_notes table (per-player timestamped log)
-- 2. player_idps table (90-day individual development plans)
-- 3. idp_milestones table (30/60/90 day checkpoints)
-- ============================================

-- ============================================
-- 1. Coach Notes
-- ============================================
CREATE TABLE IF NOT EXISTS coach_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES auth.users(id),
    note_text TEXT NOT NULL,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE coach_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view coach notes" ON coach_notes FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM team_memberships tm
        JOIN players p ON p.team_id = tm.team_id
        WHERE p.id = coach_notes.player_id
          AND tm.user_id = auth.uid()
          AND tm.role IN ('coach', 'manager')
    )
);

CREATE POLICY "Staff can insert coach notes" ON coach_notes FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM team_memberships tm
        JOIN players p ON p.team_id = tm.team_id
        WHERE p.id = coach_notes.player_id
          AND tm.user_id = auth.uid()
          AND tm.role IN ('coach', 'manager')
    )
);

CREATE POLICY "Staff can delete own notes" ON coach_notes FOR DELETE USING (
    coach_id = auth.uid()
);

CREATE POLICY "Parents can view child notes" ON coach_notes FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM family_members fm
        JOIN players p ON p.id = fm.player_id
        WHERE p.id = coach_notes.player_id
          AND fm.user_id = auth.uid()
    )
);

CREATE INDEX idx_coach_notes_player ON coach_notes(player_id, created_at DESC);

-- ============================================
-- 2. 90-Day IDP
-- ============================================
CREATE TABLE IF NOT EXISTS player_idps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES auth.users(id),
    title TEXT NOT NULL,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '90 days'),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
    focus_areas TEXT[],
    baseline_snapshot JSONB,
    target_snapshot JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS idp_milestones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    idp_id UUID NOT NULL REFERENCES player_idps(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    target_date DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'missed')),
    coach_note TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE player_idps ENABLE ROW LEVEL SECURITY;
ALTER TABLE idp_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage IDPs" ON player_idps FOR ALL USING (
    EXISTS (
        SELECT 1 FROM team_memberships tm
        JOIN players p ON p.team_id = tm.team_id
        WHERE p.id = player_idps.player_id
          AND tm.user_id = auth.uid()
          AND tm.role IN ('coach', 'manager')
    )
);

CREATE POLICY "Players can view own IDP" ON player_idps FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM players p
        WHERE p.id = player_idps.player_id
          AND p.user_id = auth.uid()
    )
);

CREATE POLICY "Parents can view child IDP" ON player_idps FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM family_members fm
        JOIN players p ON p.id = fm.player_id
        WHERE p.id = player_idps.player_id
          AND fm.user_id = auth.uid()
    )
);

CREATE POLICY "Staff can manage milestones" ON idp_milestones FOR ALL USING (
    EXISTS (
        SELECT 1 FROM player_idps idp
        JOIN players p ON p.id = idp.player_id
        JOIN team_memberships tm ON tm.team_id = p.team_id
        WHERE idp.id = idp_milestones.idp_id
          AND tm.user_id = auth.uid()
          AND tm.role IN ('coach', 'manager')
    )
);

CREATE POLICY "Players can view own milestones" ON idp_milestones FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM player_idps idp
        JOIN players p ON p.id = idp.player_id
        WHERE idp.id = idp_milestones.idp_id
          AND p.user_id = auth.uid()
    )
);

CREATE POLICY "Parents can view child milestones" ON idp_milestones FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM player_idps idp
        JOIN players p ON p.id = idp.player_id
        JOIN family_members fm ON fm.player_id = p.id
        WHERE idp.id = idp_milestones.idp_id
          AND fm.user_id = auth.uid()
    )
);

CREATE INDEX idx_player_idps_player ON player_idps(player_id, status);
CREATE INDEX idx_idp_milestones_idp ON idp_milestones(idp_id, target_date);

NOTIFY pgrst, 'reload schema';
