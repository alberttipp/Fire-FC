import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, MessageSquare, CreditCard, LogOut, User, Loader2, Trophy, Clock, CheckCircle, AlertCircle, Link2, Copy, RefreshCw, QrCode } from 'lucide-react';
import { supabase } from '../supabaseClient';
import PlayerCard from '../components/player/PlayerCard';
import CalendarHub from '../components/dashboard/CalendarHub';
import ChatView from '../components/dashboard/ChatView';
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
    const [assignments, setAssignments] = useState([]);
    const [attendanceStats, setAttendanceStats] = useState({ attended: 0, missed: 0, rate: 0 });
    const [eventRsvps, setEventRsvps] = useState({}); // { eventId: 'going' | 'not_going' | 'maybe' }
    const [newBadge, setNewBadge] = useState(null);
    const [showBadgeCelebration, setShowBadgeCelebration] = useState(false);

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

    // Fetch selected child's details
    useEffect(() => {
        if (selectedChild?.id) {
            fetchChildDetails(selectedChild.id);
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
                }
            }
        } catch (err) {
            console.error('Error fetching children:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchChildDetails = async (playerId) => {
        try {
            // Fetch player stats (training minutes, streak, etc.)
            const { data: stats } = await supabase
                .from('player_stats')
                .select('*')
                .eq('player_id', playerId)
                .single();

            setPlayerStats(stats);

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

            // Fetch assignments
            const { data: assigns } = await supabase
                .from('assignments')
                .select(`
                    *,
                    drills:drill_id (title, skill, duration_minutes)
                `)
                .eq('player_id', playerId)
                .order('created_at', { ascending: false })
                .limit(5);

            setAssignments(assigns || []);

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
            case 'billing':
                return (
                    <div className="glass-panel p-8 max-w-2xl mx-auto text-center space-y-6">
                        <div className="w-16 h-16 bg-brand-green/10 rounded-full flex items-center justify-center mx-auto">
                            <CreditCard className="w-8 h-8 text-brand-green" />
                        </div>
                        <h2 className="text-2xl text-white font-display uppercase">Billing Center</h2>
                        <div className="bg-white/5 p-6 rounded-xl border border-white/10 text-left">
                            <h3 className="text-gray-400 text-xs uppercase font-bold mb-4">Current Balance</h3>
                            <div className="flex justify-between items-end">
                                <span className="text-4xl text-white font-mono">$0.00</span>
                                <span className="text-brand-green text-xs font-bold uppercase py-1 px-2 bg-brand-green/10 rounded">Paid in Full</span>
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm">No upcoming invoices.</p>
                    </div>
                );
            case 'overview':
            default:
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Left Column - Player Card */}
                        <div className="space-y-6">
                            <h3 className="text-xl text-white font-display uppercase tracking-wider flex items-center gap-2">
                                <User className="w-5 h-5 text-brand-gold" /> Player Profile
                            </h3>

                            {/* Child selector if multiple children */}
                            {children.length > 1 && (
                                <div className="flex gap-2 mb-4">
                                    {children.map(child => (
                                        <button
                                            key={child.id}
                                            onClick={() => setSelectedChild(child)}
                                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                                selectedChild?.id === child.id
                                                    ? 'bg-brand-green text-brand-dark'
                                                    : 'bg-white/10 text-gray-400 hover:bg-white/20'
                                            }`}
                                        >
                                            {child.first_name}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="transform scale-90 origin-top-left sm:scale-100 group cursor-pointer relative" onClick={() => setShowDetails(true)}>
                                <div className="absolute -top-6 left-0 w-full text-center text-brand-green text-xs font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity animate-pulse">
                                    Click for Report Card
                                </div>
                                <PlayerCard player={formatPlayerForCard(selectedChild)} onClick={() => setShowDetails(true)} />
                            </div>

                            {/* Recent Badges */}
                            {playerBadges.length > 0 && (
                                <div className="glass-panel p-4">
                                    <h4 className="text-gray-400 text-xs uppercase font-bold mb-3 flex items-center gap-2">
                                        <Trophy className="w-4 h-4 text-brand-gold" /> Recent Badges
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {playerBadges.map(pb => (
                                            <div
                                                key={pb.id}
                                                className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg"
                                                title={pb.badges?.description}
                                            >
                                                <span className="text-xl">{pb.badges?.icon}</span>
                                                <span className="text-xs text-white font-medium">{pb.badges?.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Player Access Link */}
                            <div className="glass-panel p-4 border-l-4 border-l-brand-gold">
                                <h4 className="text-brand-gold text-xs uppercase font-bold mb-3 flex items-center gap-2">
                                    <Link2 className="w-4 h-4" /> Player Access Link
                                </h4>
                                <p className="text-gray-400 text-xs mb-3">
                                    Share this link with {selectedChild?.first_name} so they can access their player dashboard without a PIN.
                                </p>

                                {!playerAccessLink ? (
                                    <button
                                        onClick={generatePlayerLink}
                                        disabled={generatingLink}
                                        className="w-full py-3 bg-brand-gold/20 hover:bg-brand-gold/30 border border-brand-gold/50 rounded-lg text-brand-gold font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {generatingLink ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <Link2 className="w-4 h-4" />
                                                Generate Access Link
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="bg-black/30 rounded-lg p-3 border border-white/10">
                                            <p className="text-xs text-gray-400 font-mono break-all">{playerAccessLink}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={copyLink}
                                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                                                    linkCopied
                                                        ? 'bg-green-500 text-white'
                                                        : 'bg-white/10 hover:bg-white/20 text-white'
                                                }`}
                                            >
                                                {linkCopied ? (
                                                    <>
                                                        <CheckCircle className="w-4 h-4" />
                                                        Copied!
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="w-4 h-4" />
                                                        Copy Link
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                onClick={generatePlayerLink}
                                                className="py-2 px-3 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all"
                                                title="Generate new link"
                                            >
                                                <RefreshCw className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-gray-500 text-center">
                                            This link never expires. Generate a new one to revoke the old link.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column - Stats & Info */}
                        <div className="space-y-6">
                            {/* Attendance Stats */}
                            <div className="glass-panel p-6">
                                <h3 className="text-gray-400 text-xs uppercase font-bold mb-4">Attendance Rate</h3>
                                <div className="flex items-center gap-4">
                                    <div className="relative w-24 h-24">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-800" />
                                            <circle
                                                cx="48" cy="48" r="40"
                                                stroke="currentColor"
                                                strokeWidth="8"
                                                fill="transparent"
                                                strokeDasharray="251.2"
                                                strokeDashoffset={251.2 - (251.2 * attendanceStats.rate / 100)}
                                                className="text-brand-green"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center text-white font-bold">{attendanceStats.rate}%</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-sm text-white">{attendanceStats.attended} Practices Attended</div>
                                        <div className="text-sm text-gray-500">{attendanceStats.missed} Missed</div>
                                    </div>
                                </div>
                            </div>

                            {/* Player Stats Summary */}
                            {playerStats && (
                                <div className="glass-panel p-6">
                                    <h3 className="text-gray-400 text-xs uppercase font-bold mb-4">Season Stats</h3>
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div>
                                            <div className="text-2xl text-white font-bold">{playerStats.games_played || 0}</div>
                                            <div className="text-xs text-gray-500">Games</div>
                                        </div>
                                        <div>
                                            <div className="text-2xl text-brand-green font-bold">{playerStats.goals || 0}</div>
                                            <div className="text-xs text-gray-500">Goals</div>
                                        </div>
                                        <div>
                                            <div className="text-2xl text-blue-400 font-bold">{playerStats.assists || 0}</div>
                                            <div className="text-xs text-gray-500">Assists</div>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                                        <span className="text-xs text-gray-500">XP Level</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-brand-gold rounded-full"
                                                    style={{ width: `${Math.min(100, (playerStats.xp || 0) % 1000 / 10)}%` }}
                                                />
                                            </div>
                                            <span className="text-brand-gold font-bold">Lv {playerStats.level || 1}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Upcoming Events */}
                            {upcomingEvents.length > 0 && (
                                <div className="glass-panel p-6">
                                    <h3 className="text-gray-400 text-xs uppercase font-bold mb-4 flex items-center gap-2">
                                        <Calendar className="w-4 h-4" /> Upcoming Events
                                    </h3>
                                    <div className="space-y-3">
                                        {upcomingEvents.slice(0, 3).map(event => {
                                            const date = new Date(event.start_time);
                                            const currentRsvp = eventRsvps[event.id];
                                            return (
                                                <div key={event.id} className="p-3 bg-white/5 rounded-lg space-y-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                                            event.type === 'game' ? 'bg-red-500/20 text-red-400' :
                                                            event.type === 'practice' ? 'bg-brand-green/20 text-brand-green' :
                                                            'bg-blue-500/20 text-blue-400'
                                                        }`}>
                                                            <span className="text-xs font-bold uppercase">{date.getDate()}</span>
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="text-sm text-white font-medium">{event.title}</div>
                                                            <div className="text-xs text-gray-500">
                                                                {date.toLocaleDateString('en-US', { weekday: 'short' })} at {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                                            </div>
                                                        </div>
                                                        {event.kit_color && (
                                                            <span className="text-xs text-gray-400 px-2 py-1 bg-white/10 rounded">
                                                                {event.kit_color}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {/* RSVP Buttons */}
                                                    <div className="flex gap-2 pl-13">
                                                        <button
                                                            onClick={() => handleRsvp(event.id, 'going')}
                                                            className={`flex-1 py-1.5 text-xs font-bold rounded transition-all ${
                                                                currentRsvp === 'going'
                                                                    ? 'bg-green-500 text-white'
                                                                    : 'bg-green-500/20 text-green-400 hover:bg-green-500/40'
                                                            }`}
                                                        >
                                                            ✓ Going
                                                        </button>
                                                        <button
                                                            onClick={() => handleRsvp(event.id, 'maybe')}
                                                            className={`flex-1 py-1.5 text-xs font-bold rounded transition-all ${
                                                                currentRsvp === 'maybe'
                                                                    ? 'bg-yellow-500 text-white'
                                                                    : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/40'
                                                            }`}
                                                        >
                                                            ? Maybe
                                                        </button>
                                                        <button
                                                            onClick={() => handleRsvp(event.id, 'not_going')}
                                                            className={`flex-1 py-1.5 text-xs font-bold rounded transition-all ${
                                                                currentRsvp === 'not_going'
                                                                    ? 'bg-red-500 text-white'
                                                                    : 'bg-red-500/20 text-red-400 hover:bg-red-500/40'
                                                            }`}
                                                        >
                                                            ✗ Can't Go
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <button
                                        onClick={() => setCurrentView('schedule')}
                                        className="w-full mt-3 text-xs text-gray-400 hover:text-white transition-colors"
                                    >
                                        View Full Schedule
                                    </button>
                                </div>
                            )}

                            {/* Homework/Assignments */}
                            {assignments.length > 0 && (
                                <div className="glass-panel p-6 border-l-4 border-l-brand-gold">
                                    <h3 className="text-brand-gold text-xs uppercase font-bold mb-3 flex items-center gap-2">
                                        <Clock className="w-4 h-4" /> Training Homework
                                    </h3>
                                    <div className="space-y-2">
                                        {assignments.slice(0, 3).map(assign => (
                                            <div key={assign.id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                                                <div>
                                                    <div className="text-sm text-white">{assign.drills?.title}</div>
                                                    <div className="text-xs text-gray-500">{assign.drills?.skill} - {assign.drills?.duration_minutes} min</div>
                                                </div>
                                                {assign.status === 'completed' ? (
                                                    <CheckCircle className="w-5 h-5 text-brand-green" />
                                                ) : (
                                                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
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
                            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
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

                        <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 transition-colors">
                            <LogOut className="w-5 h-5" />
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
