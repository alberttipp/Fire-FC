import React, { useState, useEffect } from 'react';
import PlayerCard from '../components/player/PlayerCard';
import HomeworkHub from '../components/player/HomeworkHub';
import { useAuth } from '../context/AuthContext';
import { LogOut, Menu, Gamepad2, Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { triggerMessiMode } from '../utils/messiMode';
import Leaderboard from '../components/player/Leaderboard';
import FireBall from '../game/FireBall';
import PlayerEvaluationModal from '../components/dashboard/PlayerEvaluationModal';

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

    useEffect(() => {
        if (!user?.id) return;

        const fetchDashboardData = async () => {
            // Check if user is "Virtual" (PIN Login) -> Use RPC
            // Standard users have 'aud' in user object usually, or we check AuthContext
            // Simple check: if user.role === 'player' and internal session is missing/different.
            // But easier: Just try RPC first? No, standard logic is fine for Real users.

            // If user is from PIN login, they are technically "anon".
            const isVirtualUser = user.email === 'player@firefc.com' && user.role === 'player';

            if (isVirtualUser) {
                console.log("Fetching Dashboard via RPC (Virtual User)...");
                try {
                    const { data, error } = await supabase.rpc('get_player_dashboard', {
                        target_player_id: user.id
                    });

                    if (error) throw error;
                    if (data) {
                        setStats(data.stats);
                        setAssignments(data.assignments);
                        setEarnedBadges(data.badges);
                    }
                } catch (err) {
                    console.error("RPC Dashboard Fetch Error:", err);
                }
                return;
            }

            // --- STANDARD FETCH (For Auth Users) ---

            // 0. Fetch Player Stats
            const { data: statsData } = await supabase
                .from('player_stats')
                .select('*')
                .eq('player_id', user.id)
                .single();
            if (statsData) setStats(statsData);

            // 1. Fetch Assignments
            const { data: assignData } = await supabase
                .from('assignments')
                .select(`
                    id, 
                    status, 
                    due_date, 
                    custom_duration, 
                    drills (
                        id, 
                        title, 
                        duration_minutes, 
                        skill, 
                        video_url, 
                        description
                    )
                `)
                .eq('player_id', user.id)
                .order('created_at', { ascending: false });

            if (assignData && assignData.length > 0) {
                setAssignments(assignData);
            } else {
                // Mock Assignments Fallback
                setAssignments([
                    { id: 'mock1', status: 'pending', drills: { title: 'Juggling Masterclass', duration_minutes: 15 } },
                    { id: 'mock2', status: 'completed', drills: { title: 'Cone Weave Sprint', duration_minutes: 20 } }
                ]);
            }

            // 2. Fetch Badges
            const { data: badgeData } = await supabase
                .from('player_badges')
                .select(`
                    id,
                    badges (
                        id,
                        name,
                        icon
                    )
                `)
                .eq('player_id', user.id);

            // Safe set (default to empty array)
            if (badgeData && badgeData.length > 0) {
                setEarnedBadges(badgeData);
            } else {
                // Mock Badges Fallback
                setEarnedBadges([
                    { id: 'b1', badges: { id: 1, name: 'First Goal', icon: '⚽' } },
                    { id: 'b2', badges: { id: 2, name: 'Speed Demon', icon: '⚡' } }
                ]);
            }
        };

        fetchDashboardData();
    }, [user]);

    // Construct Profile Display Object (must be after hooks, before conditional returns)
    const playerProfile = {
        id: user?.id,
        name: profile?.full_name || user?.display_name || "Guest Player",
        number: stats?.number || profile?.number || "??",
        position: "PL",
        rating: stats?.overall_rating || 80 + Math.floor((stats?.level || 1) * 2),
        pace: stats?.pace || 85,
        shooting: stats?.shooting || 80,
        passing: stats?.passing || 75,
        dribbling: stats?.dribbling || 82,
        defending: stats?.defending || 50,
        physical: stats?.physical || 70,
        messiMode: stats?.messi_mode_unlocked || false,
        image: profile?.avatar_url || user?.avatar_url || "/players/roster/bo_official.png"
    };

    // Loading state - shown while user data loads
    if (!user) {
        return (
            <div className="min-h-screen bg-brand-dark flex items-center justify-center text-white">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-brand-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-brand-green font-display uppercase tracking-widest">Loading Player Profile...</p>
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

        // DB Update - only for valid UUIDs
        if (assignmentId && typeof assignmentId === 'string' && assignmentId.length > 20) {
            try {
                const { error } = await supabase
                    .from('assignments')
                    .update({ status: 'completed', completed_at: new Date().toISOString() })
                    .eq('id', assignmentId);

                if (error) {
                    console.error('Error completing assignment:', error);
                } else {
                    console.log('Assignment completed successfully!');
                }
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
                    <div className="w-10 h-10 flex items-center justify-center filter drop-shadow-[0_0_8px_rgba(204,255,0,0.3)]">
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

                        {/* Weekly Progress Widget */}
                        <div className="mt-8 w-full glass-panel p-4">
                            <h4 className="text-gray-400 text-xs uppercase font-bold mb-2">Weekly Goal</h4>
                            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-brand-green w-[33%] shadow-[0_0_10px_#ccff00]"></div>
                            </div>
                            <div className="flex justify-between mt-1 text-xs text-white">
                                <span>1/3 Complete</span>
                                <span className="text-brand-gold">Level 5</span>
                            </div>
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
