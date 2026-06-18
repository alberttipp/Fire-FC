import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVoiceCommand } from '../context/VoiceCommandContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LayoutDashboard, Calendar, MessageSquare, CreditCard, LogOut, User, Loader2, Clock, CheckCircle, AlertCircle, Link2, Copy, RefreshCw, QrCode, Camera, Tv, Car, Dumbbell, Target, Zap, ChevronRight, FileText, Plane, Bell, Trophy } from 'lucide-react';
import LiveGameBanner from '../components/dashboard/LiveGameBanner';
import { supabase } from '../supabaseClient';
import PlayerCard from '../components/player/PlayerCard';
import CardCustomizeModal from '../components/player/CardCustomizeModal';
import HeroModeModal from '../components/player/HeroModeModal';
import HeroProgress from '../components/player/HeroProgress';
import PhotoUploadButton from '../components/player/PhotoUploadButton';
import { DEFAULT_CARD_COUNTRY } from '../constants/cardCountries';
import Leaderboard from '../components/player/Leaderboard';
import GuardianCodeEntry from '../components/dashboard/GuardianCodeEntry';
import { useToast } from '../components/Toast';
import PreviewBanner from '../components/PreviewBanner';
import PlayerIDPCard from '../components/player/PlayerIDPCard';
import FamilyInviteModal from '../components/dashboard/FamilyInviteModal';
import MobileBottomNav from '../components/MobileBottomNav';
import { upsertRsvpForMany, namesList, statusLabel } from '../utils/rsvp';
import VacationPeriodsManager from '../components/family/VacationPeriodsManager';
import PrivateTrainingBadge from '../components/family/PrivateTrainingBadge';
import DevelopmentPassportCard from '../components/player/DevelopmentPassportCard';
import PersonalPlanCard from '../components/player/PersonalPlanCard';
import JuggleChallengeCard from '../components/player/JuggleChallengeCard';
import SupportTeamCard from '../components/SupportTeamCard';
import TeamCelebrationBanner from '../components/TeamCelebrationBanner';
import TeamGoalBar from '../components/TeamGoalBar';
import useBackGuard from '../hooks/useBackGuard';
import { getPlayerAvatarPath } from '../utils/playerAvatar';

// Lazy-load tab views and heavy modals so the parent dashboard's first
// paint is small. Same chunks are shared with /dashboard.
const CalendarHub = lazy(() => import('../components/dashboard/CalendarHub'));
const ChatView = lazy(() => import('../components/dashboard/ChatView'));
const GalleryView = lazy(() => import('../components/dashboard/GalleryView'));
const LiveScoringView = lazy(() => import('../components/dashboard/LiveScoringView'));
const CarpoolVolunteerView = lazy(() => import('../components/dashboard/CarpoolVolunteerView'));
const DrillLibraryModal = lazy(() => import('../components/dashboard/DrillLibraryModal'));
const ParentSessionBuilder = lazy(() => import('../components/dashboard/ParentSessionBuilder'));
const PlayerEvaluationModal = lazy(() => import('../components/dashboard/PlayerEvaluationModal'));
const EventDetailModal = lazy(() => import('../components/dashboard/calendar/EventDetailModal'));
const LineupBuilder    = lazy(() => import('../components/coach-hq/lineup/LineupBuilder'));
const RulesView = lazy(() => import('../components/dashboard/RulesView'));
const NotificationsView = lazy(() => import('../components/notifications/NotificationsView'));
const DrillDetailModal = lazy(() => import('../components/player/DrillDetailModal'));

const ViewLoader = () => (
    <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-brand-green animate-spin" />
    </div>
);
// BadgeCelebration intentionally NOT imported here. Badge unlock UX lives
// only on the player dashboard so a parent watching the screen can't
// dismiss the celebration before the kid sees it.

