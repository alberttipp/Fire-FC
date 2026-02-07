import React, { useState, useEffect } from 'react';
import { Trophy, Plus, Minus, Play, Pause, Flag, Video, Loader2, Clock } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

const STATUS_CONFIG = {
    scheduled: { label: 'Upcoming', color: 'bg-gray-500/20 text-gray-400', dot: '' },
    live: { label: 'LIVE', color: 'bg-green-500/20 text-green-400', dot: 'animate-pulse' },
    halftime: { label: 'Half Time', color: 'bg-yellow-500/20 text-yellow-400', dot: '' },
    finished: { label: 'Final', color: 'bg-red-500/20 text-red-400', dot: '' },
};

const STATUS_FLOW = ['scheduled', 'live', 'halftime', 'live', 'finished'];

const LiveScoringView = () => {
    const { user, profile } = useAuth();
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [teamId, setTeamId] = useState(null);
    const [currentRole, setCurrentRole] = useState(profile?.role || user?.role || 'player');

    const isCoach = ['coach', 'manager'].includes(currentRole);

    // Resolve team ID (same pattern as GalleryView)
    useEffect(() => {
        if (user?.id) getTeamId();
    }, [user]);

    useEffect(() => {
        if (teamId) {
            fetchGames();
            // Subscribe to realtime score updates
            const channel = supabase
                .channel('live-scores')
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'events',
                    filter: `team_id=eq.${teamId}`
                }, (payload) => {
                    setGames(prev => prev.map(g =>
                        g.id === payload.new.id ? { ...g, ...payload.new } : g
                    ));
                })
                .subscribe();

            return () => supabase.removeChannel(channel);
        }
    }, [teamId]);

    const getTeamId = async () => {
        if (profile?.team_id) {
            setTeamId(profile.team_id);
            return;
        }

        const { data: membership } = await supabase
            .from('team_memberships')
            .select('team_id, role')
            .eq('user_id', user.id)
            .limit(1)
            .single();

        if (membership?.team_id) {
            if (membership.role) setCurrentRole(membership.role);
            setTeamId(membership.team_id);
            return;
        }

        const { data: family } = await supabase
            .from('family_members')
            .select('player_id')
            .eq('user_id', user.id)
            .limit(1)
            .single();

        if (family?.player_id) {
            const { data: player } = await supabase
                .from('players')
                .select('team_id')
                .eq('id', family.player_id)
                .single();

            if (player?.team_id) {
                setCurrentRole('parent');
                setTeamId(player.team_id);
                return;
            }
        }

        setLoading(false);
    };

    const fetchGames = async () => {
        setLoading(true);
        try {
            const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .eq('team_id', teamId)
                .eq('type', 'game')
                .gte('start_time', sevenDaysAgo)
                .order('start_time', { ascending: true });

            if (error) throw error;
            setGames(data || []);
        } catch (err) {
            console.error('Error fetching games:', err);
        } finally {
            setLoading(false);
        }
    };

    const updateScore = async (gameId, field, delta) => {
        const game = games.find(g => g.id === gameId);
        const newValue = Math.max(0, (game[field] || 0) + delta);

        // Optimistic update
        setGames(prev => prev.map(g =>
            g.id === gameId ? { ...g, [field]: newValue } : g
        ));

        const { error } = await supabase
            .from('events')
            .update({ [field]: newValue })
            .eq('id', gameId);

        if (error) {
            // Revert on error
            setGames(prev => prev.map(g =>
                g.id === gameId ? { ...g, [field]: game[field] } : g
            ));
        }
    };

    const updateStatus = async (gameId) => {
        const game = games.find(g => g.id === gameId);
        const currentIndex = STATUS_FLOW.indexOf(game.game_status || 'scheduled');
        const nextStatus = STATUS_FLOW[Math.min(currentIndex + 1, STATUS_FLOW.length - 1)];

        setGames(prev => prev.map(g =>
            g.id === gameId ? { ...g, game_status: nextStatus } : g
        ));

        await supabase
            .from('events')
            .update({ game_status: nextStatus })
            .eq('id', gameId);
    };

    const updateOpponent = async (gameId, name) => {
        await supabase
            .from('events')
            .update({ opponent_name: name })
            .eq('id', gameId);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-brand-green" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div>
                <h2 className="text-2xl md:text-3xl text-white font-display uppercase font-bold tracking-wider flex items-center gap-3">
                    <Trophy className="w-7 h-7 text-brand-gold" /> Live Scoring
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                    {games.filter(g => g.game_status === 'live').length > 0
                        ? `${games.filter(g => g.game_status === 'live').length} game${games.filter(g => g.game_status === 'live').length > 1 ? 's' : ''} in progress`
                        : `${games.length} game${games.length !== 1 ? 's' : ''} this week`
                    }
                </p>
            </div>

            {games.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-xl">
                    <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 font-bold mb-1">No games scheduled</p>
                    <p className="text-gray-500 text-sm">Create a game event from the Schedule tab.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {games.map(game => {
                        const date = new Date(game.start_time);
                        const statusCfg = STATUS_CONFIG[game.game_status || 'scheduled'];
                        const isLive = game.game_status === 'live' || game.game_status === 'halftime';

                        return (
                            <div
                                key={game.id}
                                className={`glass-panel p-5 border-l-4 ${isLive ? 'border-l-green-500' : game.game_status === 'finished' ? 'border-l-red-500' : 'border-l-brand-gold'}`}
                            >
                                {/* Date + Status */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-brand-gold/10 rounded-lg flex flex-col items-center justify-center">
                                            <span className="text-brand-gold text-xs font-bold uppercase">
                                                {date.toLocaleDateString('en-US', { month: 'short' })}
                                            </span>
                                            <span className="text-white text-lg font-bold leading-none">
                                                {date.getDate()}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-white font-bold">{game.title}</p>
                                            <p className="text-gray-500 text-xs flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                                {game.location_name && ` · ${game.location_name}`}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {isLive && <span className={`w-2 h-2 rounded-full bg-green-500 ${statusCfg.dot}`} />}
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${statusCfg.color}`}>
                                            {statusCfg.label}
                                        </span>
                                        {isCoach && game.game_status !== 'finished' && (
                                            <button
                                                onClick={() => updateStatus(game.id)}
                                                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-gray-400 hover:text-white transition-colors"
                                                title="Advance game status"
                                            >
                                                <Play className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Scoreboard */}
                                <div className="flex items-center justify-center gap-4 sm:gap-8 py-4 bg-white/5 rounded-xl">
                                    <div className="text-center">
                                        <p className="text-xs text-gray-400 uppercase font-bold mb-1">Fire FC</p>
                                        <div className="flex items-center gap-2">
                                            {isCoach && (
                                                <button
                                                    onClick={() => updateScore(game.id, 'home_score', -1)}
                                                    className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors"
                                                >
                                                    <Minus className="w-4 h-4" />
                                                </button>
                                            )}
                                            <span className="text-4xl sm:text-5xl font-mono font-bold text-white min-w-[3rem] text-center">
                                                {game.home_score || 0}
                                            </span>
                                            {isCoach && (
                                                <button
                                                    onClick={() => updateScore(game.id, 'home_score', 1)}
                                                    className="w-8 h-8 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/30 flex items-center justify-center transition-colors"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <span className="text-2xl text-gray-600 font-bold">—</span>

                                    <div className="text-center">
                                        <p className="text-xs text-gray-400 uppercase font-bold mb-1">
                                            {isCoach ? (
                                                <input
                                                    type="text"
                                                    value={game.opponent_name || ''}
                                                    onChange={(e) => setGames(prev => prev.map(g => g.id === game.id ? { ...g, opponent_name: e.target.value } : g))}
                                                    onBlur={(e) => updateOpponent(game.id, e.target.value)}
                                                    placeholder="Opponent"
                                                    className="bg-transparent border-b border-dashed border-gray-600 text-gray-400 text-xs uppercase text-center w-24 focus:outline-none focus:border-brand-gold"
                                                />
                                            ) : (
                                                game.opponent_name || 'Away'
                                            )}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            {isCoach && (
                                                <button
                                                    onClick={() => updateScore(game.id, 'away_score', -1)}
                                                    className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors"
                                                >
                                                    <Minus className="w-4 h-4" />
                                                </button>
                                            )}
                                            <span className="text-4xl sm:text-5xl font-mono font-bold text-white min-w-[3rem] text-center">
                                                {game.away_score || 0}
                                            </span>
                                            {isCoach && (
                                                <button
                                                    onClick={() => updateScore(game.id, 'away_score', 1)}
                                                    className="w-8 h-8 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/30 flex items-center justify-center transition-colors"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Video link */}
                                {game.video_url && (
                                    <a
                                        href={game.video_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-3 flex items-center gap-2 text-red-400 hover:text-red-300 text-sm transition-colors"
                                    >
                                        <Video className="w-4 h-4" /> Watch Stream
                                    </a>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default LiveScoringView;
