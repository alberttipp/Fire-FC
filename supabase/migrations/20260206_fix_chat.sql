-- ============================================
-- FIX CHAT SYSTEM
-- 1. Add sender_name/sender_role to messages
-- 2. Fix self-referencing RLS on conversation_members
-- 3. Bootstrap team conversations for existing teams
-- ============================================

-- 1. Add sender display columns to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_role TEXT;

-- 2. Fix the self-referencing RLS policy on conversation_members
-- The old policy queries conversation_members FROM within conversation_members → infinite recursion risk
DROP POLICY IF EXISTS "Members can view conversation participants" ON conversation_members;

-- Replace with a function-based approach
CREATE OR REPLACE FUNCTION is_conversation_member(conv_id UUID, uid UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM conversation_members
        WHERE conversation_id = conv_id
        AND user_id = uid
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Now the policy calls a SECURITY DEFINER function (bypasses RLS internally)
CREATE POLICY "Members can view conversation participants"
ON conversation_members FOR SELECT
USING (
    is_conversation_member(conversation_id, auth.uid())
);

-- 3. Also allow staff to see team conversation members via team_memberships
DROP POLICY IF EXISTS "Staff can view team conversation members" ON conversation_members;
CREATE POLICY "Staff can view team conversation members"
ON conversation_members FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM conversations c
        JOIN team_memberships tm ON tm.team_id = c.team_id
        WHERE c.id = conversation_members.conversation_id
        AND c.type = 'team'
        AND tm.user_id = auth.uid()
        AND tm.role IN ('manager', 'coach', 'parent')
    )
);

-- 4. Allow staff to see team conversations even without conversation_members entry
-- (They get access via team_memberships, the existing policy already handles this)

-- 5. Bootstrap: Create a team conversation for every team that doesn't have one
INSERT INTO conversations (id, team_id, type, name, created_at)
SELECT
    uuid_generate_v4(),
    t.id,
    'team',
    t.name || ' Chat',
    NOW()
FROM teams t
WHERE NOT EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.team_id = t.id AND c.type = 'team'
);

-- 6. Add all team members to the team conversation's conversation_members
INSERT INTO conversation_members (id, conversation_id, user_id, role, joined_at)
SELECT
    uuid_generate_v4(),
    c.id,
    tm.user_id,
    CASE WHEN tm.role IN ('manager', 'coach') THEN 'admin' ELSE 'member' END,
    NOW()
FROM conversations c
JOIN teams t ON t.id = c.team_id AND c.type = 'team'
JOIN team_memberships tm ON tm.team_id = t.id
WHERE NOT EXISTS (
    SELECT 1 FROM conversation_members cm
    WHERE cm.conversation_id = c.id AND cm.user_id = tm.user_id
);

-- 7. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