const ParentDashboard = () => {
    const { user, profile, signOut } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const voiceCommand = useVoiceCommand();
    const [searchParams] = useSearchParams();
    const previewPlayerId = searchParams.get('preview');
    const isPreview = Boolean(previewPlayerId);
    const [currentView, setCurrentView] = useState('overview');
    const [showDetails, setShowDetails] = useState(false);
    const [customizeOpen, setCustomizeOpen] = useState(false);
    const [heroOpen, setHeroOpen] = useState(false);
    const [heroRefresh, setHeroRefresh] = useState(0);
    const [loading, setLoading] = useState(true);
    const [inviteOpen, setInviteOpen] = useState(false);
    // When set, EventDetailModal opens with this event so the parent can see
    // who's going / out / no-response on the team. Same modal as the coach view.
    const [openEvent, setOpenEvent] = useState(null);
    const [openLineupEvent, setOpenLineupEvent] = useState(null);
    const [showFamilyBuilder, setShowFamilyBuilder] = useState(false);
    // When set, DrillDetailModal opens so a parent can read the FULL drill
    // (name + description + video) for a coach-assigned team challenge.
    const [coachDrillDetail, setCoachDrillDetail] = useState(null);

    // Wire voice navigation: lets the user say "go to schedule" / "messages"
    // / "overview" and have the parent dashboard switch tabs.
    useEffect(() => {
        if (voiceCommand?.registerDashboardControls) {
            voiceCommand.registerDashboardControls(setCurrentView);
        }
    }, [voiceCommand]);

    // Real data state
    const [children, setChildren] = useState([]);
    const [selectedChild, setSelectedChild] = useState(null);
    const [playerStats, setPlayerStats] = useState(null);
    const [playerEvaluation, setPlayerEvaluation] = useState(null); // Coach ratings from evaluations table
    const [playerBadges, setPlayerBadges] = useState([]);
    const [upcomingEvents, setUpcomingEvents] = useState([]);
    const [upcomingCounts, setUpcomingCounts] = useState({}); // { eventId: { going, not_going, vacation, total } }
    const [coachAssignments, setCoachAssignments] = useState([]);
    const [parentAssignments, setParentAssignments] = useState([]);
    const [attendanceStats, setAttendanceStats] = useState({ attended: 0, missed: 0, rate: 0 });
    const [eventRsvps, setEventRsvps] = useState({}); // { eventId: 'going' | 'not_going' | 'maybe' }

    // Practice minutes state
    const [practiceMins, setPracticeMins] = useState({ team: 0, solo: 0, weekly: 0, season: 0, yearly: 0, career: 0, weeklyTouches: 0, seasonTouches: 0, yearlyTouches: 0, careerTouches: 0 });
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [showDrillLibrary, setShowDrillLibrary] = useState(false);
    // showSessionBuilder removed — builder moved to player dashboard.

    // Player access link state
    const [playerAccessLink, setPlayerAccessLink] = useState(null);
    const [generatingLink, setGeneratingLink] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

    // Phone back button → close the topmost open modal instead of leaving the
    // app (and never to login). Returns false when nothing's open so the home
    // screen can exit cleanly.
    useBackGuard(() => {
        if (coachDrillDetail) { setCoachDrillDetail(null); return true; }
        if (openLineupEvent) { setOpenLineupEvent(null); return true; }
        if (openEvent) { setOpenEvent(null); return true; }
        if (showDrillLibrary) { setShowDrillLibrary(false); return true; }
        if (showFamilyBuilder) { setShowFamilyBuilder(false); return true; }
        if (inviteOpen) { setInviteOpen(false); return true; }
        if (showDetails) { setShowDetails(false); return true; }
        return false;
    });

    // Lock the body's scroll while any modal is open so the dashboard
    // behind the modal doesn't shift when the user scrolls / drags
    // inside it. Restored on close.
    useEffect(() => {
        const anyOpen = showDetails || inviteOpen || !!openEvent || !!openLineupEvent || showDrillLibrary || showFamilyBuilder || !!coachDrillDetail;
        if (!anyOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [showDetails, inviteOpen, openEvent, openLineupEvent, showDrillLibrary, showFamilyBuilder, coachDrillDetail]);

    // When the user picks a different top-nav tab, close any open modal
    // first — otherwise the modal stays mounted on top of the new view.
    useEffect(() => {
        setShowDetails(false);
        setInviteOpen(false);
        setOpenEvent(null);
        setOpenLineupEvent(null);
        setShowDrillLibrary(false);
        setShowFamilyBuilder(false);
        setPlayerAccessLink(null);
    }, [currentView]);

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

    // Refetch when the tab regains focus / page becomes visible — covers the
    // common case where Albert (or a parent) creates an event in another tab
    // or via coach view, then switches back here and expects to see it
    // without manually refreshing. Quiet refresh — no loading spinner so the
    // UI doesn't flash.
    useEffect(() => {
        if (!selectedChild?.id) return;
        const refresh = () => {
            if (document.visibilityState === 'visible') {
                fetchChildDetails(selectedChild.id);
            }
        };
        document.addEventListener('visibilitychange', refresh);
        window.addEventListener('focus', refresh);
        return () => {
            document.removeEventListener('visibilitychange', refresh);
            window.removeEventListener('focus', refresh);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedChild?.id]);

    useEffect(() => {
        const handleDrillCompleted = () => {
            if (selectedChild?.id) {
                fetchChildDetails(selectedChild.id);
            }
        };

        window.addEventListener('drill-completed', handleDrillCompleted);
        return () => window.removeEventListener('drill-completed', handleDrillCompleted);
    }, [selectedChild?.id]);

    const fetchChildrenData = async () => {
        setLoading(true);
        try {
            // Preview mode (coach/manager previewing parent view): bypass the
            // family_members lookup and pull the requested player directly.
            // Manager/coach RLS already permits this; we just override the
            // selection logic.
            let playerIds = [];
            if (isPreview && previewPlayerId) {
                playerIds = [previewPlayerId];
            } else {
                // Get linked children via family_members table
                const { data: links } = await supabase
                    .from('family_members')
                    .select('player_id')
                    .eq('user_id', user.id)
                    .in('relationship', ['guardian', 'fan']);

                playerIds = links?.map(l => l.player_id) || [];
            }

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
            // Fetch player stats (training minutes, streak, etc.).
            // .maybeSingle() — a brand-new player has no stats row yet,
            // and we don't want a 406 in the console for that.
            const { data: stats } = await supabase
                .from('player_stats')
                .select('*')
                .eq('player_id', playerId)
                .maybeSingle();

            setPlayerStats(stats);

            // Training minutes from player_stats at all time levels.
            // Set the practice mins IMMEDIATELY so the dashboard renders the
            // real numbers even if a downstream fetch (eval, assignments,
            // attendance) throws. Previously the whole function shared one
            // try/catch and a thrown error left the initial-state zeros
            // visible — exactly the "all zeros" bug Albert hit on 2026-05-18.
            // Real team-attended minutes get computed and re-set below; this
            // first set guarantees we never display zeros if stats exist.
            const soloMins = stats?.training_minutes || 0;
            const weeklyMins = stats?.weekly_minutes || 0;
            const seasonMins = stats?.season_minutes || 0;
            const yearlyMins = stats?.yearly_minutes || 0;
            setPracticeMins(prev => ({
                ...prev,
                solo: soloMins,
                weekly: weeklyMins,
                season: seasonMins,
                yearly: yearlyMins,
                career: soloMins,
                weeklyTouches: stats?.weekly_touches || 0,
                seasonTouches: stats?.season_touches || 0,
                yearlyTouches: stats?.yearly_touches || 0,
                careerTouches: stats?.career_touches || 0,
            }));

            // Fetch player evaluation (coach ratings - same as PlayerDashboard)
            console.log('[ParentDashboard] Fetching evaluation for player_id:', playerId);
            const { data: evalData, error: evalError } = await supabase
                .from('evaluations')
                .select('*')
                .eq('player_id', playerId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

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
                .order('awarded_at', { ascending: false });

            if (badgeError) {
                console.error('Error fetching player badges:', badgeError);
            }

            // Join badge definitions in JavaScript
            const badges = (earnedBadges || []).map(pb => ({
                ...pb,
                badges: badgeMap[pb.badge_id] || null
            }));

            setPlayerBadges(badges);

            // Fetch upcoming events — across EVERY team the kid is active
            // on (kid may be rostered to a club team + Summer Squad at the same
            // time). Pulls team ids from player_teams (status='active');
            // falls back to legacy primary team_id when no active rows.
            const { data: activeTeams } = await supabase
                .from('player_teams')
                .select('team_id')
                .eq('player_id', playerId)
                .eq('status', 'active');
            const kidTeamIds = (activeTeams?.length
                ? activeTeams.map(r => r.team_id)
                : [selectedChild?.team_id]).filter(Boolean);

            if (kidTeamIds.length > 0) {
                const { data: events } = await supabase
                    .from('events')
                    .select('*')
                    .in('team_id', kidTeamIds)
                    .gte('start_time', new Date().toISOString())
                    .order('start_time', { ascending: true })
                    .limit(5);

                setUpcomingEvents(events || []);

                // Fetch RSVP counts for those events so the inline card can
                // show "5 going · 2 out · 1 vacation" before the parent taps
                // to drill in. Matches UpcomingWeek + EventCard behavior.
                if (events && events.length > 0) {
                    const evIds = events.map(e => e.id);
                    const { data: allRsvps } = await supabase
                        .from('event_rsvps')
                        .select('event_id, status')
                        .in('event_id', evIds);
                    const counts = {};
                    (allRsvps || []).forEach(r => {
                        if (!counts[r.event_id]) counts[r.event_id] = { going: 0, not_going: 0, vacation: 0, total: 0 };
                        if (counts[r.event_id][r.status] !== undefined) counts[r.event_id][r.status]++;
                        counts[r.event_id].total++;
                    });
                    setUpcomingCounts(counts);

                    // THIS child's own RSVP per event, so the inline buttons
                    // highlight the right status and reset when the parent
                    // switches kids in the child picker.
                    const { data: childRsvps } = await supabase
                        .from('event_rsvps')
                        .select('event_id, status')
                        .eq('player_id', playerId)
                        .in('event_id', evIds);
                    const mine = {};
                    (childRsvps || []).forEach(r => { mine[r.event_id] = r.status; });
                    setEventRsvps(mine);
                }
            }

            const weekStart = new Date();
            const dayOfWeek = weekStart.getDay();
            const daysFromMonday = (dayOfWeek + 6) % 7;
            weekStart.setDate(weekStart.getDate() - daysFromMonday);
            weekStart.setHours(0, 0, 0, 0);
            const weekStartIso = weekStart.toISOString();

            // Fetch coach assignments, including individual Personal Plan rows.
            const { data: coachAssigns } = await supabase
                .from('assignments')
                .select('*, drills:drill_id (id, name, category, duration, description, video_url)')
                .eq('player_id', playerId)
                .eq('source', 'coach')
                .or(`status.neq.completed,completed_at.gte.${weekStartIso}`)
                .order('due_date', { ascending: true });

            setCoachAssignments(coachAssigns || []);

            // Fetch all non-coach assignments for this player (parent OR
            // player-built). Parents should see anything their kid built
            // themselves too — that's the whole point of "Family Skill Work"
            // as a status-of-solo-work section.
            const { data: parentAssigns } = await supabase
                .from('assignments')
                .select('*, drills:drill_id (id, name, category, duration, description)')
                .eq('player_id', playerId)
                .in('source', ['parent', 'player'])
                .or(`status.neq.completed,completed_at.gte.${weekStartIso}`)
                .order('due_date', { ascending: true });

            setParentAssignments(parentAssigns || []);

            // Calculate attendance from real RSVP data
            if (kidTeamIds.length > 0) {
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
            if (kidTeamIds.length > 0) {
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
                setPracticeMins({ team: teamMins, solo: soloMins, weekly: weeklyMins, season: seasonMins, yearly: yearlyMins, career: soloMins, weeklyTouches: stats?.weekly_touches || 0, seasonTouches: stats?.season_touches || 0, yearlyTouches: stats?.yearly_touches || 0, careerTouches: stats?.career_touches || 0 });
            } else {
                setPracticeMins({ team: 0, solo: soloMins, weekly: weeklyMins, season: seasonMins, yearly: yearlyMins, career: soloMins, weeklyTouches: stats?.weekly_touches || 0, seasonTouches: stats?.season_touches || 0, yearlyTouches: stats?.yearly_touches || 0, careerTouches: stats?.career_touches || 0 });
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
            toast.error("Couldn't generate the access link. Check your connection and try again.");
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

    // Handle RSVP for events. The overview is scoped to the child picked in
    // the switcher (selectedChild), so RSVP applies to THAT child only —
    // multi-kid families like the Schroms (Declan + Oliver on Summer Squad)
    // switch child to RSVP each independently. Per-child controls also live
    // in EventDetailModal. Only when there's no selected child do we fall
    // back to every linked kid on the event's team.
    const handleRsvp = async (eventId, status, event) => {
        const teamId = event?.team_id;
        const targets = selectedChild
            ? [selectedChild]
            : (teamId ? children.filter(c => c.team_id === teamId) : children);

        if (targets.length === 0) {
            toast.warning("No kid on this team to RSVP for.");
            return;
        }

        // Optimistic update
        setEventRsvps(prev => ({ ...prev, [eventId]: status }));

        const playerIds = targets.map(t => t.id);
        const { ok, errors } = await upsertRsvpForMany(eventId, playerIds, status);
        if (!ok) {
            const msg = errors[0]?.error?.message || 'unknown error';
            console.error('Error saving RSVP:', errors);
            toast.error(`Couldn't save RSVP: ${msg}`);
            setEventRsvps(prev => {
                const copy = { ...prev };
                delete copy[eventId];
                return copy;
            });
        } else {
            toast.success(`${namesList(targets)} marked ${statusLabel(status)}.`);
        }
    };

    const completeAssignmentForSelectedChild = async (assignmentId) => {
        const { error } = await supabase
            .rpc('complete_assignment', {
                p_assignment_id: assignmentId,
                p_player_id: selectedChild.id
            });

        if (error) {
            console.error('Error completing assignment:', error);
            await supabase
                .from('assignments')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('id', assignmentId);
        }
    };

    const handleCompleteCoachDrill = async (assignmentId) => {
        if (!selectedChild?.id) return;

        setCoachAssignments(prev => prev.map(a =>
            a.id === assignmentId ? { ...a, status: 'completed', completed_at: new Date().toISOString() } : a
        ));

        try {
            await completeAssignmentForSelectedChild(assignmentId);
            if (selectedChild?.id) {
                await fetchChildDetails(selectedChild.id);
            }
            window.dispatchEvent(new CustomEvent('drill-completed'));
        } catch (err) {
            console.error('Error:', err);
            setCoachAssignments(prev => prev.map(a =>
                a.id === assignmentId ? { ...a, status: 'pending', completed_at: null } : a
            ));
        }
    };

    // Handle completing a parent-assigned drill
    const handleCompleteParentDrill = async (assignmentId) => {
        if (!selectedChild?.id) return;

        // Optimistic update
        setParentAssignments(prev => prev.map(a =>
            a.id === assignmentId ? { ...a, status: 'completed', completed_at: new Date().toISOString() } : a
        ));

        try {
            await completeAssignmentForSelectedChild(assignmentId);
            if (selectedChild?.id) {
                await fetchChildDetails(selectedChild.id);
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
            heroMode: player.hero_mode || null,
            country: player.card_country || DEFAULT_CARD_COUNTRY,
            image: getPlayerAvatarPath({
                avatarUrl: player.avatar_url || null,
                firstName: player.first_name || '',
                lastName: player.last_name || '',
                displayName: `${player.first_name || ''} ${player.last_name || ''}`.trim()
            })
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
            case 'rules':
                return <RulesView />;
            case 'notifications':
                return <NotificationsView />;
            case 'vacation':
                // Moved out of the overview flow per Albert 2026-05-18 — the
                // overview was too busy. Accessed from the More menu (mobile)
                // or the desktop top-nav tab.
                return (
                    <div className="max-w-3xl mx-auto">
                        {selectedChild?.id ? (
                            <VacationPeriodsManager
                                playerId={selectedChild.id}
                                playerName={selectedChild.first_name || 'your player'}
                            />
                        ) : (
                            <p className="text-gray-500 text-sm text-center py-12">Select a child first.</p>
                        )}
                    </div>
                );
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
                const teamCoachAssignments = coachAssignments.filter(a => a.team_id);
                const personalPlanAssignments = coachAssignments.filter(a => !a.team_id);
                const completedCoach = teamCoachAssignments.filter(a => a.status === 'completed').length;
                const totalCoach = teamCoachAssignments.length;
                const challengePercent = totalCoach > 0 ? Math.round((completedCoach / totalCoach) * 100) : 0;
                const coachChallengeDone = totalCoach === 0 || completedCoach === totalCoach;
                const completedParent = parentAssignments.filter(a => a.status === 'completed').length;
                const totalParent = parentAssignments.length;
                const totalMins = practiceMins.team + practiceMins.solo;

                // Per Albert 2026-05-18, the parent overview is laid out
                // top-to-bottom in this order so the most-actioned items are
                // up top. Each block is its own glass-panel; desktop and
                // mobile both flow vertically for consistency.
                //
                //   1. Child selector (multi-kid only)
                //   2. Upcoming Events
                //   3. Player Card (+ family-share button right above)
                //   4. IDP
                //   5. Vacation + Private Training (small badges, kept
                //      between IDP and tiles)
                //   6. Tiles: Challenge % | Attendance | Training Minutes
                //   7. Leaderboard (always shown — no toggle)
                //   8. Coach Challenge
                //   9. Family Skill Work
                //  10. Player Link
                //  11. Development Passport now carries badge/stamp history.
                return (
                    <div className="space-y-6">
                        {/* 1. Child selector if multiple children */}
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

                        {/* 2. Upcoming Events */}
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
                                        const counts = upcomingCounts[event.id] || { going: 0, not_going: 0, vacation: 0, total: 0 };
                                        return (
                                            <div key={event.id} className="p-3 bg-white/5 rounded-lg space-y-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setOpenEvent(event)}
                                                    className="w-full flex items-center gap-3 text-left hover:bg-white/5 -m-1 p-1 rounded transition-colors"
                                                >
                                                    <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center ${
                                                        event.type === 'game' ? 'bg-red-500/20 text-red-400' :
                                                        event.type === 'practice' ? 'bg-brand-green/20 text-brand-green' :
                                                        'bg-blue-500/20 text-blue-400'
                                                    }`}>
                                                        <span className="text-xs font-bold uppercase leading-none">{date.toLocaleDateString('en-US', { month: 'short' })}</span>
                                                        <span className="text-sm font-bold leading-none">{date.getDate()}</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm text-white font-medium truncate flex items-center gap-1">
                                                            {event.title}
                                                            <ChevronRight className="w-3 h-3 text-gray-500" />
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {date.toLocaleDateString('en-US', { weekday: 'short' })} at {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                                        </div>
                                                        <div className="mt-1 flex items-center gap-2 text-[10px] flex-wrap">
                                                            {counts.total === 0 ? (
                                                                <span className="text-gray-500 italic">No RSVPs yet — tap to view</span>
                                                            ) : (
                                                                <>
                                                                    {counts.going > 0    && <span className="text-green-400 font-bold">{counts.going} going</span>}
                                                                    {counts.not_going > 0 && <span className="text-red-400 font-bold">{counts.not_going} out</span>}
                                                                    {counts.vacation > 0 && <span className="text-sky-400 font-bold">{counts.vacation} vacation</span>}
                                                                    <span className="text-gray-600">· tap for details</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                                <div className="flex gap-2">
                                                    {[
                                                        { status: 'going',     label: 'Going',    activeCls: 'bg-green-500 text-white',  idleCls: 'bg-green-500/20 text-green-400 hover:bg-green-500/40' },
                                                        { status: 'not_going', label: 'Out',      activeCls: 'bg-red-500 text-white',    idleCls: 'bg-red-500/20 text-red-400 hover:bg-red-500/40' },
                                                        { status: 'vacation',  label: 'Vacation', activeCls: 'bg-sky-500 text-white',    idleCls: 'bg-sky-500/20 text-sky-400 hover:bg-sky-500/40' },
                                                    ].map(({ status, label, activeCls, idleCls }) => (
                                                        <button
                                                            key={status}
                                                            onClick={() => handleRsvp(event.id, status, event)}
                                                            className={`flex-1 py-1.5 text-xs font-bold rounded transition-all ${currentRsvp === status ? activeCls : idleCls}`}
                                                        >
                                                            {label}
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

                        {/* 3. Player Card. The "Invite another parent" action
                             moved to the More menu (mobile) + a small icon in
                             the top header (desktop) so the overview isn't
                             cluttered with a button right above the card. */}
                        <div className="group cursor-pointer relative max-w-xl mx-auto" onClick={() => setShowDetails(true)}>
                            <div className="absolute -top-5 left-0 w-full text-center text-brand-green text-xs font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                Tap for Report Card
                            </div>
                            <PlayerCard player={formatPlayerForCard(selectedChild)} onClick={() => setShowDetails(true)} />
                        </div>
                        <div className="text-center -mt-2 flex items-center justify-center gap-4 flex-wrap">
                            {selectedChild?.id && (
                                <PhotoUploadButton
                                    playerId={selectedChild.id}
                                    onUploaded={(url) => {
                                        setSelectedChild(prev => prev ? { ...prev, avatar_url: url } : prev);
                                        setChildren(prev => prev.map(c => c.id === selectedChild.id ? { ...c, avatar_url: url } : c));
                                    }}
                                />
                            )}
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
                        {selectedChild?.id && <HeroProgress playerId={selectedChild.id} refreshKey={heroRefresh} />}
                        {heroOpen && selectedChild?.id && (
                            <HeroModeModal
                                playerId={selectedChild.id}
                                playerName={selectedChild.first_name || ''}
                                onSaved={(mode) => {
                                    setSelectedChild(prev => prev ? { ...prev, hero_mode: mode } : prev);
                                    setChildren(prev => prev.map(c => c.id === selectedChild.id ? { ...c, hero_mode: mode } : c));
                                    setHeroRefresh(n => n + 1);
                                }}
                                onClose={() => setHeroOpen(false)}
                            />
                        )}
                        {customizeOpen && selectedChild?.id && (
                            <CardCustomizeModal
                                playerId={selectedChild.id}
                                playerName={selectedChild.first_name || ''}
                                current={selectedChild.card_country || DEFAULT_CARD_COUNTRY}
                                onSaved={(code) => {
                                    setSelectedChild(prev => prev ? { ...prev, card_country: code } : prev);
                                    setChildren(prev => prev.map(c => c.id === selectedChild.id ? { ...c, card_country: code } : c));
                                }}
                                onClose={() => setCustomizeOpen(false)}
                            />
                        )}

                        {/* 4. IDP */}
                        {selectedChild?.id && (
                            <PlayerIDPCard
                                playerId={selectedChild.id}
                                teamId={selectedChild.team_id || null}
                                playerName={`${selectedChild.first_name || ''} ${selectedChild.last_name || ''}`.trim()}
                            />
                        )}

                        <DevelopmentPassportCard
                            badges={playerBadges}
                            stats={{
                                weekly_minutes: practiceMins.weekly,
                                weekly_touches: practiceMins.weeklyTouches,
                                career_touches: practiceMins.careerTouches,
                            }}
                            playerName={`${selectedChild?.first_name || ''} ${selectedChild?.last_name || ''}`.trim()}
                        />

                        {/* 5. Private Training badge stays here when applicable.
                             Vacation moved to the More menu / its own view to
                             de-clutter the overview (it's an infrequent action). */}
                        {selectedChild?.id && (
                            <PrivateTrainingBadge
                                playerId={selectedChild.id}
                                playerName={selectedChild.first_name || 'your player'}
                            />
                        )}

                        {/* 6. Tiles: Challenge % | Attendance | Training Minutes */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Challenge Progress */}
                            <div className="glass-panel p-5 flex flex-col">
                                <h4 className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-3 flex items-center gap-1.5">
                                    <Target className="w-3.5 h-3.5 text-brand-gold" /> Coach Challenge
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
                                                strokeDashoffset={163.4 - (163.4 * challengePercent / 100)}
                                                strokeLinecap="round"
                                                className={challengePercent === 100 ? 'text-brand-green' : 'text-brand-gold'}
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-white font-bold text-sm">{challengePercent}%</span>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-2xl text-white font-bold leading-none">
                                            {completedCoach}<span className="text-gray-500 text-lg">/{totalCoach}</span>
                                        </div>
                                        <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">
                                            {coachChallengeDone && totalCoach > 0 ? 'All Done!' : 'Coach Drills'}
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
                        </div>

                        {/* Training Minutes tile removed from the overview per
                             Albert 2026-05-18 — the same stats live on the back
                             of the player card (PlayerEvaluationModal), so the
                             front was duplicating. Tap the player card to flip
                             for the full breakdown. */}

                        {selectedChild?.team_id && <TeamCelebrationBanner teamId={selectedChild.team_id} />}
                        {selectedChild?.team_id && <TeamGoalBar teamId={selectedChild.team_id} />}

                        {/* June Juggling Competition */}
                        {selectedChild?.id && (
                            <JuggleChallengeCard
                                playerId={selectedChild.id}
                                teamId={selectedChild.team_id || null}
                                playerName={selectedChild.first_name}
                            />
                        )}

                        {/* 7. Leaderboard — always shown, no toggle. */}
                        <Leaderboard />

                        {/* Support / sponsor — opens the hosted Zeffy form (815YouthSports 501c3). */}
                        <SupportTeamCard />

                        {/* 8. Coach Challenge */}
                        <div className="glass-panel p-5 border-l-4 border-l-blue-500">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-blue-400 text-xs uppercase font-bold flex items-center gap-2">
                                    <Target className="w-4 h-4" /> Coach Challenge
                                </h4>
                                {totalCoach > 0 && (
                                    <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                                        coachChallengeDone ? 'bg-brand-green/20 text-brand-green' : 'bg-blue-500/20 text-blue-400'
                                    }`}>
                                        {completedCoach}/{totalCoach} Done
                                    </span>
                                )}
                            </div>
                            {teamCoachAssignments.length === 0 ? (
                                <div className="text-center py-4">
                                    <Target className="w-6 h-6 text-gray-700 mx-auto mb-1" />
                                    <p className="text-gray-500 text-xs">No coach challenge this week</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {teamCoachAssignments.map(assign => (
                                        <div
                                            key={assign.id}
                                            role={assign.status === 'completed' ? undefined : 'button'}
                                            tabIndex={assign.status === 'completed' ? undefined : 0}
                                            onClick={assign.status === 'completed' ? undefined : () => handleCompleteCoachDrill(assign.id)}
                                            onKeyDown={assign.status === 'completed' ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCompleteCoachDrill(assign.id); } }}
                                            className={`flex items-center gap-3 p-2.5 rounded-lg transition-all ${assign.status === 'completed' ? 'bg-brand-green/5' : 'bg-white/5 cursor-pointer hover:bg-white/10 active:bg-white/15'}`}
                                        >
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
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const d = assign.drills || {};
                                                        const dur = assign.custom_duration || d.duration || d.duration_minutes;
                                                        setCoachDrillDetail({
                                                            id: assign.id,
                                                            title: d.name || d.title || 'Drill',
                                                            duration: dur ? `${dur}m` : null,
                                                            completed: assign.status === 'completed',
                                                            originalDrill: d,
                                                        });
                                                    }}
                                                    className="mt-0.5 text-[11px] font-medium text-brand-gold/90 hover:text-brand-gold"
                                                >
                                                    Read full description →
                                                </button>
                                                {assign.status !== 'completed' && (
                                                    <div className="text-[11px] text-blue-400 font-semibold mt-0.5">Tap to mark done ✓</div>
                                                )}
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

                        <PersonalPlanCard
                            assignments={personalPlanAssignments}
                            onComplete={handleCompleteCoachDrill}
                        />

                        {/* 9. My Training */}
                        <div className="glass-panel p-5 border-l-4 border-l-brand-gold">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-brand-gold text-xs uppercase font-bold flex items-center gap-2">
                                    <Zap className="w-4 h-4" /> My Training
                                </h4>
                                {selectedChild?.id && (
                                    <button
                                        onClick={() => setShowFamilyBuilder(true)}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand-gold/10 border border-brand-gold/30 text-brand-gold text-[11px] font-bold uppercase tracking-wider hover:bg-brand-gold/20 transition-colors"
                                    >
                                    <Dumbbell className="w-3.5 h-3.5" /> Add Training
                                    </button>
                                )}
                            {totalParent > 0 && (
                                <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                                    completedParent === totalParent ? 'bg-brand-green/20 text-brand-green' : 'bg-brand-gold/20 text-brand-gold'
                                }`}>
                                        {completedParent}/{totalParent} Done
                                    </span>
                                )}
                            </div>

                            {parentAssignments.length === 0 ? (
                                <div className="text-center py-4">
                                    <Dumbbell className="w-6 h-6 text-gray-700 mx-auto mb-1" />
                                    <p className="text-gray-500 text-xs">No training yet</p>
                                    <p className="text-[10px] text-gray-600 mt-1">Add a session here or let your player build one on their dashboard.</p>
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
                                                    title={coachChallengeDone ? 'Mark as done' : 'Complete the coach challenge first'}
                                                />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className={`text-sm font-medium truncate ${assign.status === 'completed' ? 'text-gray-400 line-through' : 'text-white'}`}>
                                                    {assign.drills?.name || assign.drills?.title || 'Drill'}
                                                </div>
                                                <div className="mt-1 flex items-center gap-2 flex-wrap text-[10px] uppercase tracking-wider">
                                                    <span className={`px-1.5 py-0.5 rounded ${assign.source === 'player' ? 'bg-brand-green/15 text-brand-green' : 'bg-brand-gold/15 text-brand-gold'}`}>
                                                        {assign.source === 'player' ? 'Solo' : 'Family'}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">
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

                        {/* 10. Player Link */}
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
                );
            }
        }
    };

    // Full-page family gate. Parents who signed up but haven't
    // linked a kid see the welcome + setup flow instead of an empty
    // dashboard with nav tabs that all return empty states. Preview
    // mode (coach/manager viewing as parent) bypasses since the player
    // is already injected via ?preview=. Loading state also passes
    // through so we don't flash the gate before children are fetched.
    if (!loading && !isPreview && children.length === 0) {
        return (
            <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
                <div className="max-w-md w-full">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                            <img src="/branding/logo.png" alt="Rockford Fire FC" className="w-full h-full object-contain" />
                        </div>
                        <h1 className="text-2xl text-white font-display uppercase font-bold tracking-wider">
                            Welcome to <span className="text-blue-500">Fire FC</span>
                        </h1>
                        <p className="text-gray-400 text-sm mt-2">
                            Complete your family setup, then select the child you want to link.
                        </p>
                    </div>
                    <GuardianCodeEntry
                        onSuccess={() => fetchChildrenData()}
                    />
                    <div className="text-center mt-6">
                        <button
                            onClick={async () => { await signOut(); navigate('/login'); }}
                            className="text-xs text-gray-500 hover:text-gray-300 underline"
                        >
                            Sign out
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        // overflow-x-hidden defends against any decorative element (messi
        // badge pokes 32px past the card's right edge, player image pokes
        // 10px past) creating a horizontal scrollbar on narrow phones.
        <div className="min-h-screen bg-brand-dark pb-20 overflow-x-hidden">
            <PreviewBanner
                isPreview={isPreview}
                role="parent"
                playerName={selectedChild?.first_name || selectedChild?.display_name}
            />
            {/* Drill Library Modal */}
            {showDrillLibrary && selectedChild && (
                <Suspense fallback={null}>
                    <DrillLibraryModal
                        onClose={() => {
                            setShowDrillLibrary(false);
                            if (selectedChild?.id) fetchChildDetails(selectedChild.id);
                        }}
                        player={selectedChild}
                        teamId={selectedChild?.team_id}
                    />
                </Suspense>
            )}

            {showFamilyBuilder && selectedChild && (
                <Suspense fallback={null}>
                    <ParentSessionBuilder
                        saveMode="parent"
                        playerId={selectedChild.id}
                        teamId={selectedChild.team_id}
                        playerName={`${selectedChild.first_name || ''} ${selectedChild.last_name || ''}`.trim()}
                        onClose={() => setShowFamilyBuilder(false)}
                        onSave={() => {
                            fetchChildDetails(selectedChild.id);
                            window.dispatchEvent(new CustomEvent('drill-completed'));
                        }}
                    />
                </Suspense>
            )}

            {/* Coach Challenge "Read full description" — rendered here at the page
                root (not inside the Coach Challenge glass-panel) so the fixed modal
                isn't trapped by a backdrop-filter ancestor. */}
            {coachDrillDetail && (
                <Suspense fallback={null}>
                    <DrillDetailModal
                        drill={coachDrillDetail}
                        onClose={() => setCoachDrillDetail(null)}
                        onComplete={(id) => { handleCompleteCoachDrill(id); setCoachDrillDetail(null); }}
                    />
                </Suspense>
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
                                { id: 'overview',      label: 'Overview', icon: LayoutDashboard },
                                { id: 'schedule',      label: 'Schedule', icon: Calendar },
                                { id: 'live',          label: 'Live',     icon: Trophy },
                                { id: 'messages',      label: 'Messages', icon: MessageSquare },
                                { id: 'notifications', label: 'Alerts',   icon: Bell },
                                { id: 'vacation',      label: 'Vacation', icon: Plane },
                                { id: 'gallery',       label: 'Gallery',  icon: Camera },
                                { id: 'rules',         label: 'Rules',    icon: FileText },
                                // Live / Carpool / Billing still hidden until each is
                                // tested with a real team. Components and routing
                                // (case statements above) are intact so re-adding is
                                // a one-line change here.
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

                        {/* On mobile, navigation lives in MobileBottomNav at the
                            bottom of the screen (mounted further down). On
                            desktop, Invite Parent + Logout stay in the top bar
                            so they're always reachable. */}

                        {selectedChild?.id && (
                            <button
                                onClick={() => setInviteOpen(true)}
                                className="hidden md:inline-flex items-center gap-1.5 text-brand-gold hover:bg-brand-gold/10 transition-colors px-2 py-1.5 rounded"
                                title="Invite another parent"
                            >
                                <Link2 className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Invite</span>
                            </button>
                        )}

                        <button onClick={handleLogout} className="flex items-center gap-1.5 text-gray-400 hover:text-red-400 transition-colors px-2 py-1.5 rounded hover:bg-red-500/10" title="Logout">
                            <LogOut className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Logout</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Player Details Modal */}
            {showDetails && selectedChild && (
                <Suspense fallback={null}>
                    <PlayerEvaluationModal
                        player={formatPlayerForCard(selectedChild)}
                        onClose={() => setShowDetails(false)}
                        readOnly={true}
                    />
                </Suspense>
            )}

            {/* Family invite — share guardian code via SMS / Email / Copy.
                FamilyInviteModal pulls guardian_code from players.id if it
                isn't passed in, so we don't need to query it here. */}
            {inviteOpen && selectedChild && (
                <FamilyInviteModal
                    player={{
                        id: selectedChild.id,
                        name: `${selectedChild.first_name || ''} ${selectedChild.last_name || ''}`.trim(),
                        firstName: selectedChild.first_name,
                        lastName: selectedChild.last_name,
                        number: selectedChild.jersey_number,
                        guardian_code: selectedChild.guardian_code,
                        avatar: selectedChild.avatar_url,
                    }}
                    onClose={() => setInviteOpen(false)}
                />
            )}

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-8">
                {currentView !== 'live' && <LiveGameBanner onOpen={() => setCurrentView('live')} />}
                <Suspense fallback={<ViewLoader />}>
                    {renderView()}
                </Suspense>
            </main>

            {/* Mobile bottom nav — matches the manager dashboard pattern.
                Parent-specific item set: Overview / Schedule / Messages as
                quick-access; Gallery + Rules tucked under More; Logout as
                a defensive entry in the More menu so it's always reachable. */}
            <MobileBottomNav
                currentView={currentView}
                onViewChange={setCurrentView}
                onLogout={handleLogout}
                mainItems={[
                    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
                    { id: 'schedule', label: 'Schedule', icon: Calendar },
                    { id: 'messages', label: 'Messages', icon: MessageSquare },
                ]}
                moreItems={[
                    { id: 'live',          label: 'Live', icon: Trophy },
                    { id: 'notifications', label: 'Alerts', icon: Bell },
                    { id: 'vacation',      label: 'Vacation', icon: Plane },
                    { id: 'gallery',       label: 'Gallery',  icon: Camera },
                    { id: 'rules',         label: 'Rules',    icon: FileText },
                    // Action item — fires the FamilyInviteModal directly from
                    // the More sheet instead of switching views.
                    selectedChild?.id ? { id: 'invite-parent', label: 'Invite Parent', icon: Link2, action: () => setInviteOpen(true) } : null,
                ].filter(Boolean)}
            />

            {openEvent && (
                <Suspense fallback={null}>
                    <EventDetailModal
                        event={openEvent}
                        onClose={() => setOpenEvent(null)}
                        onOpenLineup={(e) => { setOpenEvent(null); setOpenLineupEvent(e); }}
                    />
                </Suspense>
            )}

            {openLineupEvent && (
                <Suspense fallback={null}>
                    <LineupBuilder event={openLineupEvent} onClose={() => setOpenLineupEvent(null)} />
                </Suspense>
            )}
        </div>
    );
};

export default ParentDashboard;
