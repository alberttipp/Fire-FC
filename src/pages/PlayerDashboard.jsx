import React, { useState, useEffect } from 'react';
import PlayerCard from '../components/player/PlayerCard';
import HomeworkHub from '../components/player/HomeworkHub';
import { useAuth } from '../context/AuthContext';
import { LogOut, Flame, Zap, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { triggerMessiMode } from '../utils/messiMode';
import Leaderboard from '../components/player/Leaderboard';
import FireBall from '../game/FireBall';
import PlayerEvaluationModal from '../components/dashboard/PlayerEvaluationModal';
import BadgeCelebration from '../components/BadgeCelebration';

import { supabase } from '../supabaseClient';

const PlayerDashboard = () => {
    const { user, profile, signOut } = useAuth();
    const navigate = useNavigate();

    // ALL HOOKS MUST BE DECLARED BEFORE ANY CONDITIONAL RETURNS
    const [showCelebration, setShowCelebration] = useState(false);
    const [showGame, setShowGame] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [assignments, setAssignments] = useState([]);
    const [earnedBadges, setEarnedBadges] = useState([]);
    const [stats, setStats] = useState(null);
    const [newBadge, setNewBadge] = useState(null);
    const [showBadgeCelebration, setShowBadgeCelebration] = useState(false);
    const [playerRecord, setPlayerRecord] = useState(null); // The player's record from players table
    const [streakDays, setStreakDays] = useState(0); // Training streak (days in a row with 20+ min training)
    const [playerError, setPlayerError] = useState(null); // Error if player not found
    const [playerLoading, setPlayerLoading] = useState(true); // Loading state for player lookup

    useEffect(() => {
        if (!user?.id) return;

        const fetchDashboardData = async () => {
            setPlayerLoading(true);
            setPlayerError(null);

            // --- STANDARD FETCH (For All Users) ---
            console.log('[PlayerDashboard] Auth user.id:', user.id);
            console.log('[PlayerDashboard] User email:', user.email);

            // Detect if this is a PIN login (user.id is the players table ID directly)
            const isPinLogin = user.email === 'player@firefc.com';
            let playerData = null;

            if (isPinLogin) {
                // PIN login: user.id IS the players table ID
                console.log('[PlayerDashboard] PIN login detected - querying by players.id');
                const { data, error } = await supabase
                    .from('players')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (error) {
                    console.error('[PlayerDashboard] Player lookup by id failed:', error);
                } else {
                    playerData = data;
                }
            } else {
                // Auth login: user.id is the auth UUID, linked via players.user_id
                console.log('[PlayerDashboard] Auth login - querying by players.user_id');
                const { data, error } = await supabase
                    .from('players')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (error) {
                    console.error('[PlayerDashboard] Player lookup by user_id failed:', error);
                } else {
                    playerData = data;
                }
            }

            if (playerData) {
                console.log('[PlayerDashboard] Found player record:', playerData);
                setPlayerRecord(playerData);
                setPlayerError(null);
                setPlayerLoading(false);
            } else {
                // No player found - set error
                console.error('[PlayerDashboard] No player record found for user:', user.id);
                setPlayerError('Player profile not found. Please use a valid player access link from your parent.');
                setPlayerLoading(false);
                return; // Don't continue fetching other data
            }

            // Use player record ID
            const playerId = playerData.id;
            console.log('[PlayerDashboard] Using player_id:', playerId, 'from playerData:', !!playerData);

            // 1. Fetch Player Evaluation (coach ratings from evaluations table)
            const { data: evalData, error: evalError } = await supabase
                .from('evaluations')
                .select('*')
                .eq('player_id', playerId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (evalError && evalError.code !== 'PGRST116') {
                console.error('[PlayerDashboard] Evaluation fetch error:', evalError);
            }

            if (evalData) {
                console.log('[PlayerDashboard] Found evaluation:', evalData);
                setStats({
                    overall_rating: Math.round((evalData.pace + evalData.shooting + evalData.passing + evalData.dribbling + evalData.defending + evalData.physical) / 6),
                    pace: evalData.pace,
                    shooting: evalData.shooting,
                    passing: evalData.passing,
                    dribbling: evalData.dribbling,
                    defending: evalData.defending,
                    physical: evalData.physical
                });
            } else {
                console.log('[PlayerDashboard] No evaluation found for player');
            }

            // 1b. Fetch Training Streak from player_stats
            const { data: streakData, error: streakError } = await supabase
                .from('player_stats')
                .select('streak_days, training_minutes, weekly_minutes')
                .eq('player_id', playerId)
                .single();

            if (streakError && streakError.code !== 'PGRST116') {
                console.error('[PlayerDashboard] Streak fetch error:', streakError);
            }

            if (streakData) {
                console.log('[PlayerDashboard] Found streak data:', streakData);
                setStreakDays(streakData.streak_days || 0);
            }

            // 1c. Process any completed practices (auto-credit training from attended events)
            const { data: creditedCount, error: practiceError } = await supabase
                .rpc('process_completed_practices', { p_player_id: playerId });

            if (practiceError) {
                console.log('[PlayerDashboard] Practice processing not available yet:', practiceError.message);
            } else if (creditedCount > 0) {
                console.log('[PlayerDashboard] Credited', creditedCount, 'completed practices');
                // Refetch streak after crediting practices
                const { data: updatedStreak } = await supabase
                    .from('player_stats')
                    .select('streak_days')
                    .eq('player_id', playerId)
                    .single();
                if (updatedStreak) {
                    setStreakDays(updatedStreak.streak_days || 0);
                }
            }

            // 2. Fetch Assignments (use RPC for PIN login to bypass RLS)
            console.log('[PlayerDashboard] Fetching assignments for player_id:', playerId, 'isPinLogin:', isPinLogin);

            let assignData = null;
            let assignError = null;

            // Use RPC function to bypass RLS for PIN-logged players
            const { data: rpcData, error: rpcError } = await supabase
                .rpc('get_player_assignments', { target_player_id: playerId });

            if (rpcError) {
                console.error('[PlayerDashboard] RPC assignments fetch error:', rpcError);
                assignError = rpcError;
            } else {
                // Transform RPC result to match expected format
                assignData = (rpcData || []).map(row => ({
                    id: row.id,
                    status: row.status,
                    due_date: row.due_date,
                    custom_duration: row.custom_duration,
                    drill_id: row.drill_id,
                    drills: {
                        id: row.drill_id,
                        name: row.drill_name,
                        duration: row.drill_duration,
                        category: row.drill_category,
                        video_url: row.drill_video_url,
                        description: row.drill_description
                    }
                }));
                console.log('[PlayerDashboard] Assignments fetched via RPC:', assignData?.length || 0, 'assignments');
            }

            // Real data only - no mock fallbacks
            setAssignments(assignData || []);

            // 3. Fetch Badges - use player_user_id (auth.users UUID)
            // Fetch badge definitions first
            const { data: badgeDefs } = await supabase.from('badges').select('*');
            const badgeMap = {};
            (badgeDefs || []).forEach(b => { badgeMap[b.id] = b; });

            // Then fetch player's earned badges without FK join
            const { data: earnedBadgeData, error: badgeError } = await supabase
                .from('player_badges')
                .select('id, badge_id, awarded_at')
                .eq('player_user_id', user.id);

            if (badgeError) {
                console.error('Error fetching player badges:', badgeError);
            }

            // Join badge definitions in JavaScript
            const badgeData = (earnedBadgeData || []).map(pb => ({
                ...pb,
                badges: badgeMap[pb.badge_id] || null
            }));

            // Real data only - no mock fallbacks
            setEarnedBadges(badgeData);

            // Check for unseen badges (show celebration on login)
            const lastSeenKey = `badges_last_seen_${playerId}`;
            const lastSeenTimestamp = localStorage.getItem(lastSeenKey);
            const lastSeenDate = lastSeenTimestamp ? new Date(lastSeenTimestamp) : new Date(0);

            // Find badges awarded after last seen
            const unseenBadges = (badgeData || []).filter(pb => {
                const awardedAt = pb.awarded_at ? new Date(pb.awarded_at) : null;
                return awardedAt && awardedAt > lastSeenDate;
            });

            // Show celebration for the first unseen badge (queue system could be added for multiple)
            if (unseenBadges.length > 0 && unseenBadges[0].badges) {
                // Delay slightly to let the UI load first
                setTimeout(() => {
                    setNewBadge(unseenBadges[0].badges);
                    setShowBadgeCelebration(true);
                }, 1000);
            }

            // Update last seen timestamp
            localStorage.setItem(lastSeenKey, new Date().toISOString());
        };

        fetchDashboardData();

        // Subscribe to new badges in realtime
        const badgeChannel = supabase
            .channel('player-badges')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'player_badges',
                    filter: `player_user_id=eq.${user.id}`
                },
                async (payload) => {
                    console.log('New badge awarded!', payload);
                    // Fetch the badge details
                    const { data: badgeData } = await supabase
                        .from('badges')
                        .select('*')
                        .eq('id', payload.new.badge_id)
                        .single();

                    if (badgeData) {
                        setNewBadge(badgeData);
                        setShowBadgeCelebration(true);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(badgeChannel);
        };
    }, [user]);

    // Construct Profile Display Object (must be after hooks, before conditional returns)
    // Use playerRecord.id if available (this is the ID used in evaluations table)
    const playerProfile = {
        id: playerRecord?.id || user?.id, // Critical: use players table ID for evaluations
        name: playerRecord ? `${playerRecord.first_name} ${playerRecord.last_name}` : (profile?.full_name || user?.display_name || "Guest Player"),
        number: playerRecord?.jersey_number?.toString() || stats?.number || profile?.number || "??",
        position: playerRecord?.position || "MF",
        rating: stats?.overall_rating || 50,
        pace: stats?.pace || 50,
        shooting: stats?.shooting || 50,
        passing: stats?.passing || 50,
        dribbling: stats?.dribbling || 50,
        defending: stats?.defending || 50,
        physical: stats?.physical || 50,
        messiMode: stats?.messi_mode_unlocked || false,
        image: playerRecord?.avatar_url || profile?.avatar_url || user?.avatar_url || "/players/roster/bo_official.png"
    };

    // Loading state - shown while user or player data loads
    if (!user || playerLoading) {
        return (
            <div className="min-h-screen bg-brand-dark flex items-center justify-center text-white">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-brand-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-brand-green font-display uppercase tracking-widest">Loading Player Profile...</p>
                </div>
            </div>
        );
    }

    // Error state - player not found
    if (playerError) {
        return (
            <div className="min-h-screen bg-brand-dark flex items-center justify-center text-white p-4">
                <div className="text-center max-w-md">
                    <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6 border-2 border-red-500">
                        <AlertTriangle className="w-10 h-10 text-red-500" />
                    </div>
                    <h2 className="text-2xl font-display font-bold text-white mb-4">Player Not Found</h2>
                    <p className="text-gray-400 mb-6">{playerError}</p>
                    <div className="space-y-3">
                        <button
                            onClick={() => {
                                localStorage.removeItem('user');
                                signOut();
                                navigate('/login');
                            }}
                            className="w-full py-3 bg-brand-green text-brand-dark font-bold rounded-lg hover:bg-brand-green/90 transition-all"
                        >
                            Back to Login
                        </button>
                        <p className="text-xs text-gray-500">
                            Ask your parent to generate a new access link from their Fire FC dashboard.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const handleLogout = async () => {
        await signOut();
        navigate('/login');
    }

    const handleDrillComplete = async (drillOrId) => {
        // Handle both drill object and plain ID
        const assignmentId = typeof drillOrId === 'object' ? drillOrId.id : drillOrId;
        console.log("Completing Assignment:", assignmentId);

        // Optimistic update
        setAssignments(prev => prev.map(a =>
            a.id === assignmentId ? { ...a, status: 'completed' } : a
        ));

        // DB Update via RPC (bypasses RLS for PIN login)
        if (assignmentId && typeof assignmentId === 'string' && assignmentId.length > 20) {
            try {
                const playerId = playerRecord?.id || user.id;

                // Use RPC function to complete assignment and get updated streak
                const { data: result, error } = await supabase
                    .rpc('complete_assignment', {
                        p_assignment_id: assignmentId,
                        p_player_id: playerId
                    });

                if (error) {
                    console.error('Error completing assignment:', error);
                    // Fallback to direct update for non-PIN users
                    const { error: directError } = await supabase
                        .from('assignments')
                        .update({ status: 'completed', completed_at: new Date().toISOString() })
                        .eq('id', assignmentId);

                    if (directError) {
                        console.error('Direct update also failed:', directError);
                    }
                } else if (result && result[0]) {
                    console.log('Assignment completed!', result[0]);
                    if (result[0].success) {
                        setStreakDays(result[0].new_streak || 0);
                        console.log('[Streak] Updated to:', result[0].new_streak, 'Today mins:', result[0].today_minutes);
                    }
                }
                // Dispatch event to notify Leaderboard to refresh
                window.dispatchEvent(new CustomEvent('drill-completed'));
            } catch (err) {
                console.error('Error:', err);
            }
        }

        triggerMessiMode();
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 2000);
    }

    return (
        <div className="min-h-screen bg-brand-dark pb-24 relative overflow-hidden">
            {/* Badge Celebration */}
            {showBadgeCelebration && (
                <BadgeCelebration
                    badge={newBadge}
                    onClose={() => {
                        setShowBadgeCelebration(false);
                        setNewBadge(null);
                    }}
                />
            )}

            {/* Game Modal */}
            {showGame && <FireBall onClose={() => setShowGame(false)} currentPlayer={playerProfile} />}

            {/* Player Details Modal */}
            {showDetails && (
                <PlayerEvaluationModal
                    player={playerProfile}
                    onClose={() => setShowDetails(false)}
                    readOnly={true}
                />
            )}

            {/* Celebration Overlay */}
            {showCelebration && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none animate-bounce-in">
                    <h1 className="text-8xl md:text-9xl font-display font-black text-transparent bg-clip-text bg-gradient-to-b from-brand-gold to-yellow-600 drop-shadow-[0_0_50px_rgba(212,175,55,0.5)] italic uppercase tracking-tighter transform -rotate-6">
                        GOAL!
                    </h1>
                </div>
            )}

            {/* Background elements */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-green/5 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-brand-gold/5 rounded-full blur-[100px] pointer-events-none"></div>

            {/* Navbar */}
            <div className="sticky top-0 z-50 bg-brand-dark/95 backdrop-blur px-6 py-4 flex justify-between items-center border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center filter drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]">
                        <img src="/branding/logo.png" alt="RFC" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-white font-display uppercase font-bold tracking-widest text-sm md:text-base">Rockford Fire <span className="text-brand-gold">Player</span></span>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowGame(true)}
                        className="bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold uppercase text-xs px-4 py-2 rounded-full flex items-center gap-2 hover:scale-110 transition-all shadow-lg shadow-orange-500/30"
                    >
                        <Flame className="w-4 h-4" /> Fire Ball 🔥
                    </button>
                    <button onClick={handleLogout} className="text-gray-500 hover:text-white">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* Left Column: Player Card (Sticky on Desktop) */}
                <div className="md:col-span-5 lg:col-span-4 flex flex-col items-center">
                    <div className="sticky top-24 group">
                        <div className="absolute -top-6 text-brand-green text-xs font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity animate-pulse">
                            Click for Details
                        </div>
                        <PlayerCard
                            player={playerProfile}
                            onClick={() => setShowDetails(true)}
                        />

                        {/* Training Streak Widget */}
                        <div className="mt-8 w-full glass-panel p-4 border border-orange-500/20 bg-gradient-to-r from-orange-500/5 to-transparent">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-gray-400 text-xs uppercase font-bold flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-orange-500" /> Training Streak
                                </h4>
                                <span className="text-orange-500 text-xs font-bold">20+ min/day</span>
                            </div>

                            {/* Streak Display */}
                            <div className="flex items-center gap-3">
                                {/* Fire Icons for streak visualization */}
                                <div className="flex gap-1">
                                    {[...Array(Math.min(streakDays, 7))].map((_, i) => (
                                        <span key={i} className="text-2xl animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
                                            🔥
                                        </span>
                                    ))}
                                    {streakDays === 0 && (
                                        <span className="text-2xl opacity-30">🔥</span>
                                    )}
                                </div>

                                {/* Streak Count */}
                                <div className="flex flex-col">
                                    <span className="text-3xl font-black text-white leading-none">
                                        {streakDays}
                                    </span>
                                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                                        {streakDays === 1 ? 'day' : 'days'}
                                    </span>
                                </div>
                            </div>

                            {/* Motivational Message */}
                            <p className="text-xs text-gray-500 mt-2 italic">
                                {streakDays === 0 && "Train today to start your streak!"}
                                {streakDays >= 1 && streakDays < 3 && "Keep it going! 🔥"}
                                {streakDays >= 3 && streakDays < 7 && "You're on fire! Don't break the chain!"}
                                {streakDays >= 7 && "🏆 Legendary streak! Elite mindset!"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Column: Homework, Game, & Badges */}
                <div className="md:col-span-7 lg:col-span-8 space-y-8">
                    {/* Welcome Message */}
                    <div className="glass-panel p-6 border-l-4 border-brand-green bg-gradient-to-r from-brand-green/10 to-transparent">
                        <h2 className="text-2xl text-white font-display uppercase font-bold italic">
                            "Train like a champion today."
                        </h2>
                    </div>

                    {/* Trophy Case / Badges */}
                    <div className="glass-panel p-6 relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-xl text-white font-display uppercase font-bold mb-4 flex items-center gap-2">
                                <span className="text-2xl">🏆</span> Trophy Case
                            </h3>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                {Object.values(earnedBadges.reduce((acc, row) => {
                                    const b = row.badges;
                                    if (!b) return acc;
                                    if (!acc[b.id]) {
                                        acc[b.id] = { ...b, count: 0 };
                                    }
                                    acc[b.id].count += 1;
                                    return acc;
                                }, {})).map((badge) => (
                                    <div key={badge.id} className="aspect-square bg-white/5 border border-white/10 rounded-xl flex flex-col items-center justify-center relative group hover:bg-white/10 transition-colors cursor-help">
                                        <span className="text-3xl mb-1 filter drop-shadow hover:scale-110 transition-transform">{badge.icon}</span>
                                        <span className="text-[10px] text-gray-400 text-center font-bold px-1">{badge.name}</span>
                                        {badge.count > 1 && (
                                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-brand-gold text-brand-dark font-black text-xs rounded-full flex items-center justify-center border-2 border-[#1a1a1a] shadow-lg z-10">
                                                x{badge.count}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {earnedBadges.length === 0 && (
                                    <div className="col-span-full text-center text-gray-500 text-sm italic py-4">
                                        No trophies yet. Keep training!
                                    </div>
                                )}

                                {/* Empty Slots Filler */}
                                {[...Array(Math.max(0, 5 - earnedBadges.length))].map((_, i) => (
                                    <div key={`empty-${i}`} className="aspect-square bg-black/20 border border-dashed border-white/5 rounded-xl flex items-center justify-center opacity-50">
                                        <div className="w-8 h-8 rounded-full bg-white/5"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <HomeworkHub assignments={assignments} onComplete={handleDrillComplete} />

                    <Leaderboard />
                </div>
            </div>
        </div>
    );
};

export default PlayerDashboard;
