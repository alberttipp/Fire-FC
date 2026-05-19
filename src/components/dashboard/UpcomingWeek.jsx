import {
    Calendar, MapPin, Clock, Users, ChevronLeft, ChevronRight,
    CheckCircle2, XCircle, Plane, Bell, BellOff, Shirt,
    Trophy, Dumbbell, Coffee, Users2, AlertCircle, Plus
} from 'lucide-react';
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import { STAFF_ROLES } from '../../constants/roles';
import { resolveWritablePlayers, upsertRsvpForMany, namesList, statusLabel } from '../../utils/rsvp';
import CreateEventModal from './CreateEventModal';
const EventDetailModal = lazy(() => import('./calendar/EventDetailModal'));
const LineupBuilder    = lazy(() => import('../coach-hq/lineup/LineupBuilder'));

// Event type icons and colors
const EVENT_STYLES = {
    practice: { icon: Dumbbell, color: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/30' },
    game: { icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30' },
    training: { icon: Dumbbell, color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30' },
    social: { icon: Coffee, color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/30' },
    meeting: { icon: Users2, color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30' },
    tournament: { icon: Trophy, color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' },
};

const RSVP_OPTIONS = [
    { status: 'going',     icon: CheckCircle2, label: 'Going',    color: 'text-green-400 bg-green-500/20 border-green-500' },
    { status: 'not_going', icon: XCircle,      label: 'Out',      color: 'text-red-400 bg-red-500/20 border-red-500' },
    { status: 'vacation',  icon: Plane,        label: 'Vacation', color: 'text-sky-400 bg-sky-500/20 border-sky-500' },
];

const UpcomingWeek = ({ teamId = null, showAllTeams = false, compact = false }) => {
    const { user, profile } = useAuth();
    const toast = useToast();
    const [events, setEvents] = useState([]);
    const [rsvps, setRsvps] = useState({});
    const [rsvpCounts, setRsvpCounts] = useState({}); // { eventId: { going, not_going, vacation, total } }
    const [loading, setLoading] = useState(true);
    const [openEventDetail, setOpenEventDetail] = useState(null);
    // Lineup is its OWN top-level surface — we close the event detail
    // before opening it so nothing else competes for the viewport.
    const [openLineupEvent, setOpenLineupEvent] = useState(null);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [weekOffset, setWeekOffset] = useState(0);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Staff don't get personal RSVP buttons — they're not on the roster.
    // STAFF_ROLES is imported from constants/roles so this stays in sync with
    // every other surface that gates by staff role.
    const isStaff = STAFF_ROLES.has(profile?.role);
    const isCoachOrManager = isStaff;

    // Get date range for display
    const getDateRange = () => {
        const today = new Date();
        today.setDate(today.getDate() + (weekOffset * 7));
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            dates.push(date);
        }
        return dates;
    };

    const dates = getDateRange();
    const startDate = dates[0];
    const endDate = dates[6];

    // Fetch events
    const fetchEvents = async () => {
        setLoading(true);
        try {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            let query = supabase
                .from('events')
                .select(`
                    *,
                    teams (id, name, age_group)
                `)
                .gte('start_time', start.toISOString())
                .lte('start_time', end.toISOString())
                .order('start_time', { ascending: true });

            // Filter by team if specified
            if (teamId && !showAllTeams) {
                query = query.eq('team_id', teamId);
            }

            const { data, error } = await query;

            if (error) throw error;
            setEvents(data || []);

            // Fetch ALL RSVPs for visible events so we can render the
            // "5 going · 2 out · 1 vacation" inline summary on each card.
            // (Previous code filtered by player_id=user.id which only worked
            // for player accounts; parents/staff got nothing. Same bug
            // pattern as Martin's. Counts must be unfiltered.)
            if (data && data.length > 0) {
                const eventIds = data.map(e => e.id);
                const { data: allRsvps } = await supabase
                    .from('event_rsvps')
                    .select('event_id, status, player_id')
                    .in('event_id', eventIds);

                const counts = {};
                const myStatusByEvent = {};
                // Resolve which player_id(s) belong to this user so we can
                // also highlight which button is "mine".
                const mine = await resolveWritablePlayers(user?.id, profile?.role);
                const myIds = new Set(mine.map(m => m.id));
                (allRsvps || []).forEach(r => {
                    if (!counts[r.event_id]) counts[r.event_id] = { going: 0, not_going: 0, vacation: 0, total: 0 };
                    if (counts[r.event_id][r.status] !== undefined) counts[r.event_id][r.status]++;
                    counts[r.event_id].total++;
                    if (myIds.has(r.player_id)) myStatusByEvent[r.event_id] = r.status;
                });
                setRsvpCounts(counts);
                setRsvps(myStatusByEvent);
            }
        } catch (err) {
            console.error('Error fetching events:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, [teamId, showAllTeams, user?.id, weekOffset]);

    // Handle RSVP. Applies to EVERY linked kid the user can write for —
    // multi-kid families RSVP everyone in one tap. RLS blocks writes for
    // kids not on the event's team, so a worst-case stray upsert no-ops.
    const handleRsvp = async (eventId, status) => {
        if (!user?.id) return;
        const targets = await resolveWritablePlayers(user.id, profile?.role);
        if (targets.length === 0) {
            toast.warning("Can't RSVP — your account isn't linked to a player yet. Enter your guardian code.");
            return;
        }

        const { ok, errors } = await upsertRsvpForMany(eventId, targets.map(t => t.id), status);
        if (!ok) {
            const msg = errors[0]?.error?.message || 'unknown error';
            console.error('Error updating RSVP:', errors);
            toast.error(`Couldn't save RSVP: ${msg}`);
        } else {
            setRsvps(prev => ({ ...prev, [eventId]: status }));
            toast.success(`${namesList(targets)} marked ${statusLabel(status)}.`);
        }
    };

    // Request notification permission
    const requestNotifications = async () => {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            setNotificationsEnabled(permission === 'granted');
            if (permission === 'granted') {
                // Store preference
                localStorage.setItem('notifications_enabled', 'true');
            }
        }
    };

    // Check notification status on mount
    useEffect(() => {
        if ('Notification' in window) {
            setNotificationsEnabled(Notification.permission === 'granted');
        }
    }, []);

    // Format time
    const formatTime = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    // Format date header - abbreviated to fit narrow columns
    const formatDateHeader = (date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const compareDate = new Date(date);
        compareDate.setHours(0, 0, 0, 0);

        const diffDays = Math.round((compareDate - today) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'TDY';
        if (diffDays === 1) return 'TMR';
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    };

    // Get events for a specific date
    const getEventsForDate = (date) => {
        return events.filter(event => {
            const eventDate = new Date(event.start_time);
            return eventDate.toDateString() === date.toDateString();
        });
    };

    // Count RSVPs for an event
    const getRsvpCounts = async (eventId) => {
        const { data } = await supabase
            .from('event_rsvps')
            .select('status')
            .eq('event_id', eventId);
        
        return {
            going: (data || []).filter(r => r.status === 'going').length,
            maybe: (data || []).filter(r => r.status === 'maybe').length,
            notGoing: (data || []).filter(r => r.status === 'not_going').length,
        };
    };

    if (loading) {
        return (
            <div className="glass-panel p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-5 h-5 text-brand-green" />
                    <h3 className="text-white font-bold">Upcoming Week</h3>
                </div>
                <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-panel p-4 sm:p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-brand-green" />
                    <h3 className="text-white font-bold">
                        {showAllTeams ? 'All Events' : 'Upcoming Week'}
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                    {/* Add Event Button (Coach/Manager only) */}
                    {isCoachOrManager && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="p-2 rounded-lg bg-brand-green/10 text-brand-green hover:bg-brand-green/20 transition-colors"
                            title="Add Event"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    )}

                    {/* Notification Toggle */}
                    <button
                        onClick={requestNotifications}
                        className={`p-2 rounded-lg transition-colors ${
                            notificationsEnabled
                                ? 'bg-brand-green/20 text-brand-green'
                                : 'bg-white/5 text-gray-400 hover:text-white'
                        }`}
                        title={notificationsEnabled ? 'Notifications On' : 'Enable Notifications'}
                    >
                        {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                    </button>

                    {/* Week Navigation */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setWeekOffset(prev => prev - 1)}
                            className="p-1 hover:bg-white/10 rounded"
                        >
                            <ChevronLeft className="w-4 h-4 text-gray-400" />
                        </button>
                        <button
                            onClick={() => setWeekOffset(0)}
                            className="px-2 py-1 text-xs text-gray-400 hover:text-white"
                        >
                            Today
                        </button>
                        <button
                            onClick={() => setWeekOffset(prev => prev + 1)}
                            className="p-1 hover:bg-white/10 rounded"
                        >
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Date Range Display */}
            <p className="text-xs text-gray-500 mb-4">
                {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>

            {/* 7-Day Grid */}
            <div className="grid grid-cols-7 gap-1 mb-4">
                {dates.map((date, idx) => {
                    const dayEvents = getEventsForDate(date);
                    const isToday = date.toDateString() === new Date().toDateString();
                    const hasEvents = dayEvents.length > 0;

                    return (
                        <div
                            key={idx}
                            className={`text-center p-2 rounded-lg transition-colors ${
                                isToday 
                                    ? 'bg-brand-green/20 border border-brand-green/50' 
                                    : hasEvents 
                                        ? 'bg-white/5 border border-white/10' 
                                        : 'bg-white/[0.02]'
                            }`}
                        >
                            <div className={`text-[10px] uppercase font-bold ${isToday ? 'text-brand-green' : 'text-gray-500'}`}>
                                {formatDateHeader(date)}
                            </div>
                            <div className={`text-lg font-bold ${isToday ? 'text-brand-green' : 'text-white'}`}>
                                {date.getDate()}
                            </div>
                            {hasEvents && (
                                <div className="flex justify-center gap-0.5 mt-1">
                                    {dayEvents.slice(0, 3).map((event, i) => {
                                        const style = EVENT_STYLES[event.type] || EVENT_STYLES.practice;
                                        return (
                                            <div
                                                key={i}
                                                className={`w-1.5 h-1.5 rounded-full ${style.bg.replace('/20', '')}`}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Events List */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {events.length === 0 ? (
                    <div className="text-center py-8">
                        <Calendar className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">No events this week</p>
                        <p className="text-gray-600 text-xs mt-1">Check back later or create an event</p>
                    </div>
                ) : (
                    events.map((event) => {
                        const style = EVENT_STYLES[event.type] || EVENT_STYLES.practice;
                        const Icon = style.icon;
                        const myRsvp = rsvps[event.id];
                        const counts = rsvpCounts[event.id] || { going: 0, not_going: 0, vacation: 0, total: 0 };
                        const eventDate = new Date(event.start_time);

                        return (
                            <div
                                key={event.id}
                                className={`p-3 rounded-lg border ${style.border} ${style.bg} hover:bg-white/10 transition-colors cursor-pointer`}
                                onClick={() => setOpenEventDetail(event)}
                            >
                                {/* Event Header */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        <div className={`p-2 rounded-lg ${style.bg} ${style.color}`}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-white font-bold text-sm truncate">{event.title}</h4>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {formatTime(event.start_time)}
                                                </span>
                                                <span>•</span>
                                                <span>{eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                                            </div>
                                            {showAllTeams && event.teams && (
                                                <p className="text-xs text-gray-500 mt-1">{event.teams.name}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Current RSVP Status */}
                                    {myRsvp && (
                                        <div className={`px-2 py-1 rounded text-xs font-bold ${
                                            myRsvp === 'going' ? 'bg-green-500/20 text-green-400' :
                                            myRsvp === 'vacation' ? 'bg-sky-500/20 text-sky-400' :
                                            'bg-red-500/20 text-red-400'
                                        }`}>
                                            {myRsvp === 'going' ? '✓ Going' : myRsvp === 'vacation' ? '✈ Vacation' : '✗ Out'}
                                        </div>
                                    )}
                                </div>

                                {/* Attendance summary line — same idea as Byga. Always
                                    visible before click so the coach/parent can read the
                                    headcount at a glance. Tap the card to drill in. */}
                                <div className="mt-2 flex items-center gap-3 text-[11px]">
                                    {counts.total === 0 ? (
                                        <span className="text-gray-500 italic">No RSVPs yet — tap to manage</span>
                                    ) : (
                                        <>
                                            {counts.going > 0    && <span className="text-green-400 font-bold">{counts.going} going</span>}
                                            {counts.not_going > 0 && <span className="text-red-400 font-bold">{counts.not_going} out</span>}
                                            {counts.vacation > 0 && <span className="text-sky-400 font-bold">{counts.vacation} vacation</span>}
                                            <span className="text-gray-500 ml-auto">Tap for details</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Legend */}
            {!compact && (
                <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-3">
                    {Object.entries(EVENT_STYLES).slice(0, 4).map(([type, style]) => {
                        const Icon = style.icon;
                        return (
                            <div key={type} className="flex items-center gap-1 text-xs text-gray-500">
                                <Icon className={`w-3 h-3 ${style.color}`} />
                                <span className="capitalize">{type}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Event Modal */}
            {showCreateModal && (
                <CreateEventModal
                    onClose={() => setShowCreateModal(false)}
                    onEventCreated={() => fetchEvents()}
                />
            )}

            {/* Event Detail Modal — consistent with CalendarHub: tap an event
                anywhere → see the full attendance breakdown (going / out /
                vacation / no response). Staff also get coach-override controls
                inside this modal. */}
            {openEventDetail && (
                <Suspense fallback={null}>
                    <EventDetailModal
                        event={openEventDetail}
                        onClose={() => { setOpenEventDetail(null); fetchEvents(); }}
                        onOpenLineup={(e) => { setOpenEventDetail(null); setOpenLineupEvent(e); }}
                    />
                </Suspense>
            )}

            {/* Lineup builder — rendered at UpcomingWeek level so it gets
                the whole viewport, not nested inside EventDetailModal. */}
            {openLineupEvent && (
                <Suspense fallback={null}>
                    <LineupBuilder event={openLineupEvent} onClose={() => setOpenLineupEvent(null)} />
                </Suspense>
            )}
        </div>
    );
};

export default UpcomingWeek;
