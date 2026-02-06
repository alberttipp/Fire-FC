-- ============================================
-- PLAYER ACCESS TOKENS (Parent-Controlled Links)
-- Replaces PIN-based player login
-- ============================================

-- Create the tokens table
CREATE TABLE IF NOT EXISTS player_access_tokens (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    created_by UUID REFERENCES auth.users(id),  -- Parent who created it
    expires_at TIMESTAMPTZ,  -- NULL = never expires
    is_active BOOLEAN DEFAULT TRUE,
    use_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_player_access_tokens_token ON player_access_tokens(token);
CREATE INDEX IF NOT EXISTS idx_player_access_tokens_player ON player_access_tokens(player_id);

-- Enable RLS
ALTER TABLE player_access_tokens ENABLE ROW LEVEL SECURITY;

-- Parents can view/manage tokens for their linked children
DROP POLICY IF EXISTS "Parents can view own children tokens" ON player_access_tokens;
CREATE POLICY "Parents can view own children tokens" ON player_access_tokens
FOR SELECT TO authenticated
USING (
    created_by = auth.uid()
    OR player_id IN (
        SELECT player_id FROM family_members
        WHERE user_id = auth.uid() AND relationship IN ('guardian', 'parent')
    )
);

DROP POLICY IF EXISTS "Parents can create tokens for children" ON player_access_tokens;
CREATE POLICY "Parents can create tokens for children" ON player_access_tokens
FOR INSERT TO authenticated
WITH CHECK (
    player_id IN (
        SELECT player_id FROM family_members
        WHERE user_id = auth.uid() AND relationship IN ('guardian', 'parent')
    )
);

DROP POLICY IF EXISTS "Parents can update own tokens" ON player_access_tokens;
CREATE POLICY "Parents can update own tokens" ON player_access_tokens
FOR UPDATE TO authenticated
USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Parents can delete own tokens" ON player_access_tokens;
CREATE POLICY "Parents can delete own tokens" ON player_access_tokens
FOR DELETE TO authenticated
USING (created_by = auth.uid());

-- Anon can verify tokens (for login)
DROP POLICY IF EXISTS "Anyone can verify tokens" ON player_access_tokens;
CREATE POLICY "Anyone can verify tokens" ON player_access_tokens
FOR SELECT TO anon
USING (is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW()));

-- ============================================
-- FUNCTION: Generate access token for player
-- ============================================
CREATE OR REPLACE FUNCTION generate_player_access_token(
    p_player_id UUID,
    p_expires_hours INTEGER DEFAULT NULL  -- NULL = never expires
)
RETURNS TABLE(token TEXT, expires_at TIMESTAMPTZ) AS $$
DECLARE
    v_token TEXT;
    v_expires TIMESTAMPTZ;
BEGIN
    -- Generate a URL-safe random token
    v_token := encode(gen_random_bytes(24), 'base64');
    -- Make it URL-safe
    v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');

    -- Calculate expiration
    IF p_expires_hours IS NOT NULL THEN
        v_expires := NOW() + (p_expires_hours || ' hours')::INTERVAL;
    ELSE
        v_expires := NULL;
    END IF;

    -- Deactivate any existing tokens for this player by this parent
    UPDATE player_access_tokens
    SET is_active = FALSE
    WHERE player_id = p_player_id AND created_by = auth.uid();

    -- Insert new token
    INSERT INTO player_access_tokens (player_id, token, created_by, expires_at)
    VALUES (p_player_id, v_token, auth.uid(), v_expires);

    RETURN QUERY SELECT v_token, v_expires;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION generate_player_access_token TO authenticated;

-- ============================================
-- FUNCTION: Verify token and get player data
-- ============================================
CREATE OR REPLACE FUNCTION verify_player_access_token(p_token TEXT)
RETURNS JSON AS $$
DECLARE
    v_token_record RECORD;
    v_player RECORD;
BEGIN
    -- Find the token
    SELECT * INTO v_token_record
    FROM player_access_tokens
    WHERE token = p_token
      AND is_active = TRUE
      AND (expires_at IS NULL OR expires_at > NOW());

    IF NOT FOUND THEN
        RETURN json_build_object('success', FALSE, 'message', 'Invalid or expired link');
    END IF;

    -- Get player data
    SELECT p.*, t.name as team_name
    INTO v_player
    FROM players p
    LEFT JOIN teams t ON p.team_id = t.id
    WHERE p.id = v_token_record.player_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', FALSE, 'message', 'Player not found');
    END IF;

    -- Update usage stats
    UPDATE player_access_tokens
    SET use_count = use_count + 1, last_used_at = NOW()
    WHERE id = v_token_record.id;

    -- Return player data
    RETURN json_build_object(
        'success', TRUE,
        'player', json_build_object(
            'id', v_player.id,
            'first_name', v_player.first_name,
            'last_name', v_player.last_name,
            'avatar_url', v_player.avatar_url,
            'team_id', v_player.team_id,
            'team_name', v_player.team_name,
            'jersey_number', v_player.jersey_number,
            'position', v_player.position
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION verify_player_access_token TO anon, authenticated;

-- ============================================
-- FUNCTION: Revoke token
-- ============================================
CREATE OR REPLACE FUNCTION revoke_player_access_token(p_player_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE player_access_tokens
    SET is_active = FALSE
    WHERE player_id = p_player_id AND created_by = auth.uid();

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION revoke_player_access_token TO authenticated;

-- Refresh schema
NOTIFY pgrst, 'reload schema';
