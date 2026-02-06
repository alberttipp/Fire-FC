import React, { useState, useEffect } from 'react';
import { Crown, Trophy, Medal, Clock } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

const Leaderboard = () => {
    const { user } = useAuth();
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLeaderboard();

        // Subscribe to realtime updates on player_stats
        const channel = supabase
            .channel('leaderboard-updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'player_stats'
                },
                (payload) => {
                    console.log('[Leaderboard] Stats updated via realtime, refreshing...', payload);
                    fetchLeaderboard();
                }
            )
            .subscribe();

        // Also listen for custom drill-completed events (fallback if realtime isn't working)
        const handleDrillCompleted = () => {
            console.log('[Leaderboard] Drill completed event received, refreshing...');
            // Small delay to allow DB trigger to complete
            setTimeout(() => fetchLeaderboard(), 500);
        };
        window.addEventListener('drill-completed', handleDrillCompleted);

        return () => {
            supabase.removeChannel(channel);
            window.removeEventListener('drill-completed', handleDrillCompleted);
        };
    }, []);

    const fetchLeaderboard = async () => {
        setLoading(true);
        try {
            // Step 1: Fetch player_stats (no join - avoids RLS issues)
            const { data: statsData, error: statsError } = await supabase
                .from('player_stats')
                .select('player_id, training_minutes')
                .gt('training_minutes', 0)
                .order('training_minutes', { ascending: false })
                .limit(10);

            if (statsError) {
                console.error('[Leaderboard] Stats fetch error:', statsError);
                setPlayers([]);
                setLoading(false);
                return;
            }

            console.log('[Leaderboard] Stats data:', statsData);

            if (!statsData || statsData.length === 0) {
                console.log('[Leaderboard] No stats data found');
                setPlayers([]);
                setLoading(false);
                return;
            }

            // Step 2: Fetch player names separately
            const playerIds = statsData.map(s => s.player_id);
            const { data: playersData, error: playersError } = await supabase
                .from('players')
                .select('id, first_name, last_name, user_id')
                .in('id', playerIds);

            if (playersError) {
                console.error('[Leaderboard] Players fetch error:', playersError);
            }

            console.log('[Leaderboard] Players data:', playersData);

            // Step 3: Merge data
            const playerMap = {};
            (playersData || []).forEach(p => { playerMap[p.id] = p; });

            const leaderboardData = statsData.map((stat, index) => {
                const player = playerMap[stat.player_id];
                return {
                    rank: index + 1,
                    name: player ? `${player.first_name} ${player.last_name?.charAt(0) || ''}.` : 'Unknown',
                    minutes: stat.training_minutes || 0,
                    team: 'Team',
                    isUser: player?.id === user?.id || player?.user_id === user?.id,
                    playerId: stat.player_id
                };
            });

            console.log('[Leaderboard] Final data:', leaderboardData);
            setPlayers(leaderboardData);
        } catch (err) {
            console.error('[Leaderboard] Fetch error:', err);
            setPlayers([]);
        }
        setLoading(false);
    };

    const getRankIcon = (rank) => {
        switch (rank) {
            case 1: return <Crown className="w-5 h-5 text-brand-gold fill-brand-gold animate-bounce" />;
            case 2: return <Medal className="w-5 h-5 text-gray-300" />;
            case 3: return <Medal className="w-5 h-5 text-amber-700" />;
            default: return <span className="font-display font-bold text-gray-400 w-5 text-center">{rank}</span>;
        }
    };

    return (
        <div className="glass-panel p-6 animate-fade-in-up delay-100">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl text-white font-display uppercase font-bold flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-brand-gold" /> Leaderboard
                </h3>
                <span className="text-xs text-brand-green border border-brand-green/30 px-2 py-1 rounded bg-brand-green/5 uppercase tracking-wider">
                    Weekly
                </span>
            </div>

            <div className="space-y-4">
                {/* Table Header */}
                <div className="grid grid-cols-12 text-xs text-gray-500 uppercase font-bold tracking-widest px-4">
                    <div className="col-span-2 text-center">Rank</div>
                    <div className="col-span-7">Player</div>
                    <div className="col-span-3 text-right flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" /> MIN
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-8 text-gray-500">
                        <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        Loading...
                    </div>
                ) : players.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No training data yet</p>
                        <p className="text-xs mt-1">Complete drills to appear on the leaderboard!</p>
                    </div>
                ) : (
                    players.map((player) => (
                        <div
                            key={player.playerId || player.rank}
                            className={`grid grid-cols-12 items-center p-3 rounded-lg border transition-all ${player.isUser ? 'bg-brand-green/10 border-brand-green/50 shadow-[0_0_15px_rgba(59,130,246,0.1)] scale-105 z-10' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                        >
                            <div className="col-span-2 flex justify-center">
                                {getRankIcon(player.rank)}
                            </div>
                            <div className="col-span-7 flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${player.isUser ? 'bg-brand-green text-brand-dark' : 'bg-gray-700 text-gray-300'}`}>
                                    {player.name.charAt(0)}
                                </div>
                                <div>
                                    <h4 className={`font-bold leading-none ${player.isUser ? 'text-brand-green' : 'text-white'}`}>{player.name}</h4>
                                    <p className="text-[10px] text-gray-500 uppercase">{player.team}</p>
                                </div>
                            </div>
                            <div className="col-span-3 text-right font-display font-bold text-white">
                                {player.minutes}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {players.length > 0 && (
                <div className="mt-6 pt-4 border-t border-white/5 text-center">
                    <button className="text-xs text-brand-green hover:underline uppercase tracking-widest">
                        View Full Rankings
                    </button>
                </div>
            )}
        </div>
    );
};

export default Leaderboard;
