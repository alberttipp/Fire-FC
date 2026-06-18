import React, { useState, useEffect, Suspense, lazy } from 'react';
import PlayerCard from '../components/player/PlayerCard';
import CardCustomizeModal from '../components/player/CardCustomizeModal';
import HeroModeModal from '../components/player/HeroModeModal';
import HeroProgress from '../components/player/HeroProgress';
import { DEFAULT_CARD_COUNTRY } from '../constants/cardCountries';
import HomeworkHub from '../components/player/HomeworkHub';
import { useAuth } from '../context/AuthContext';
import { LogOut, Flame, Zap, AlertTriangle, Dumbbell, ChevronRight } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { triggerMessiMode } from '../utils/messiMode';
import Leaderboard from '../components/player/Leaderboard';
import TrainingStatsCard from '../components/player/TrainingStatsCard';
import FireBall from '../game/FireBall';
import BadgeCelebration from '../components/BadgeCelebration';
import BadgeUnlockBanner from '../components/BadgeUnlockBanner';
import PreviewBanner from '../components/PreviewBanner';
import PlayerIDPCard from '../components/player/PlayerIDPCard';
import DevelopmentPassportCard from '../components/player/DevelopmentPassportCard';
import PersonalPlanCard from '../components/player/PersonalPlanCard';
import JuggleChallengeCard from '../components/player/JuggleChallengeCard';
import SupportTeamCard from '../components/SupportTeamCard';
import TeamCelebrationBanner from '../components/TeamCelebrationBanner';
import TeamGoalBar from '../components/TeamGoalBar';
import useBackGuard from '../hooks/useBackGuard';
import { getPlayerAvatarPath } from '../utils/playerAvatar';

// Heavy modals — only loaded when the user opens them.
const PlayerEvaluationModal = lazy(() => import('../components/dashboard/PlayerEvaluationModal'));
const ParentSessionBuilder = lazy(() => import('../components/dashboard/ParentSessionBuilder'));

import { supabase } from '../supabaseClient';

