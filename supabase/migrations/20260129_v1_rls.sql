-- PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

-- TEAMS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view team"
ON teams FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM team_memberships
        WHERE team_id = teams.id
        AND user_id = auth.uid()
    )
);

CREATE POLICY "Managers can manage teams"
ON teams FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM team_memberships
        WHERE team_id = teams.id
        AND user_id = auth.uid()
        AND role = 'manager'
    )
);

-- TEAM_MEMBERSHIPS
ALTER TABLE team_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memberships"
ON team_memberships FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Managers and coaches can manage memberships"
ON team_memberships FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM team_memberships tm
        WHERE tm.team_id = team_memberships.team_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('manager', 'coach')
    )
);

-- PLAYERS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Team members (coach/parent/player) can view roster
CREATE POLICY "Team members can view roster"
ON players FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM team_memberships
        WHERE team_id = players.team_id
        AND user_id = auth.uid()
        AND role IN ('manager', 'coach', 'parent', 'player')
    )
);

-- Fans can ONLY view their linked player (not full roster)
CREATE POLICY "Fans can view only linked player"
ON players FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM player_fans
        WHERE player_user_id = players.user_id
        AND fan_user_id = auth.uid()
    )
);

-- Coaches can manage players
CREATE POLICY "Coaches can manage players"
ON players FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM team_memberships
        WHERE team_id = players.team_id
        AND user_id = auth.uid()
        AND role IN ('coach', 'manager')
    )
);

-- PLAYER_CREDENTIALS
ALTER TABLE player_credentials ENABLE ROW LEVEL SECURITY;

-- Only the player can view their own credentials (for pin reset UI if needed)
CREATE POLICY "Players can view own credentials"
ON player_credentials FOR SELECT
USING (auth.uid() = player_user_id);

-- No direct updates allowed (must use reset-player-pin Edge Function)

-- PLAYER_GUARDIANS
ALTER TABLE player_guardians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guardians can view their players"
ON player_guardians FOR SELECT
USING (auth.uid() = guardian_user_id);

CREATE POLICY "Players can view their guardians"
ON player_guardians FOR SELECT
USING (auth.uid() = player_user_id);

CREATE POLICY "Coaches can view guardian relationships"
ON player_guardians FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM players p
        JOIN team_memberships tm ON tm.team_id = p.team_id
        WHERE p.user_id = player_guardians.player_user_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('coach', 'manager')
    )
);

-- PLAYER_FANS
ALTER TABLE player_fans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fans can view own relationships"
ON player_fans FOR SELECT
USING (auth.uid() = fan_user_id);

CREATE POLICY "Players and guardians can manage fan access"
ON player_fans FOR ALL
USING (
    auth.uid() = player_user_id
    OR EXISTS (
        SELECT 1 FROM player_guardians
        WHERE player_user_id = player_fans.player_user_id
        AND guardian_user_id = auth.uid()
    )
);

-- EVENTS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view events"
ON events FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM team_memberships
        WHERE team_id = events.team_id
        AND user_id = auth.uid()
    )
);

CREATE POLICY "Coaches can manage events"
ON events FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM team_memberships
        WHERE team_id = events.team_id
        AND user_id = auth.uid()
        AND role IN ('coach', 'manager')
    )
);

-- EVENT_PLAYER_RSVPS
ALTER TABLE event_player_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can manage own RSVPs"
ON event_player_rsvps FOR ALL
USING (auth.uid() = player_user_id);

CREATE POLICY "Guardians can RSVP for players"
ON event_player_rsvps FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM player_guardians
        WHERE player_user_id = event_player_rsvps.player_user_id
        AND guardian_user_id = auth.uid()
        AND can_rsvp = TRUE
    )
);

CREATE POLICY "Coaches can view team RSVPs"
ON event_player_rsvps FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM events e
        JOIN team_memberships tm ON tm.team_id = e.team_id
        WHERE e.id = event_player_rsvps.event_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('coach', 'manager')
    )
);

