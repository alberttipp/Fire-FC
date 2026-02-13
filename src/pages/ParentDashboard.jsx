import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, MessageSquare, CreditCard, LogOut, User, Loader2, Trophy, Clock, CheckCircle, AlertCircle, Link2, Copy, RefreshCw, QrCode, Camera, Tv, Car, Dumbbell, Target, Zap, ChevronRight } from 'lucide-react';
import { supabase } from '../supabaseClient';
import PlayerCard from '../components/player/PlayerCard';
import Leaderboard from '../components/player/Leaderboard';
import CalendarHub from '../components/dashboard/CalendarHub';
import ChatView from '../components/dashboard/ChatView';
import GalleryView from '../components/dashboard/GalleryView';
import LiveScoringView from '../components/dashboard/LiveScoringView';
import CarpoolVolunteerView from '../components/dashboard/CarpoolVolunteerView';
import DrillLibraryModal from '../components/dashboard/DrillLibraryModal';
import ParentSessionBuilder from '../components/dashboard/ParentSessionBuilder';
import PlayerEvaluationModal from '../components/dashboard/PlayerEvaluationModal';
import GuardianCodeEntry from '../components/dashboard/GuardianCodeEntry';
import BadgeCelebration from '../components/BadgeCelebration';

const ParentDashboard = () => {
    const { user, profile, signOut } = useAuth();
    const navigate = useNavigate();
    const [currentView, setCurrentView] = useState('overview');
    const [showDetails, setShowDetails] = useState(false);
    const [loading, setLoading] = useState(true);

    // Real data state
    const [children, setChildren] = useState([]);
    const [selectedChild, setSelectedChild] = useState(null);
    const [playerStats, setPlayerStats] = useState(null);
    const [playerEvaluation, setPlayerEvaluation] = useState(null); // Coach ratings from evaluations table
    const [playerBadges, setPlayerBadges] = useState([]);
    const [upcomingEvents, setUpcomingEvents] = useState([]);
    const [coachAssignments, setCoachAssignments] = useState([]);
    const [parentAssignments, setParentAssignments] = useState([]);
    const [attendanceStats, setAttendanceStats] = useState({ attended: 0, missed: 0, rate: 0 });
    const [eventRsvps, setEventRsvps] = useState({}); // { eventId: 'going' | 'not_going' | 'maybe' }
    const [newBadge, setNewBadge] = useState(null);
    const [showBadgeCelebration, setShowBadgeCelebration] = useState(false);

    // Practice minutes state
    const [practiceMins, setPracticeMins] = useState({ team: 0, solo: 0, weekly: 0, season: 0, yearly: 0, career: 0 });
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [showDrillLibrary, setShowDrillLibrary] = useState(false);
    const [showSessionBuilder, setShowSessionBuilder] = useState(false);

    // Player access link state
    const [playerAccessLink, setPlayerAccessLink] = useState(null);
    const [generatingLink, setGeneratingLink] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

    // Fetch children linked to parent
    useEffect(() => {
        if (user?.id) {
            fetchChildrenData();
        }
    }, [user?.id]);

    // Fetch selected child's details when child changes
    // Also refetch when selecting a different child
    useEffect(() => {
        if (selectedChild?.id) {
            // Set loading while fetching child details (including evaluation)
            setLoading(true);
            fetchChildDetails(selectedChild.id).finally(() => {
                setLoading(false);
            });
        }
    }, [selectedChild?.id]);

    const fetchChildrenData = async () => {
        setLoading(true);
        try {
            // Get linked children via family_members table
            const { data: links } = await supabase
                .from('family_members')
                .select('player_id')
                .eq('user_id', user.id)
                .in('relationship', ['guardian', 'fan']);

            let playerIds = links?.map(l => l.player_id) || [];

            if (playerIds.length > 0) {
                // Fetch full player data
                const { data: players } = await supabase
                    .from('players')
                    .select(`
                        *,
                        teams:team_id (name, age_group)
                    `)
                    .in('id', playerIds);

                if (players && players.length > 0) {
                    setChildren(players);
                    setSelectedChild(players[0]);
                    // Don't set loading=false here - the selectedChild useEffect will handle it
                    // after fetching child details including evaluation
                    return;
                }
            }
            // Only set loading=false if no children found (nothing more to load)
            setLoading(false);
        } catch (err) {
            console.error('Error fetching children:', err);
            setLoading(false);
        }
    };

    const fetchChildDetails = async (playerId) => {
        // Clear previous child's data first to avoid showing stale data
        setPlayerEvaluation(null);
        setPlayerStats(null);
        setPlayerBadges([]);
        setPracticeMins({ team: 0, solo: 0, weekly: 0, season: 0, yearly: 0, career: 0 });

        try {
            // Fetch player stats (training minutes, streak, etc.)
            const { data: stats } = await supabase
                .from('player_stats')
                .select('*')
                .eq('player_id', playerId)
                .single();

            setPlayerStats(stats);

            // Training minutes from player_stats at all time levels
            const soloMins = stats?.training_minutes || 0;
            const weeklyMins = stats?.weekly_minutes || 0;
            const seasonMins = stats?.season_minutes || 0;
            const yearlyMins = stats?.yearly_minutes || 0;

            // Fetch player evaluation (coach ratings - same as PlayerDashboard)
            console.log('[ParentDashboard] Fetching evaluation for player_id:', playerId);
            const { data: evalData, error: evalError } = await supabase
                .from('evaluations')
                .select('*')
                .eq('player_id', playerId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            console.log('[ParentDashboard] Evaluation result:', evalData, 'Error:', evalError);

            if (evalError && evalError.code !== 'PGRST116') {
                console.error('[ParentDashboard] Evaluation fetch error:', evalError);
            }
            setPlayerEvaluation(evalData || null);

            // Fetch badges - use player_user_id (auth.users UUID linked to this player)
            // Fetch without FK join to avoid 406 errors, then join with badge definitions
            const playerUserId = selectedChild?.user_id || playerId;

            // First, get all badge definitions
            const { data: badgeDefs } = await supabase.from('badges').select('*');
            const badgeMap = {};
            (badgeDefs || []).forEach(b => { badgeMap[b.id] = b; });

            // Then get player's earned badges
            const { data: earnedBadges, error: badgeError } = await supabase
                .from('player_badges')
                .select('*')
                .eq('player_user_id', playerUserId)
                .order('awarded_at', { ascending: false })
                .limit(5);

            if (badgeError) {
                console.error('Error fetching player badges:', badgeError);
            }

            // Join badge definitions in JavaScript
            const badges = (earnedBadges || []).map(pb => ({
                ...pb,
                badges: badgeMap[pb.badge_id] || null
            }));

            setPlayerBadges(badges);

            // Check for unseen badges (show celebration on login)
            const lastSeenKey = `parent_badges_last_seen_${playerUserId}`;
            const lastSeenTimestamp = localStorage.getItem(lastSeenKey);
            const lastSeenDate = lastSeenTimestamp ? new Date(lastSeenTimestamp) : new Date(0);

            // Find badges awarded after last seen
            const unseenBadges = (badges || []).filter(pb => {
                const awardedAt = pb.awarded_at ? new Date(pb.awarded_at) : null;
                return awardedAt && awardedAt > lastSeenDate;
            });

            // Show celebration for the first unseen badge
            if (unseenBadges.length > 0 && unseenBadges[0].badges) {
                setTimeout(() => {
                    setNewBadge(unseenBadges[0].badges);
                    setShowBadgeCelebration(true);
                }, 1000);
            }

            // Update last seen timestamp
            localStorage.setItem(lastSeenKey, new Date().toISOString());

            // Fetch upcoming events
            const teamId = selectedChild?.team_id;
            if (teamId) {
                const { data: events } = await supabase
                    .from('events')
                    .select('*')
                    .eq('team_id', teamId)
                    .gte('start_time', new Date().toISOString())
                    .order('start_time', { ascending: true })
                    .limit(5);

                setUpcomingEvents(events || []);
            }

            // Fetch coach assignments (read-only for parent)
            const { data: coachAssigns } = await supabase
                .from('assignments')
                .select('*, drills:drill_id (name, title, skill, category, duration_minutes, duration)')
                .eq('player_id', playerId)
                .eq('source', 'coach')
                .order('created_at', { ascending: false })
                .limit(10);

            setCoachAssignments(coachAssigns || []);

            // Fetch parent assignments (completable by parent)
            const { data: parentAssigns } = await supabase
                .from('assignments')
                .select('*, drills:drill_id (name, title, skill, category, duration_minutes, duration)')
                .eq('player_id', playerId)
                .eq('source', 'parent')
                .eq('assigned_by', user.id)
                .order('created_at', { ascending: false })
                .limit(10);

            setParentAssignments(parentAssigns || []);

            // Calculate attendance from real RSVP data
            if (teamId) {
                const { data: rsvpData } = await supabase
                    .from('event_rsvps')
                    .select('status')
                    .eq('player_id', playerId);

                if (rsvpData && rsvpData.length > 0) {
                    const attended = rsvpData.filter(r => r.status === 'going' || r.status === 'attended').length;
                    const missed = rsvpData.filter(r => r.status === 'not_going' || r.status === 'missed').length;
                    const total = attended + missed;
                    const rate = total > 0 ? Math.round((attended / total) * 100) : 0;
                    setAttendanceStats({ attended, missed, rate });
                } else {
                    // No RSVP data yet - show zeros
                    setAttendanceStats({ attended: 0, missed: 0, rate: 0 });
                }
            } else {
                setAttendanceStats({ attended: 0, missed: 0, rate: 0 });
            }

            // Calculate team practice minutes from attended practice events
            if (teamId) {
                const { data: attendedEvents } = await supabase
                    .from('event_rsvps')
                    .select('event_id')
                    .eq('player_id', playerId)
                    .in('status', ['going', 'attended']);

                let teamMins = 0;
                if (attendedEvents && attendedEvents.length > 0) {
                    const eventIds = attendedEvents.map(e => e.event_id);
                    const { data: practiceEvents } = await supabase
                        .from('events')
                        .select('start_time, end_time')
                        .in('id', eventIds)
                        .eq('type', 'practice');

                    if (practiceEvents) {
                        teamMins = practiceEvents.reduce((sum, ev) => {
                            if (ev.start_time && ev.end_time) {
                                const dur = Math.round((new Date(ev.end_time) - new Date(ev.start_time)) / 60000);
                                return sum + (dur > 0 ? dur : 90);
                            }
                            return sum + 90; // default 90 min practice
                        }, 0);
                    }
                }
                setPracticeMins({ team: teamMins, solo: soloMins, weekly: weeklyMins, season: seasonMins, yearly: yearlyMins, career: soloMins });
            } else {
                setPracticeMins({ team: 0, solo: soloMins, weekly: weeklyMins, season: seasonMins, yearly: yearlyMins, career: soloMins });
            }

        } catch (err) {
            console.error('Error fetching child details:', err);
        }
    };

    const handleLogout = async () => {
        await signOut();
        navigate('/login');
    };

    // Generate player access link
    const generatePlayerLink = async () => {
        if (!selectedChild?.id) return;

        setGeneratingLink(true);
        setPlayerAccessLink(null);

        try {
            const { data, error } = await supabase.rpc('generate_player_access_token', {
                p_player_id: selectedChild.id,
                p_expires_hours: null // Never expires
            });

            if (error) throw error;

            if (data && data.length > 0) {
                const token = data[0].token;
                const link = `${window.location.origin}/player-access/${token}`;
                setPlayerAccessLink(link);
            }
        } catch (err) {
            console.error('Error generating link:', err);
            alert('Failed to generate access link. Please try again.');
        } finally {
            setGeneratingLink(false);
        }
    };

    // Copy link to clipboard
    const copyLink = async () => {
        if (!playerAccessLink) return;

        try {
            await navigator.clipboard.writeText(playerAccessLink);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = playerAccessLink;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        }
    };

    // Handle RSVP for events
    const handleRsvp = async (eventId, status) => {
        if (!selectedChild?.id) return;

        // Optimistic update
        setEventRsvps(prev => ({ ...prev, [eventId]: status }));

        try {
            // Upsert RSVP
            const { error } = await supabase
                .from('event_rsvps')
                .upsert({
                    event_id: eventId,
                    player_id: selectedChild.id,
                    status: status,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'event_id,player_id'
                });

            if (error) {
                console.error('Error saving RSVP:', error);
                // Revert on error
                setEventRsvps(prev => {
                    const copy = { ...prev };
                    delete copy[eventId];
                    return copy;
                });
            }
        } catch (err) {
            console.error('RSVP Error:', err);
        }
    };

    // Handle completing a parent-assigned drill
    const handleCompleteParentDrill = async (assignmentId) => {
        if (!selectedChild?.id) return;

        // Check if coach homework is done first
        const pendingCoach = coachAssignments.filter(a => a.status !== 'completed');
        if (pendingCoach.length > 0) {
            alert('Complete coach homework first before marking parent practice drills as done!');
            return;
        }

        // Optimistic update
        setParentAssignments(prev => prev.map(a =>
            a.id === assignmentId ? { ...a, status: 'completed', completed_at: new Date().toISOString() } : a
        ));

        try {
            const { data: result, error } = await supabase
                .rpc('complete_assignment', {
                    p_assignment_id: assignmentId,
                    p_player_id: selectedChild.id
                });

            if (error) {
                console.error('Error completing parent assignment:', error);
                // Fallback direct update
                await supabase
                    .from('assignments')
                    .update({ status: 'completed', completed_at: new Date().toISOString() })
                    .eq('id', assignmentId);
            }

            // Dispatch event for Leaderboard refresh
            window.dispatchEvent(new CustomEvent('drill-completed'));
        } catch (err) {
            console.error('Error:', err);
            // Revert optimistic update
            setParentAssignments(prev => prev.map(a =>
                a.id === assignmentId ? { ...a, status: 'pending', completed_at: null } : a
            ));
        }
    };

    // Format player data for PlayerCard component
    // Uses playerEvaluation from evaluations table (same as PlayerDashboard)
    const formatPlayerForCard = (player) => {
        if (!player) return null;

        console.log('[ParentDashboard] formatPlayerForCard - playerEvaluation:', playerEvaluation);

        // Calculate overall from evaluation if available
        const overallRating = playerEvaluation
            ? Math.round((playerEvaluation.pace + playerEvaluation.shooting + playerEvaluation.passing + playerEvaluation.dribbling + playerEvaluation.defending + playerEvaluation.physical) / 6)
            : null;

        return {
            id: player.id, // players table ID - for fetching evaluations
            user_id: player.user_id, // auth.users ID - for RLS policies (badges)
            name: `${player.first_name} ${player.last_name}`,
            number: player.jersey_number?.toString() || '0',
            position: player.position || 'MF',
            rating: overallRating || playerEvaluation?.overall_rating || 50,
            pace: playerEvaluation?.pace || 50,
            shooting: playerEvaluation?.shooting || 50,
            passing: playerEvaluation?.passing || 50,
            dribbling: playerEvaluation?.dribbling || 50,
            defending: playerEvaluation?.defending || 50,
            physical: playerEvaluation?.physical || 50,
            messiMode: playerStats?.messi_mode_unlocked || false,
            image: player.avatar_url || `/players/${player.first_name?.toLowerCase()}_official.png`
        };
    };

    const renderView = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-green mx-auto mb-2" />
                        <p className="text-gray-400">Loading player data...</p>
                    </div>
                </div>
            );
        }

        if (!selectedChild) {
            return (
                <div className="max-w-md mx-auto">
                    <GuardianCodeEntry
                        onSuccess={() => {
                            fetchChildrenData();
                        }}
                    />
                </div>
            );
        }

        switch (currentView) {
            case 'schedule':
                return <CalendarHub />;
            case 'messages':
                return <ChatView />;
            case 'gallery':
                return <GalleryView />;
            case 'live':
                return <LiveScoringView />;
            case 'carpool':
                return <CarpoolVolunteerView />;
            case 'billing':
                return (
                    <div className="glass-panel p-8 max-w-2xl mx-auto text-center space-y-6">
                        <div className="w-16 h-16 bg-brand-green/10 rounded-full flex items-center justify-center mx-auto">
                            <CreditCard className="w-8 h-8 text-brand-green" />
                        </div>
                        <h2 className="text-2xl text-white font-display uppercase">Billing Center</h2>
                        <p className="text-gray-400">Coming Soon</p>
                        <p className="text-gray-500 text-sm max-w-md mx-auto">
                            Online payment and invoicing is on the way. You'll be able to view balances, pay fees, and track payment history here.
                        </p>
                        <p className="text-gray-600 text-xs">Stay tuned!</p>
                    </div>
                );
            case 'overview':
            default: {
                const completedCoach = coachAssignments.filter(a => a.status === 'completed').length;
                const totalCoach = coachAssignments.length;
                const homeworkPercent = totalCoach > 0 ? Math.round((completedCoach / totalCoach) * 100) : 0;
                const coachHomeworkDone = totalCoach === 0 || completedCoach === totalCoach;
                const completedParent = parentAssignments.filter(a => a.status === 'completed').length;
                const totalParent = parentAssignments.length;
                const totalMins = practiceMins.team + practiceMins.solo;

                return (
                    <div className="space-y-6">
                        {/* Child selector if multiple children */}
                        {children.length > 1 && (
                            <div className="flex gap-2">
                                {children.map(child => (
                                    <button
                                        key={child.id}
                                        onClick={() => setSelectedChild(child)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                            selectedChild?.id === child.id
                                                ? 'bg-blue-600 text-white shadow-lg'
                                                : 'bg-white/10 text-gray-400 hover:bg-white/20'
                                        }`}
                                    >
                                        {child.first_name}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Top Row: Player Card + Stats Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* Player Card */}
                            <div className="lg:col-span-5">
                                <div className="group cursor-pointer relative" onClick={() => setShowDetails(true)}>
                                    <div className="absolute -top-5 left-0 w-full text-center text-brand-green text-xs font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                        Tap for Report Card
                                    </div>
                                    <PlayerCard player={formatPlayerForCard(selectedChild)} onClick={() => setShowDetails(true)} />
                                </div>
                            </div>

                            {/* Stats Dashboard */}
                            <div className="lg:col-span-7 grid grid-cols-2 gap-4">
                                {/* Homework Progress */}
                                <div className="glass-panel p-5 flex flex-col">
                                    <h4 className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-3 flex items-center gap-1.5">
                                        <Target className="w-3.5 h-3.5 text-brand-gold" /> Homework
                                    </h4>
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="relative w-16 h-16 shrink-0">
                                            <svg className="w-full h-full transform -rotate-90">
                                                <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-gray-800" />
                                                <circle
                                                    cx="32" cy="32" r="26"
                                                    stroke="currentColor"
                                                    strokeWidth="6"
                                                    fill="transparent"
                                                    strokeDasharray="163.4"
                                                    strokeDashoffset={163.4 - (163.4 * homeworkPercent / 100)}
                                                    strokeLinecap="round"
                                                    className={homeworkPercent === 100 ? 'text-brand-green' : 'text-brand-gold'}
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-white font-bold text-sm">{homeworkPercent}%</span>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-2xl text-white font-bold leading-none">
                                                {completedCoach}<span className="text-gray-500 text-lg">/{totalCoach}</span>
                                            </div>
                                            <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">
                                                {coachHomeworkDone && totalCoach > 0 ? 'All Done!' : 'Coach Drills'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Attendance */}
                                <div className="glass-panel p-5 flex flex-col">
                                    <h4 className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-3 flex items-center gap-1.5">
                                        <CheckCircle className="w-3.5 h-3.5 text-brand-green" /> Attendance
                                    </h4>
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="relative w-16 h-16 shrink-0">
                                            <svg className="w-full h-full transform -rotate-90">
                                                <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-gray-800" />
                                                <circle
                                                    cx="32" cy="32" r="26"
                                                    stroke="currentColor"
                                                    strokeWidth="6"
                                                    fill="transparent"
                                                    strokeDasharray="163.4"
                                                    strokeDashoffset={163.4 - (163.4 * attendanceStats.rate / 100)}
                                                    strokeLinecap="round"
                                                    className="text-brand-green"
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-white font-bold text-sm">{attendanceStats.rate}%</span>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-2xl text-white font-bold leading-none">{attendanceStats.attended}</div>
                                            <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Sessions</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Training Minutes Breakdown */}
                                <div className="glass-panel p-5 col-span-2">
                                    <h4 className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-3 flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-blue-400" /> Training Minutes
                                    </h4>
                                    <div className="grid grid-cols-4 gap-3 mb-4">
                                        <div className="text-center">
                                            <div className="text-xl text-blue-400 font-bold font-display">{practiceMins.weekly}</div>
                                            <div className="text-xs text-gray-500 uppercase tracking-wider">This Week</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-xl text-brand-green font-bold font-display">{practiceMins.season}</div>
                                            <div className="text-xs text-gray-500 uppercase tracking-wider">Season</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-xl text-brand-gold font-bold font-display">{practiceMins.yearly}</div>
                                            <div className="text-xs text-gray-500 uppercase tracking-wider">Year</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-xl text-white font-bold font-display">{practiceMins.career}</div>
                                            <div className="text-xs text-gray-500 uppercase tracking-wider">Career</div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs text-gray-400 uppercase tracking-wider">Team Practice</span>
                                                <span className="text-xs text-white font-bold">{practiceMins.team} min</span>
                                            </div>
                                            <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-brand-green rounded-full transition-all duration-500"
                                                    style={{ width: totalMins > 0 ? `${(practiceMins.team / totalMins) * 100}%` : '0%' }}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs text-gray-400 uppercase tracking-wider">Solo Practice</span>
                                                <span className="text-xs text-white font-bold">{practiceMins.solo} min</span>
                                            </div>
                                            <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-brand-gold rounded-full transition-all duration-500"
                                                    style={{ width: totalMins > 0 ? `${(practiceMins.solo / totalMins) * 100}%` : '0%' }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setShowLeaderboard(!showLeaderboard)}
                                className="glass-panel p-4 flex items-center gap-3 hover:border-brand-gold/50 transition-all group"
                            >
                                <div className="w-10 h-10 rounded-lg bg-brand-gold/10 flex items-center justify-center shrink-0 group-hover:bg-brand-gold/20 transition-colors">
                                    <Trophy className="w-5 h-5 text-brand-gold" />
                                </div>
                                <div className="text-left flex-1">
                                    <div className="text-white font-bold text-sm">Leaderboard</div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wider">See team rankings</div>
                                </div>
                                <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${showLeaderboard ? 'rotate-90' : ''}`} />
                            </button>

                            <button
                                onClick={() => setShowSessionBuilder(true)}
                                className="glass-panel p-4 flex items-center gap-3 hover:border-brand-green/50 transition-all group"
                            >
                                <div className="w-10 h-10 rounded-lg bg-brand-green/10 flex items-center justify-center shrink-0 group-hover:bg-brand-green/20 transition-colors">
                                    <Dumbbell className="w-5 h-5 text-brand-green" />
                                </div>
                                <div className="text-left flex-1">
                                    <div className="text-white font-bold text-sm">Solo Training Builder</div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wider">Build & assign practice</div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>

                        {/* Leaderboard (collapsible) */}
                        {showLeaderboard && (
                            <div className="animate-fade-in-up">
                                <Leaderboard />
                            </div>
                        )}

                        {/* Bottom Grid: Homework Detail + Events + Badges */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Coach Homework (read-only) + Parent Practice (completable) */}
                            <div className="space-y-4">
                                {/* Coach Homework */}
                                <div className="glass-panel p-5 border-l-4 border-l-blue-500">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-blue-400 text-xs uppercase font-bold flex items-center gap-2">
                                            <Target className="w-4 h-4" /> Coach Homework
                                        </h4>
                                        {totalCoach > 0 && (
                                            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                                                coachHomeworkDone ? 'bg-brand-green/20 text-brand-green' : 'bg-blue-500/20 text-blue-400'
                                            }`}>
                                                {completedCoach}/{totalCoach} Done
                                            </span>
                                        )}
                                    </div>
                                    {coachAssignments.length === 0 ? (
                                        <div className="text-center py-4">
                                            <Target className="w-6 h-6 text-gray-700 mx-auto mb-1" />
                                            <p className="text-gray-500 text-xs">No coach homework this week</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {coachAssignments.map(assign => (
                                                <div key={assign.id} className={`flex items-center gap-3 p-2.5 rounded-lg transition-all ${assign.status === 'completed' ? 'bg-brand-green/5' : 'bg-white/5'}`}>
                                                    {assign.status === 'completed' ? (
                                                        <CheckCircle className="w-5 h-5 text-brand-green shrink-0" />
                                                    ) : (
                                                        <div className="w-5 h-5 rounded-full border-2 border-blue-500/50 shrink-0" />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <div className={`text-sm font-medium truncate ${assign.status === 'completed' ? 'text-gray-400 line-through' : 'text-white'}`}>
                                                            {assign.drills?.name || assign.drills?.title || 'Drill'}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {assign.drills?.category || assign.drills?.skill || ''} {assign.drills?.duration_minutes || assign.drills?.duration ? `- ${assign.drills?.duration_minutes || assign.drills?.duration} min` : ''}
                                                        </div>
                                                    </div>
                                                    {assign.status !== 'completed' && assign.due_date && (() => {
                                                        const days = Math.ceil((new Date(assign.due_date) - new Date()) / 86400000);
                                                        if (days < 0) return <span className="text-xs text-red-400 font-bold shrink-0">Overdue</span>;
                                                        if (days === 0) return <span className="text-xs text-blue-400 font-bold shrink-0">Today</span>;
                                                        return <span className="text-xs text-gray-500 shrink-0">{days}d left</span>;
                                                    })()}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Parent Practice */}
                                <div className="glass-panel p-5 border-l-4 border-l-brand-gold">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-brand-gold text-xs uppercase font-bold flex items-center gap-2">
                                            <Zap className="w-4 h-4" /> Parent Solo Practice
                                        </h4>
                                        {totalParent > 0 && (
                                            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                                                completedParent === totalParent ? 'bg-brand-green/20 text-brand-green' : 'bg-brand-gold/20 text-brand-gold'
                                            }`}>
                                                {completedParent}/{totalParent} Done
                                            </span>
                                        )}
                                    </div>

                                    {/* Coach homework gate */}
                                    {!coachHomeworkDone && totalParent > 0 && (
                                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg mb-3 flex items-start gap-2">
                                            <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                                            <p className="text-xs text-yellow-400">Complete coach homework first to unlock parent practice credit!</p>
                                        </div>
                                    )}

                                    {parentAssignments.length === 0 ? (
                                        <div className="text-center py-4">
                                            <Dumbbell className="w-6 h-6 text-gray-700 mx-auto mb-1" />
                                            <p className="text-gray-500 text-xs">No parent practice assigned</p>
                                            <button
                                                onClick={() => setShowSessionBuilder(true)}
                                                className="mt-2 text-xs text-brand-green hover:underline"
                                            >
                                                Build a Session
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {parentAssignments.map(assign => (
                                                <div key={assign.id} className={`flex items-center gap-3 p-2.5 rounded-lg transition-all ${assign.status === 'completed' ? 'bg-brand-green/5' : 'bg-white/5'}`}>
                                                    {assign.status === 'completed' ? (
                                                        <CheckCircle className="w-5 h-5 text-brand-green shrink-0" />
                                                    ) : (
                                                        <button
                                                            onClick={() => handleCompleteParentDrill(assign.id)}
                                                            className="w-5 h-5 rounded-full border-2 border-brand-gold/50 shrink-0 hover:bg-brand-gold/20 transition-colors cursor-pointer"
                                                            title={coachHomeworkDone ? 'Mark as done' : 'Complete coach homework first'}
                                                        />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <div className={`text-sm font-medium truncate ${assign.status === 'completed' ? 'text-gray-400 line-through' : 'text-white'}`}>
                                                            {assign.drills?.name || assign.drills?.title || 'Drill'}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {assign.drills?.category || assign.drills?.skill || ''} {assign.drills?.duration_minutes || assign.drills?.duration ? `- ${assign.drills?.duration_minutes || assign.drills?.duration} min` : ''}
                                                        </div>
                                                    </div>
                                                    {assign.status !== 'completed' && assign.due_date && (() => {
                                                        const days = Math.ceil((new Date(assign.due_date) - new Date()) / 86400000);
                                                        if (days < 0) return <span className="text-xs text-red-400 font-bold shrink-0">Overdue</span>;
                                                        if (days === 0) return <span className="text-xs text-brand-gold font-bold shrink-0">Today</span>;
                                                        return <span className="text-xs text-gray-500 shrink-0">{days}d left</span>;
                                                    })()}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right: Events + Badges + Access Link */}
                            <div className="space-y-6">
                                {/* Upcoming Events */}
                                <div className="glass-panel p-5">
                                    <h4 className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-3 flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5" /> Upcoming Events
                                    </h4>
                                    {upcomingEvents.length === 0 ? (
                                        <p className="text-gray-500 text-sm text-center py-4">No upcoming events</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {upcomingEvents.slice(0, 3).map(event => {
                                                const date = new Date(event.start_time);
                                                const currentRsvp = eventRsvps[event.id];
                                                return (
                                                    <div key={event.id} className="p-3 bg-white/5 rounded-lg space-y-2">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center ${
                                                                event.type === 'game' ? 'bg-red-500/20 text-red-400' :
                                                                event.type === 'practice' ? 'bg-brand-green/20 text-brand-green' :
                                                                'bg-blue-500/20 text-blue-400'
                                                            }`}>
                                                                <span className="text-xs font-bold uppercase leading-none">{date.toLocaleDateString('en-US', { month: 'short' })}</span>
                                                                <span className="text-sm font-bold leading-none">{date.getDate()}</span>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm text-white font-medium truncate">{event.title}</div>
                                                                <div className="text-xs text-gray-500">
                                                                    {date.toLocaleDateString('en-US', { weekday: 'short' })} at {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            {['going', 'maybe', 'not_going'].map(status => (
                                                                <button
                                                                    key={status}
                                                                    onClick={() => handleRsvp(event.id, status)}
                                                                    className={`flex-1 py-1.5 text-xs font-bold rounded transition-all ${
                                                                        currentRsvp === status
                                                                            ? status === 'going' ? 'bg-green-500 text-white' : status === 'maybe' ? 'bg-yellow-500 text-white' : 'bg-red-500 text-white'
                                                                            : status === 'going' ? 'bg-green-500/20 text-green-400 hover:bg-green-500/40' : status === 'maybe' ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/40' : 'bg-red-500/20 text-red-400 hover:bg-red-500/40'
                                                                    }`}
                                                                >
                                                                    {status === 'going' ? 'Going' : status === 'maybe' ? 'Maybe' : "Can't Go"}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <button
                                                onClick={() => setCurrentView('schedule')}
                                                className="w-full text-xs text-gray-400 hover:text-white transition-colors mt-1"
                                            >
                                                View Full Schedule
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Recent Badges */}
                                {playerBadges.length > 0 && (
                                    <div className="glass-panel p-5">
                                        <h4 className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-3 flex items-center gap-1.5">
                                            <Trophy className="w-3.5 h-3.5 text-brand-gold" /> Recent Badges
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {playerBadges.map(pb => (
                                                <div
                                                    key={pb.id}
                                                    className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg"
                                                    title={pb.badges?.description}
                                                >
                                                    <span className="text-lg">{pb.badges?.icon}</span>
                                                    <span className="text-xs text-white font-medium">{pb.badges?.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Player Access Link */}
                                <div className="glass-panel p-4 border-l-4 border-l-brand-gold">
                                    <h4 className="text-brand-gold text-xs uppercase font-bold mb-2 flex items-center gap-1.5">
                                        <Link2 className="w-3.5 h-3.5" /> Player Access Link
                                    </h4>
                                    <p className="text-gray-400 text-xs mb-3">
                                        Share with {selectedChild?.first_name} to access their player dashboard.
                                    </p>
                                    {!playerAccessLink ? (
                                        <button
                                            onClick={generatePlayerLink}
                                            disabled={generatingLink}
                                            className="w-full py-2.5 bg-brand-gold/20 hover:bg-brand-gold/30 border border-brand-gold/50 rounded-lg text-brand-gold font-bold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {generatingLink ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</> : <><Link2 className="w-3.5 h-3.5" /> Generate Access Link</>}
                                        </button>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="bg-black/30 rounded-lg p-2 border border-white/10">
                                                <p className="text-xs text-gray-400 font-mono break-all">{playerAccessLink}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={copyLink}
                                                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${linkCopied ? 'bg-green-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                                                >
                                                    {linkCopied ? <><CheckCircle className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy Link</>}
                                                </button>
                                                <button onClick={generatePlayerLink} className="py-2 px-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all" title="Generate new link">
                                                    <RefreshCw className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }
        }
    };

    return (
        <div className="min-h-screen bg-brand-dark pb-20">
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

            {/* Drill Library Modal */}
            {showDrillLibrary && selectedChild && (
                <DrillLibraryModal
                    onClose={() => {
                        setShowDrillLibrary(false);
                        if (selectedChild?.id) fetchChildDetails(selectedChild.id);
                    }}
                    player={selectedChild}
                    teamId={selectedChild?.team_id}
                />
            )}

            {/* Parent Session Builder */}
            {showSessionBuilder && selectedChild && (
                <ParentSessionBuilder
                    onClose={() => {
                        setShowSessionBuilder(false);
                        if (selectedChild?.id) fetchChildDetails(selectedChild.id);
                    }}
                    onSave={() => {
                        if (selectedChild?.id) fetchChildDetails(selectedChild.id);
                    }}
                    playerId={selectedChild.id}
                    teamId={selectedChild?.team_id}
                    playerName={selectedChild.first_name}
                />
            )}

            {/* Navbar */}
            <div className="sticky top-0 z-50 bg-brand-dark/95 backdrop-blur border-b border-white/10 px-6 py-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 flex items-center justify-center filter drop-shadow-md">
                            <img src="/branding/logo.png" alt="Rockford Fire FC" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <h1 className="text-xl text-white font-display uppercase font-bold tracking-wider leading-none">
                                Rockford Fire <span className="text-blue-500">Family</span>
                            </h1>
                            <span className="text-xs text-gray-500 uppercase tracking-widest font-bold">
                                {selectedChild ? `${selectedChild.first_name}'s Dashboard` : 'Fire FC App'}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden md:flex bg-white/5 rounded-lg p-1 border border-white/10">
                            {[
                                { id: 'overview', label: 'Overview', icon: LayoutDashboard },
                                { id: 'schedule', label: 'Schedule', icon: Calendar },
                                { id: 'messages', label: 'Messages', icon: MessageSquare },
                                { id: 'gallery', label: 'Gallery', icon: Camera },
                                { id: 'live', label: 'Live', icon: Tv },
                                { id: 'carpool', label: 'Carpool', icon: Car },
                                { id: 'billing', label: 'Billing', icon: CreditCard },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setCurrentView(tab.id)}
                                    className={`px-4 py-1.5 rounded-md text-sm font-display uppercase tracking-wider transition-all flex items-center gap-2 ${currentView === tab.id
                                        ? 'bg-blue-600 text-white font-bold shadow-lg'
                                        : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    <tab.icon className="w-3 h-3" /> {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Mobile nav */}
                        <div className="md:hidden flex gap-2">
                            {[
                                { id: 'overview', icon: LayoutDashboard },
                                { id: 'schedule', icon: Calendar },
                                { id: 'messages', icon: MessageSquare },
                                { id: 'gallery', icon: Camera },
                                { id: 'live', icon: Tv },
                                { id: 'carpool', icon: Car },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setCurrentView(tab.id)}
                                    className={`p-2 rounded-lg ${currentView === tab.id ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                                >
                                    <tab.icon className="w-5 h-5" />
                                </button>
                            ))}
                        </div>

                        <button onClick={handleLogout} className="flex items-center gap-1.5 text-gray-400 hover:text-red-400 transition-colors px-2 py-1.5 rounded hover:bg-red-500/10" title="Logout">
                            <LogOut className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Player Details Modal */}
            {showDetails && selectedChild && (
                <PlayerEvaluationModal
                    player={formatPlayerForCard(selectedChild)}
                    onClose={() => setShowDetails(false)}
                    readOnly={true}
                />
            )}

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                {renderView()}
            </main>
        </div>
    );
};

export default ParentDashboard;