const PlayerDashboard = () => {
    const { user, profile, signOut } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const previewPlayerId = searchParams.get('preview');
    const isPreview = Boolean(previewPlayerId);

    // ALL HOOKS MUST BE DECLARED BEFORE ANY CONDITIONAL RETURNS
    const [showCelebration, setShowCelebration] = useState(false);
    const [showGame, setShowGame] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [assignments, setAssignments] = useState([]);
    const [earnedBadges, setEarnedBadges] = useState([]);
    const [stats, setStats] = useState(null);
    const [newBadge, setNewBadge] = useState(null);
    const [showBadgeCelebration, setShowBadgeCelebration] = useState(false);
    // Badges where seen_at IS NULL — kid hasn't tapped the banner yet.
    // Each entry: { id (player_badges row id), badge_id, awarded_at, badges (joined definition) }
    const [unseenBadges, setUnseenBadges] = useState([]);
    const [playerRecord, setPlayerRecord] = useState(null); // The player's record from players table
    const [streakDays, setStreakDays] = useState(0); // Training streak (days in a row with 20+ min training)
    const [playerStatsFull, setPlayerStatsFull] = useState(null); // Full player_stats row for TrainingStatsCard
    const [playerError, setPlayerError] = useState(null); // Error if player not found
    const [playerLoading, setPlayerLoading] = useState(true); // Loading state for player lookup
    const [customizeOpen, setCustomizeOpen] = useState(false);
    const [heroOpen, setHeroOpen] = useState(false);
    const [heroRefresh, setHeroRefresh] = useState(0);
    const [showSessionBuilder, setShowSessionBuilder] = useState(false);

    // Phone back button → close the topmost open modal instead of leaving the
    // app (and never to login).
    useBackGuard(() => {
        if (showSessionBuilder) { setShowSessionBuilder(false); return true; }
        if (showDetails) { setShowDetails(false); return true; }
        if (showGame) { setShowGame(false); return true; }
        if (showBadgeCelebration) { setShowBadgeCelebration(false); return true; }
        if (showCelebration) { setShowCelebration(false); return true; }
        return false;
    });

    // Refetch just the assignments row — used after Solo Training Builder save.
    const refetchAssignments = async () => {
        const playerId = playerRecord?.id;
        if (!playerId) return;
        const { data, error } = await supabase
            .from('assignments')
            .select('*, drills:drill_id (id, name, duration, category, video_url, description)')
            .eq('player_id', playerId)
            .in('source', ['coach', 'parent', 'player'])
            .order('due_date', { ascending: true });
        if (error) {
            console.error('[PlayerDashboard] refetchAssignments error:', error);
            return;
        }
        setAssignments(data || []);
    };

    const refetchPlayerStats = async (playerId) => {
        if (!playerId) return;

        const { data: statsData, error } = await supabase
            .from('player_stats')
            .select('streak_days, training_minutes, weekly_minutes, season_minutes, yearly_minutes, weekly_touches, season_touches, yearly_touches, career_touches')
            .eq('player_id', playerId)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') {
            console.error('[PlayerDashboard] refetchPlayerStats error:', error);
            return;
        }

        if (statsData) {
            setStreakDays(statsData.streak_days || 0);
            setPlayerStatsFull(statsData);
        }
    };

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

            // Preview mode (coach/manager previewing player view): pull the
            // requested player by id directly. RLS already grants staff
            // access to all players on their team.
            if (isPreview && previewPlayerId) {
                const { data, error } = await supabase
                    .from('players')
                    .select('*')
                    .eq('id', previewPlayerId)
                    .maybeSingle();
                if (error) console.error('[PlayerDashboard] preview lookup failed:', error);
                playerData = data;
            } else if (isPinLogin) {
                // PIN login: user.id IS the players table ID
                console.log('[PlayerDashboard] PIN login detected - querying by players.id');
                const { data, error } = await supabase
                    .from('players')
                    .select('*')
                    .eq('id', user.id)
                    .maybeSingle();

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
                    .maybeSingle();

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
                .maybeSingle();

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
            await refetchPlayerStats(playerId);

            // 1c. Process any completed practices (auto-credit training from attended events)
            const { data: creditedCount, error: practiceError } = await supabase
                .rpc('process_completed_practices', { p_player_id: playerId });

            if (practiceError) {
                console.log('[PlayerDashboard] Practice processing not available yet:', practiceError.message);
            } else if (creditedCount > 0) {
                console.log('[PlayerDashboard] Credited', creditedCount, 'completed practices');
                // Refetch full stats after crediting practices so the
                // minutes/touches cards update immediately.
                await refetchPlayerStats(playerId);
            }

            // 2. Fetch ALL assignments for this player (coach + parent + self).
            // Filter: pending/in_progress always visible; completed rows only
            // if completed THIS WEEK. Older completions stay in the DB
            // (career stats already credited at completion), but don't clutter
            // the kid's dashboard. Matches the cron's ISO week boundary.
            const weekStart = new Date();
            const dayOfWeek = weekStart.getDay(); // 0=Sun
            const daysFromMonday = (dayOfWeek + 6) % 7; // Mon-anchored
            weekStart.setDate(weekStart.getDate() - daysFromMonday);
            weekStart.setHours(0, 0, 0, 0);
            const weekStartIso = weekStart.toISOString();

            console.log('[PlayerDashboard] Fetching assignments for player_id:', playerId, 'week start:', weekStartIso);
            const { data: assignData, error: assignErr } = await supabase
                .from('assignments')
                .select('*, drills:drill_id (id, name, duration, category, video_url, description)')
                .eq('player_id', playerId)
                .in('source', ['coach', 'parent', 'player'])
                .or(`status.neq.completed,completed_at.gte.${weekStartIso}`)
                .order('due_date', { ascending: true });

            if (assignErr) {
                console.error('[PlayerDashboard] Assignments fetch error:', assignErr);
            } else {
                console.log('[PlayerDashboard] Assignments fetched:', assignData?.length || 0);
            }

            setAssignments(assignData || []);

            // 3. Fetch Badges - use player_user_id (auth.users UUID)
            // Fetch badge definitions first
            const { data: badgeDefs } = await supabase.from('badges').select('*');
            const badgeMap = {};
            (badgeDefs || []).forEach(b => { badgeMap[b.id] = b; });

            // Then fetch player's earned badges. seen_at separates "claim me!"
            // banner badges from already-celebrated ones.
            const { data: earnedBadgeData, error: badgeError } = await supabase
                .from('player_badges')
                .select('id, badge_id, awarded_at, seen_at')
                .eq('player_user_id', user.id);

            if (badgeError) {
                console.error('Error fetching player badges:', badgeError);
            }

            // Join badge definitions in JavaScript
            const badgeData = (earnedBadgeData || []).map(pb => ({
                ...pb,
                badges: badgeMap[pb.badge_id] || null
            }));

            // All earned badges (for the trophy case display)
            setEarnedBadges(badgeData);

            // Unseen subset (banner). DB-backed via seen_at IS NULL — works
            // across devices/sessions, and parents can't accidentally
            // consume the kid's celebration moment by being on the dashboard
            // first.
            const unseen = badgeData.filter(pb => pb.seen_at == null && pb.badges);
            setUnseenBadges(unseen);
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
                        .maybeSingle();

                    if (badgeData) {
                        // Add to the banner queue. The kid taps the banner
                        // when they're ready; we DON'T auto-open the
                        // celebration because a parent watching the screen
                        // might dismiss it before the kid sees.
                        setUnseenBadges(prev => [...prev, {
                            id: payload.new.id,
                            badge_id: payload.new.badge_id,
                            awarded_at: payload.new.awarded_at,
                            seen_at: null,
                            badges: badgeData,
                        }]);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(badgeChannel);
        };
    }, [user]);

    useEffect(() => {
        const playerId = playerRecord?.id;
        if (!playerId) return;

        const assignmentsChannel = supabase
            .channel(`player-assignments-${playerId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'assignments',
                    filter: `player_id=eq.${playerId}`,
                },
                () => {
                    refetchAssignments();
                    refetchPlayerStats(playerId);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(assignmentsChannel);
        };
    }, [playerRecord?.id]);

    useEffect(() => {
        const handleDrillCompleted = () => {
            const playerId = playerRecord?.id;
            if (!playerId) return;
            refetchAssignments();
            refetchPlayerStats(playerId);
        };

        window.addEventListener('drill-completed', handleDrillCompleted);
        return () => window.removeEventListener('drill-completed', handleDrillCompleted);
    }, [playerRecord?.id]);

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
        heroMode: playerRecord?.hero_mode || null,
        country: playerRecord?.card_country || DEFAULT_CARD_COUNTRY,
        image: getPlayerAvatarPath({
            avatarUrl: playerRecord?.avatar_url || profile?.avatar_url || user?.avatar_url || null,
            firstName: playerRecord?.first_name || profile?.full_name || '',
            lastName: playerRecord?.last_name || '',
            displayName: playerRecord ? `${playerRecord.first_name || ''} ${playerRecord.last_name || ''}`.trim() : (profile?.full_name || user?.display_name || '')
        })
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

    // Kid taps the banner — claim the first unseen badge: open the
    // celebration AND mark the row seen in the DB so the banner doesn't
    // re-appear on next login or another device.
    const handleClaimBadge = async () => {
        const next = unseenBadges[0];
        if (!next) return;
        // Optimistic: drop it from the banner queue immediately
        setUnseenBadges(prev => prev.slice(1));
        // Open celebration
        setNewBadge(next.badges);
        setShowBadgeCelebration(true);
        // Persist seen_at so it doesn't reappear
        const { error } = await supabase
            .from('player_badges')
            .update({ seen_at: new Date().toISOString() })
            .eq('id', next.id);
        if (error) {
            console.error('Failed to mark badge seen:', error);
            // Best-effort; if this fails, kid sees the banner again next
            // load. Not blocking the celebration.
        }
    };

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
                await refetchPlayerStats(playerId);
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

    const personalPlanAssignments = assignments.filter(a => !a.team_id && a.source !== 'parent' && a.source !== 'player');
    const challengeAssignments = assignments.filter(a => a.team_id || a.source === 'parent' || a.source === 'player');

    return (
        <div className="min-h-screen bg-brand-dark pb-24 relative overflow-hidden">
            <PreviewBanner
                isPreview={isPreview}
                role="player"
                playerName={playerRecord?.first_name || playerRecord?.display_name}
            />
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
                <Suspense fallback={null}>
                    <PlayerEvaluationModal
                        player={playerProfile}
                        onClose={() => setShowDetails(false)}
                        readOnly={true}
                    />
                </Suspense>
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
                    <button onClick={handleLogout} className="flex items-center gap-1.5 text-gray-400 hover:text-red-400 transition-colors px-2 py-1.5 rounded hover:bg-red-500/10" title="Logout">
                        <LogOut className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Logout</span>
                    </button>
                </div>
            </div>

            {/* Persistent banner for unseen badges. Kid taps to claim and
                trigger the full BadgeCelebration. Stays across page refreshes
                and devices because seen_at lives in the DB. */}
            {unseenBadges.length > 0 && (
                <div className="max-w-5xl mx-auto px-4 pt-4">
                    <BadgeUnlockBanner
                        count={unseenBadges.length}
                        badge={unseenBadges[0]?.badges}
                        onClaim={handleClaimBadge}
                    />
                </div>
            )}

            <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* Left Column: Player Card (Sticky on Desktop) */}
                <div className="md:col-span-5 lg:col-span-4 flex flex-col items-center">
                    <div className="sticky top-24">
                        {/* Wrapper matches ParentDashboard so the player card
                            sits in the same max-w-xl container (visually
                            wider, not squeezed by the narrow column) AND a
                            single tap opens the report-card modal — was
                            tap-to-flip + tap-to-open before, which made
                            getting to the back take two clicks. Same UX
                            albert sees in his parent login now. */}
                        <div
                            className="group cursor-pointer relative max-w-xl mx-auto"
                            onClick={() => setShowDetails(true)}
                        >
                            <div className="absolute -top-5 left-0 w-full text-center text-brand-green text-xs font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                Tap for Report Card
                            </div>
                            <PlayerCard
                                player={playerProfile}
                                onClick={() => setShowDetails(true)}
                            />
                        </div>
                        {playerRecord?.id && (
                            <div className="text-center -mt-2 flex items-center justify-center gap-4">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setCustomizeOpen(true); }}
                                    className="text-xs text-gray-400 hover:text-brand-gold font-bold uppercase tracking-wider transition-colors"
                                >
                                    🏳️ Card flag
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setHeroOpen(true); }}
                                    className="text-xs text-gray-400 hover:text-brand-gold font-bold uppercase tracking-wider transition-colors"
                                >
                                    ✨ Hero Mode
                                </button>
                            </div>
                        )}
                        {playerRecord?.id && <HeroProgress playerId={playerRecord.id} refreshKey={heroRefresh} />}
                        {heroOpen && playerRecord?.id && (
                            <HeroModeModal
                                playerId={playerRecord.id}
                                playerName={playerRecord.first_name || ''}
                                onSaved={(mode) => { setPlayerRecord(prev => prev ? { ...prev, hero_mode: mode } : prev); setHeroRefresh(n => n + 1); }}
                                onClose={() => setHeroOpen(false)}
                            />
                        )}
                        {customizeOpen && playerRecord?.id && (
                            <CardCustomizeModal
                                playerId={playerRecord.id}
                                playerName={playerRecord.first_name || ''}
                                current={playerRecord.card_country || DEFAULT_CARD_COUNTRY}
                                onSaved={(code) => setPlayerRecord(prev => prev ? { ...prev, card_country: code } : prev)}
                                onClose={() => setCustomizeOpen(false)}
                            />
                        )}

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
                                    <span className="text-xs text-gray-400 uppercase tracking-wider">
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

                {/* Right Column: Challenges, Game, & Badges */}
                <div className="md:col-span-7 lg:col-span-8 space-y-8">
                    {/* Welcome Message */}
                    <div className="glass-panel p-6 border-l-4 border-brand-green bg-gradient-to-r from-brand-green/10 to-transparent">
                        <h2 className="text-2xl text-white font-display uppercase font-bold italic">
                            "Train like a champion today."
                        </h2>
                    </div>

                    {/* IDP Card — sits below the motivational banner */}
                    {playerRecord?.id && (
                        <PlayerIDPCard
                            playerId={playerRecord.id}
                            teamId={playerRecord.team_id || null}
                            playerName={`${playerRecord.first_name || ''} ${playerRecord.last_name || ''}`.trim()}
                            onStartSoloDrill={(drillIds) => {
                                // drillIds can be a single uuid or a comma-separated list
                                // for multi-select. Either way: write to URL, open the
                                // solo builder which reads ?drillIds= on mount.
                                const url = new URL(window.location.href);
                                url.searchParams.set('drillIds', drillIds);
                                url.searchParams.set('from', 'idp');
                                window.history.replaceState({}, '', url);
                                setShowSessionBuilder(true);
                            }}
                        />
                    )}

                    <DevelopmentPassportCard
                        badges={earnedBadges}
                        stats={playerStatsFull}
                        playerName={`${playerRecord?.first_name || ''} ${playerRecord?.last_name || ''}`.trim()}
                    />

                    <PersonalPlanCard assignments={personalPlanAssignments} onComplete={handleDrillComplete} />

                    <HomeworkHub assignments={challengeAssignments} onComplete={handleDrillComplete} />

                    {playerRecord?.team_id && <TeamCelebrationBanner teamId={playerRecord.team_id} />}
                    {playerRecord?.team_id && <TeamGoalBar teamId={playerRecord.team_id} />}

                    {playerRecord?.id && (
                        <JuggleChallengeCard
                            playerId={playerRecord.id}
                            teamId={playerRecord.team_id || null}
                            playerName={playerRecord.first_name}
                        />
                    )}

                    {/* Support / sponsor — opens the hosted Zeffy form (815YouthSports 501c3). */}
                    <SupportTeamCard />

                    {/* Solo Training Builder — kids build their own practice */}
                    <button
                        onClick={() => setShowSessionBuilder(true)}
                        className="w-full glass-panel p-4 flex items-center gap-3 hover:border-brand-green/50 transition-all group"
                    >
                        <div className="w-12 h-12 rounded-lg bg-brand-green/10 flex items-center justify-center shrink-0 group-hover:bg-brand-green/20 transition-colors">
                            <Dumbbell className="w-6 h-6 text-brand-green" />
                        </div>
                        <div className="text-left flex-1">
                            <div className="text-white font-bold">Solo Training Builder</div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider">Build your own practice — counts toward your stats</div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-brand-green transition-colors" />
                    </button>

                    <Leaderboard />

                    {/* Training stats — same component the parent dashboard uses.
                        Single source of truth from player_stats. */}
                    <TrainingStatsCard stats={playerStatsFull} />
                </div>
            </div>

            {/* Solo Training Builder modal */}
            {showSessionBuilder && playerRecord && (
                <Suspense fallback={null}>
                    <ParentSessionBuilder
                        saveMode="player"
                        onClose={() => setShowSessionBuilder(false)}
                        onSave={() => {
                            // Refetch the assignments list immediately so the
                            // newly-saved drills show up in HomeworkHub without
                            // a page reload. Also dispatch the drill-completed
                            // event so Leaderboard refreshes.
                            refetchAssignments();
                            window.dispatchEvent(new CustomEvent('drill-completed'));
                        }}
                        playerId={playerRecord.id}
                        teamId={playerRecord.team_id}
                        playerName={playerRecord.first_name}
                    />
                </Suspense>
            )}
        </div>
    );
};

export default PlayerDashboard;
