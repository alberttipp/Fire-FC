-- ============================================
-- FIX CHAT FOR PARENTS (via family_members)
-- Parents link to teams through family_members → players → teams
-- Not through team_memberships. Need RLS for this path.
-- ============================================

-- 1. Allow parents (via family_members) to see team conversations
DROP POLICY IF EXISTS "Parents via family can view team conversations" ON conversations;
CREATE POLICY "Parents via family can view team conversations"
ON conversations FOR SELECT
USING (
    type = 'team'
    AND EXISTS (
        SELECT 1 FROM family_members fm
        JOIN players p ON p.id = fm.player_id
        WHERE fm.user_id = auth.uid()
        AND p.team_id = conversations.team_id
    )
);

-- 2. Allow parents (via family_members) to see messages in team conversations
DROP POLICY IF EXISTS "Parents via family can view team messages" ON messages;
CREATE POLICY "Parents via family can view team messages"
ON messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM conversations c
        JOIN family_members fm ON EXISTS (
            SELECT 1 FROM players p WHERE p.id = fm.player_id AND p.team_id = c.team_id
        )
        WHERE c.id = messages.conversation_id
        AND c.type = 'team'
        AND fm.user_id = auth.uid()
    )
);

-- 3. Allow parents (via family_members) to send messages in team conversations
DROP POLICY IF EXISTS "Parents via family can send team messages" ON messages;
CREATE POLICY "Parents via family can send team messages"
ON messages FOR INSERT
WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM conversations c
        JOIN family_members fm ON EXISTS (
            SELECT 1 FROM players p WHERE p.id = fm.player_id AND p.team_id = c.team_id
        )
        WHERE c.id = messages.conversation_id
        AND c.type = 'team'
        AND fm.user_id = auth.uid()
    )
);

-- 4. Allow parents (via family_members) to see team conversation members
DROP POLICY IF EXISTS "Parents via family can view team conv members" ON conversation_members;
CREATE POLICY "Parents via family can view team conv members"
ON conversation_members FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM conversations c
        JOIN family_members fm ON EXISTS (
            SELECT 1 FROM players p WHERE p.id = fm.player_id AND p.team_id = c.team_id
        )
        WHERE c.id = conversation_members.conversation_id
        AND c.type = 'team'
        AND fm.user_id = auth.uid()
    )
);

-- 5. Also add family-linked parents as conversation_members for existing team chats
INSERT INTO conversation_members (id, conversation_id, user_id, role, joined_at)
SELECT
    uuid_generate_v4(),
    c.id,
    fm.user_id,
    'member',
    NOW()
FROM conversations c
JOIN players p ON p.team_id = c.team_id
JOIN family_members fm ON fm.player_id = p.id
WHERE c.type = 'team'
AND NOT EXISTS (
    SELECT 1 FROM conversation_members cm
    WHERE cm.conversation_id = c.id AND cm.user_id = fm.user_id
);

-- 6. Refresh schema cache
NOTIFY pgrst, 'reload schema';
