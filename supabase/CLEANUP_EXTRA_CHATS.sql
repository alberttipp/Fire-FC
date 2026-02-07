-- ============================================
-- CLEANUP: Remove conversations for test/seed teams
-- Only keep conversations for real teams (Fire FC)
-- ============================================

-- Preview: See which conversations exist and which teams they belong to
SELECT c.id, c.name as conversation_name, c.type, t.name as team_name, t.age_group
FROM conversations c
LEFT JOIN teams t ON t.id = c.team_id
ORDER BY c.created_at;

-- Delete conversation_members for non-Fire FC team chats
DELETE FROM conversation_members
WHERE conversation_id IN (
    SELECT c.id FROM conversations c
    JOIN teams t ON t.id = c.team_id
    WHERE c.type = 'team'
    AND t.name NOT ILIKE '%fire%'
);

-- Delete the conversations themselves
DELETE FROM conversations
WHERE type = 'team'
AND team_id IN (
    SELECT id FROM teams WHERE name NOT ILIKE '%fire%'
);

-- Verify: only Fire FC chat remains
SELECT c.id, c.name, t.name as team_name
FROM conversations c
LEFT JOIN teams t ON t.id = c.team_id;
