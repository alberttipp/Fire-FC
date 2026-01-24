/**
 * Fire Ball - Multiplayer Matchmaking
 * Uses Supabase Realtime for online 1v1 matches
 */

import { supabase } from '../supabaseClient';

// Match states
export const MATCH_STATUS = {
    WAITING: 'waiting',
    READY: 'ready',
    PLAYING: 'playing',
    FINISHED: 'finished',
};

class MatchmakingManager {
    constructor() {
        this.channel = null;
        this.matchId = null;
        this.playerId = null;
        this.isHost = false;
        this.onMatchFound = null;
        this.onOpponentMove = null;
        this.onGoalScored = null;
        this.onMatchEnd = null;
    }

    /**
     * Initialize matchmaking for a player
     */
    async init(playerId) {
        this.playerId = playerId;
    }

    /**
     * Create a new match and wait for opponent
     */
    async createMatch(playerData) {
        try {
            // Create match record in database
            const { data, error } = await supabase
                .from('game_matches')
                .insert({
                    host_id: this.playerId,
                    host_data: playerData,
                    status: MATCH_STATUS.WAITING,
                    created_at: new Date().toISOString(),
                })
                .select()
                .single();

            if (error) throw error;

            this.matchId = data.id;
            this.isHost = true;

            // Subscribe to match updates
            this.subscribeToMatch(data.id);

            return { matchId: data.id, error: null };
        } catch (error) {
            console.error('Failed to create match:', error);
            return { matchId: null, error };
        }
    }

    /**
     * Join an existing match
     */
    async joinMatch(matchId, playerData) {
        try {
            // Update match with guest player
            const { data, error } = await supabase
                .from('game_matches')
                .update({
                    guest_id: this.playerId,
                    guest_data: playerData,
                    status: MATCH_STATUS.READY,
                })
                .eq('id', matchId)
                .eq('status', MATCH_STATUS.WAITING)
                .select()
                .single();

            if (error) throw error;

            this.matchId = matchId;
            this.isHost = false;

            // Subscribe to match updates
            this.subscribeToMatch(matchId);

            return { match: data, error: null };
        } catch (error) {
            console.error('Failed to join match:', error);
            return { match: null, error };
        }
    }

    /**
     * Find available matches to join
     */
    async findMatches() {
        try {
            const { data, error } = await supabase
                .from('game_matches')
                .select('*')
                .eq('status', MATCH_STATUS.WAITING)
                .neq('host_id', this.playerId)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;

            return { matches: data || [], error: null };
        } catch (error) {
            console.error('Failed to find matches:', error);
            return { matches: [], error };
        }
    }

    /**
     * Subscribe to real-time match updates
     */
    subscribeToMatch(matchId) {
        // Clean up existing subscription
        if (this.channel) {
            supabase.removeChannel(this.channel);
        }

        // Create real-time channel for this match
        this.channel = supabase.channel(`match:${matchId}`)
            .on('broadcast', { event: 'game_state' }, (payload) => {
                this.handleGameState(payload);
            })
            .on('broadcast', { event: 'player_move' }, (payload) => {
                if (this.onOpponentMove && payload.payload.playerId !== this.playerId) {
                    this.onOpponentMove(payload.payload);
                }
            })
            .on('broadcast', { event: 'goal' }, (payload) => {
                if (this.onGoalScored) {
                    this.onGoalScored(payload.payload);
                }
            })
            .on('broadcast', { event: 'match_end' }, (payload) => {
                if (this.onMatchEnd) {
                    this.onMatchEnd(payload.payload);
                }
            })
            .subscribe();
    }

    /**
     * Send player movement to opponent
     */
    sendPlayerMove(moveData) {
        if (!this.channel || !this.matchId) return;

        this.channel.send({
            type: 'broadcast',
            event: 'player_move',
            payload: {
                playerId: this.playerId,
                ...moveData,
                timestamp: Date.now(),
            },
        });
    }

    /**
     * Send ball state (only host sends this to sync)
     */
    sendBallState(ballData) {
        if (!this.channel || !this.matchId || !this.isHost) return;

        this.channel.send({
            type: 'broadcast',
            event: 'game_state',
            payload: {
                ball: ballData,
                timestamp: Date.now(),
            },
        });
    }

    /**
     * Send goal notification
     */
    sendGoal(scorer) {
        if (!this.channel || !this.matchId) return;

        this.channel.send({
            type: 'broadcast',
            event: 'goal',
            payload: {
                scorer,
                timestamp: Date.now(),
            },
        });
    }

    /**
     * End the match
     */
    async endMatch(finalScore) {
        if (!this.matchId) return;

        try {
            // Update match status
            await supabase
                .from('game_matches')
                .update({
                    status: MATCH_STATUS.FINISHED,
                    final_score: finalScore,
                    finished_at: new Date().toISOString(),
                })
                .eq('id', this.matchId);

            // Broadcast match end
            if (this.channel) {
                this.channel.send({
                    type: 'broadcast',
                    event: 'match_end',
                    payload: {
                        finalScore,
                    },
                });
            }
        } catch (error) {
            console.error('Failed to end match:', error);
        }
    }

    /**
     * Handle incoming game state
     */
    handleGameState(payload) {
        // Only guest processes host's ball state
        if (this.isHost) return;

        // Update local ball position (interpolation would be better)
        if (payload.payload.ball) {
            // This would be handled by the game engine
        }
    }

    /**
     * Clean up when leaving
     */
    cleanup() {
        if (this.channel) {
            supabase.removeChannel(this.channel);
            this.channel = null;
        }
        this.matchId = null;
        this.isHost = false;
    }

    /**
     * Cancel a waiting match
     */
    async cancelMatch() {
        if (!this.matchId || !this.isHost) return;

        try {
            await supabase
                .from('game_matches')
                .delete()
                .eq('id', this.matchId)
                .eq('status', MATCH_STATUS.WAITING);

            this.cleanup();
        } catch (error) {
            console.error('Failed to cancel match:', error);
        }
    }
}

// Singleton instance
const matchmaking = new MatchmakingManager();

export default matchmaking;
