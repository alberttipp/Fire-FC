import React, { useState, useEffect } from 'react';
import { 
    Calendar, MapPin, Clock, Users, ChevronLeft, ChevronRight,
    CheckCircle2, XCircle, HelpCircle, Bell, BellOff, Shirt,
    Trophy, Dumbbell, Coffee, Users2, AlertCircle
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

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
    { status: 'going', icon: CheckCircle2, label: 'Going', color: 'text-green-400 bg-green-500/20 border-green-500' },
    { status: 'maybe', icon: HelpCircle, label: 'Maybe', color: 'text-yellow-400 bg-yellow-500/20 border-yellow-500' },
    { status: 'not_going', icon: XCircle, label: "Can't Go", color: 'text-red-400 bg-red-500/20 border-red-500' },
];

const UpcomingWeek = ({ teamId = null, showAllTeams = false, compact = false }) => {
    const { user, profile } = useAuth();
    const [events, setEvents] = useState([]);
    const [rsvps, setRsvps] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [weekOffset, setWeekOffset] = useState(0);

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
    useEffect(() => {
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

                // Fetch RSVPs for these events
                if (data && data.length > 0 && user?.id) {
                    const eventIds = data.map(e => e.id);
                    const { data: rsvpData } = await supabase
                        .from('event_rsvps')
                        .select('*')
                        .in('event_id', eventIds)
                        .eq('player_id', user.id);

                    const rsvpMap = {};
                    (rsvpData || []).forEach(r => {
                        rsvpMap[r.event_id] = r.status;
                    });
                    setRsvps(rsvpMap);
                }
            } catch (err) {
                console.error('Error fetching events:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, [teamId, showAllTeams, user?.id, weekOffset]);

    // Handle RSVP
    const handleRsvp = async (eventId, status) => {
        if (!user?.id) return;

        try {
            const { error } = await supabase
                .from('event_rsvps')
                .upsert({
                    event_id: eventId,
                    player_id: user.id,
                    status: status,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'event_id,player_id'
                });

            if (error) throw error;

            setRsvps(prev => ({ ...prev, [eventId]: status }));
        } catch (err) {
            console.error('Error updating RSVP:', err);
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

    // Format date header
    const formatDateHeader = (date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const compareDate = new Date(date);
        compareDate.setHours(0, 0, 0, 0);
        
        const diffDays = Math.round((compareDate - today) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
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
                        const eventDate = new Date(event.start_time);

                        return (
                            <div
                                key={event.id}
                                className={`p-3 rounded-lg border ${style.border} ${style.bg} hover:bg-white/10 transition-colors cursor-pointer`}
                                onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
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
                                            myRsvp === 'maybe' ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-red-500/20 text-red-400'
                                        }`}>
                                            {myRsvp === 'going' ? '✓ Going' : myRsvp === 'maybe' ? '? Maybe' : '✗ Not Going'}
                                        </div>
                                    )}
                                </div>

                                {/* Expanded Details */}
                                {selectedEvent?.id === event.id && (
                                    <div className="mt-3 pt-3 border-t border-white/10 space-y-3 animate-fade-in">
                                        {/* Location */}
                                        {event.location_name && (
                                            <div className="flex items-start gap-2 text-sm">
                                                <MapPin className="w-4 h-4 text-gray-500 mt-0.5" />
                                                <div>
                                                    <p className="text-white">{event.location_name}</p>
                                                    {event.location_address && (
                                                        <p className="text-gray-500 text-xs">{event.location_address}</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Arrival Time */}
                                        {event.arrival_time_minutes && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <AlertCircle className="w-4 h-4 text-yellow-500" />
                                                <p className="text-yellow-400">
                                                    Arrive {event.arrival_time_minutes} minutes early
                                                </p>
                                            </div>
                                        )}

                                        {/* Kit Color */}
                                        {event.kit_color && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <Shirt className="w-4 h-4 text-gray-500" />
                                                <p className="text-white">Wear: <span className="font-bold">{event.kit_color}</span></p>
                                            </div>
                                        )}

                                        {/* Notes */}
                                        {event.notes && (
                                            <p className="text-xs text-gray-400 bg-white/5 p-2 rounded">
                                                {event.notes}
                                            </p>
                                        )}

                                        {/* RSVP Buttons */}
                                        <div className="flex gap-2 pt-2">
                                            {RSVP_OPTIONS.map((option) => {
                                                const RsvpIcon = option.icon;
                                                const isSelected = myRsvp === option.status;
                                                return (
                                                    <button
                                                        key={option.status}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRsvp(event.id, option.status);
                                                        }}
                                                        className={`flex-1 flex items-center justify-center gap-1 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                                                            isSelected 
                                                                ? option.color + ' border-current scale-105' 
                                                                : 'border-white/10 text-gray-400 hover:border-white/30 hover:text-white'
                                                        }`}
                                                    >
                                                        <RsvpIcon className="w-4 h-4" />
                                                        {option.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
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
        </div>
    );
};

export default UpcomingWeek;