-- EVENT_ATTENDANCE
ALTER TABLE event_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can manage attendance"
ON event_attendance FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM events e
        JOIN team_memberships tm ON tm.team_id = e.team_id
        WHERE e.id = event_attendance.event_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('coach', 'manager')
    )
);

-- CONVERSATIONS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Team conversations visible to staff only (NOT players or fans)
CREATE POLICY "Staff can view team conversations"
ON conversations FOR SELECT
USING (
    type = 'team'
    AND EXISTS (
        SELECT 1 FROM team_memberships
        WHERE team_id = conversations.team_id
        AND user_id = auth.uid()
        AND role IN ('manager', 'coach', 'parent')
    )
);

-- Player DMs visible to players who are members
CREATE POLICY "Players can view their player DMs"
ON conversations FOR SELECT
USING (
    type = 'player_dm'
    AND EXISTS (
        SELECT 1 FROM conversation_members
        WHERE conversation_id = conversations.id
        AND user_id = auth.uid()
    )
);

-- Staff DMs visible to staff who are members
CREATE POLICY "Staff can view their staff DMs"
ON conversations FOR SELECT
USING (
    type = 'staff_dm'
    AND EXISTS (
        SELECT 1 FROM conversation_members
        WHERE conversation_id = conversations.id
        AND user_id = auth.uid()
    )
);

-- Guardians can view player DMs involving their player
CREATE POLICY "Guardians can view player DMs involving their player"
ON conversations FOR SELECT
USING (
    type = 'player_dm'
    AND EXISTS (
        SELECT 1 FROM player_guardians pg
        JOIN conversation_members cm ON cm.user_id = pg.player_user_id
        WHERE cm.conversation_id = conversations.id
        AND pg.guardian_user_id = auth.uid()
        AND pg.can_view_messages = TRUE
    )
);

-- Players can create player_dm conversations
CREATE POLICY "Players can create player DMs"
ON conversations FOR INSERT
WITH CHECK (
    type = 'player_dm'
    AND is_player(auth.uid())
);

-- Staff can create staff_dm and team conversations
CREATE POLICY "Staff can create staff DMs and team conversations"
ON conversations FOR INSERT
WITH CHECK (
    (type = 'staff_dm' OR type = 'team')
    AND is_staff(auth.uid())
);

-- CONVERSATION_MEMBERS
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;

-- Members can view conversation participants
CREATE POLICY "Members can view conversation participants"
ON conversation_members FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM conversation_members cm
        WHERE cm.conversation_id = conversation_members.conversation_id
        AND cm.user_id = auth.uid()
    )
);

-- Guardians can view player conversation participants
CREATE POLICY "Guardians can view player conversation participants"
ON conversation_members FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM conversations c
        JOIN player_guardians pg ON pg.guardian_user_id = auth.uid()
        JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = pg.player_user_id
        WHERE c.id = conversation_members.conversation_id
        AND c.type = 'player_dm'
        AND pg.can_view_messages = TRUE
    )
);

-- Players can add members to player_dm (only other players on same team, max 2 total)
CREATE POLICY "Players can add members to player DMs"
ON conversation_members FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = conversation_members.conversation_id
        AND c.type = 'player_dm'
        AND c.created_by = auth.uid()
    )
    AND is_player(conversation_members.user_id)
    AND (
        SELECT team_id FROM players WHERE user_id = conversation_members.user_id
    ) = get_player_team(auth.uid())
    AND (
        SELECT COUNT(*) FROM conversation_members
        WHERE conversation_id = conversation_members.conversation_id
    ) < 2
);

-- Staff can add members to staff_dm and team conversations
CREATE POLICY "Staff can add members to staff DMs and team conversations"
ON conversation_members FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = conversation_members.conversation_id
        AND c.type IN ('staff_dm', 'team')
        AND c.created_by = auth.uid()
    )
    AND is_staff(conversation_members.user_id)
);

-- MESSAGES
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Conversation members can view messages
CREATE POLICY "Conversation members can view messages"
ON messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM conversation_members
        WHERE conversation_id = messages.conversation_id
        AND user_id = auth.uid()
    )
);

