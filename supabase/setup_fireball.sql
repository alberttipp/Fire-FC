-- Fire Ball Game Matches Schema
-- Run this in Supabase SQL Editor to enable multiplayer

-- Game Matches Table
CREATE TABLE IF NOT EXISTS game_matches (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    host_id UUID REFERENCES profiles(id) NOT NULL,
    guest_id UUID REFERENCES profiles(id),
    host_data JSONB DEFAULT '{}',
    guest_data JSONB DEFAULT '{}',
    status TEXT CHECK (status IN ('waiting', 'ready', 'playing', 'finished')) DEFAULT 'waiting',
    final_score JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE
);

-- Game Match History (for leaderboards)
CREATE TABLE IF NOT EXISTS game_match_results (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    match_id UUID REFERENCES game_matches(id),
    winner_id UUID REFERENCES profiles(id),
    loser_id UUID REFERENCES profiles(id),
    winner_score INTEGER NOT NULL,
    loser_score INTEGER NOT NULL,
    match_duration INTEGER, -- in seconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Player Game Stats
CREATE TABLE IF NOT EXISTS player_game_stats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    player_id UUID REFERENCES profiles(id) UNIQUE NOT NULL,
    total_matches INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    total_goals_scored INTEGER DEFAULT 0,
    total_goals_conceded INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_matches_status ON game_matches(status);
CREATE INDEX IF NOT EXISTS idx_game_matches_host ON game_matches(host_id);
CREATE INDEX IF NOT EXISTS idx_game_match_results_winner ON game_match_results(winner_id);
CREATE INDEX IF NOT EXISTS idx_player_game_stats_wins ON player_game_stats(wins DESC);

-- RLS Policies
ALTER TABLE game_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_game_stats ENABLE ROW LEVEL SECURITY;

-- Anyone can view waiting matches
CREATE POLICY "View waiting matches" ON game_matches
    FOR SELECT USING (status = 'waiting' OR host_id = auth.uid() OR guest_id = auth.uid());

-- Players can create matches
CREATE POLICY "Create matches" ON game_matches
    FOR INSERT WITH CHECK (auth.uid() = host_id);

-- Players can update their own matches
CREATE POLICY "Update own matches" ON game_matches
    FOR UPDATE USING (auth.uid() = host_id OR auth.uid() = guest_id);

-- Match results viewable by everyone
CREATE POLICY "View match results" ON game_match_results
    FOR SELECT USING (true);

-- Game stats viewable by everyone (for leaderboard)
CREATE POLICY "View game stats" ON player_game_stats
    FOR SELECT USING (true);

-- Players can update their own stats
CREATE POLICY "Update own stats" ON player_game_stats
    FOR ALL USING (auth.uid() = player_id);

-- Function to update player stats after a match
CREATE OR REPLACE FUNCTION update_player_game_stats(
    p_player_id UUID,
    p_goals_scored INTEGER,
    p_goals_conceded INTEGER,
    p_is_winner BOOLEAN
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO player_game_stats (player_id, total_matches, wins, losses, total_goals_scored, total_goals_conceded, current_streak, best_streak)
    VALUES (
        p_player_id, 
        1, 
        CASE WHEN p_is_winner THEN 1 ELSE 0 END,
        CASE WHEN NOT p_is_winner THEN 1 ELSE 0 END,
        p_goals_scored,
        p_goals_conceded,
        CASE WHEN p_is_winner THEN 1 ELSE 0 END,
        CASE WHEN p_is_winner THEN 1 ELSE 0 END
    )
    ON CONFLICT (player_id) DO UPDATE SET
        total_matches = player_game_stats.total_matches + 1,
        wins = player_game_stats.wins + CASE WHEN p_is_winner THEN 1 ELSE 0 END,
        losses = player_game_stats.losses + CASE WHEN NOT p_is_winner THEN 1 ELSE 0 END,
        total_goals_scored = player_game_stats.total_goals_scored + p_goals_scored,
        total_goals_conceded = player_game_stats.total_goals_conceded + p_goals_conceded,
        current_streak = CASE 
            WHEN p_is_winner THEN player_game_stats.current_streak + 1 
            ELSE 0 
        END,
        best_streak = GREATEST(
            player_game_stats.best_streak, 
            CASE WHEN p_is_winner THEN player_game_stats.current_streak + 1 ELSE player_game_stats.best_streak END
        ),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get leaderboard
CREATE OR REPLACE FUNCTION get_game_leaderboard(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    player_id UUID,
    player_name TEXT,
    avatar_url TEXT,
    wins INTEGER,
    total_matches INTEGER,
    win_rate NUMERIC,
    total_goals INTEGER,
    best_streak INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pgs.player_id,
        p.full_name as player_name,
        p.avatar_url,
        pgs.wins,
        pgs.total_matches,
        CASE WHEN pgs.total_matches > 0 
            THEN ROUND((pgs.wins::NUMERIC / pgs.total_matches) * 100, 1) 
            ELSE 0 
        END as win_rate,
        pgs.total_goals_scored as total_goals,
        pgs.best_streak
    FROM player_game_stats pgs
    JOIN profiles p ON p.id = pgs.player_id
    WHERE pgs.total_matches > 0
    ORDER BY pgs.wins DESC, pgs.total_goals_scored DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Enable Realtime for game_matches
ALTER PUBLICATION supabase_realtime ADD TABLE game_matches;