-- Guardians can view messages in their player's player_dm conversations only
CREATE POLICY "Guardians can view player DM messages"
ON messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM conversations c
        JOIN conversation_members cm ON cm.conversation_id = c.id
        JOIN player_guardians pg ON pg.player_user_id = cm.user_id
        WHERE c.id = messages.conversation_id
        AND c.type = 'player_dm' -- Only player DMs, not team or staff_dm
        AND pg.guardian_user_id = auth.uid()
        AND pg.can_view_messages = TRUE
    )
);

-- Players can send messages in player_dm only
CREATE POLICY "Players can send messages in player DMs"
ON messages FOR INSERT
WITH CHECK (
    sender_id = auth.uid()
    AND is_player(auth.uid())
    AND EXISTS (
        SELECT 1 FROM conversations
        WHERE id = messages.conversation_id
        AND type = 'player_dm'
    )
    AND EXISTS (
        SELECT 1 FROM conversation_members
        WHERE conversation_id = messages.conversation_id
        AND user_id = auth.uid()
    )
);

-- Staff can send messages in team and staff_dm conversations
CREATE POLICY "Staff can send messages in team and staff DMs"
ON messages FOR INSERT
WITH CHECK (
    sender_id = auth.uid()
    AND is_staff(auth.uid())
    AND EXISTS (
        SELECT 1 FROM conversations
        WHERE id = messages.conversation_id
        AND type IN ('team', 'staff_dm')
    )
    AND EXISTS (
        SELECT 1 FROM conversation_members
        WHERE conversation_id = messages.conversation_id
        AND user_id = auth.uid()
    )
);

-- WEEKLY_ASSIGNMENTS
ALTER TABLE weekly_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view assignments"
ON weekly_assignments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM team_memberships
        WHERE team_id = weekly_assignments.team_id
        AND user_id = auth.uid()
    )
);

CREATE POLICY "Coaches can manage assignments"
ON weekly_assignments FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM team_memberships
        WHERE team_id = weekly_assignments.team_id
        AND user_id = auth.uid()
        AND role IN ('coach', 'manager')
    )
);

-- WEEKLY_ASSIGNMENT_DRILLS
ALTER TABLE weekly_assignment_drills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view assignment drills"
ON weekly_assignment_drills FOR SELECT
USING (true);

-- PLAYER_DRILL_COMPLETIONS
ALTER TABLE player_drill_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own completions"
ON player_drill_completions FOR SELECT
USING (auth.uid() = player_user_id);

CREATE POLICY "Players can mark drills complete"
ON player_drill_completions FOR INSERT
WITH CHECK (auth.uid() = player_user_id);

CREATE POLICY "Guardians can view player completions"
ON player_drill_completions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM player_guardians
        WHERE player_user_id = player_drill_completions.player_user_id
        AND guardian_user_id = auth.uid()
    )
);

CREATE POLICY "Coaches can view team completions"
ON player_drill_completions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM players p
        JOIN team_memberships tm ON tm.team_id = p.team_id
        WHERE p.user_id = player_drill_completions.player_user_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('coach', 'manager')
    )
);

-- PLAYER_WEEKLY_STATS
ALTER TABLE player_weekly_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own stats"
ON player_weekly_stats FOR SELECT
USING (auth.uid() = player_user_id);

CREATE POLICY "Guardians can view player stats"
ON player_weekly_stats FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM player_guardians
        WHERE player_user_id = player_weekly_stats.player_user_id
        AND guardian_user_id = auth.uid()
    )
);

CREATE POLICY "Coaches can view team stats"
ON player_weekly_stats FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM players p
        JOIN team_memberships tm ON tm.team_id = p.team_id
        WHERE p.user_id = player_weekly_stats.player_user_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('coach', 'manager')
    )
);

-- PLAYER_BADGES
ALTER TABLE player_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view badges"
ON player_badges FOR SELECT
USING (true);

CREATE POLICY "Coaches can award badges"
ON player_badges FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM players p
        JOIN team_memberships tm ON tm.team_id = p.team_id
        WHERE p.user_id = player_badges.player_user_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('coach', 'manager')
    )
);
