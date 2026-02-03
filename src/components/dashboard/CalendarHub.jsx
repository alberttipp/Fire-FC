import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, MapPin, Clock, Users, Plus, CheckCircle, XCircle, HelpCircle, Shirt, StickyNote, Download, ChevronLeft, ChevronRight, X, ClipboardList, Play, Pause, SkipForward, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import CreateEventModal from './CreateEventModal';

const CalendarHub = () => {
    const { user, profile } = useAuth();
    const [events, setEvents] = useState([]);
    const [viewDate, setViewDate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [rsvps, setRsvps] = useState({}); // { eventId: status }
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [eventSessions, setEventSessions] = useState([]);
    const [loadingSessions, setLoadingSessions] = useState(false);

    // Session Runner State
    const [runningSession, setRunningSession] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    const [currentDrillIndex, setCurrentDrillIndex] = useState(0);
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [alarmsEnabled, setAlarmsEnabled] = useState(true);
    const timerRef = useRef(null);

    // Fetch Events & RSVPs
    const fetchEvents = async () => {
        try {
            setLoading(true);

            // Determine Team ID
            let teamId = profile?.team_id;
            // Fallback for Coaches who haven't refreshed profile
            if (!teamId && user) {
                const { data: team } = await supabase.from('teams').select('id').eq('coach_id', user.id).single();
                if (team) teamId = team.id;
            }

            if (!teamId) {
                setLoading(false);
                return;
            }

            // 1. Fetch Events for this Team
            const { data: eventData, error: eventError } = await supabase
                .from('events')
                .select('*')
                .eq('team_id', teamId)
                .order('start_time', { ascending: true });

            if (eventError) throw eventError;

            // 2. Fetch My RSVPs
            let myRsvps = {};
            if (user) {
                const { data: rsvpData } = await supabase
                    .from('event_rsvps')
                    .select('event_id, status')
                    .eq('player_id', user.id);

                if (rsvpData) {
                    rsvpData.forEach(r => myRsvps[r.event_id] = r.status);
                }
            }

            setEvents(eventData || []);
            setRsvps(myRsvps);

        } catch (err) {
            console.error("Error loading calendar:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, [user, viewDate, profile]);

    // Handle RSVP Action
    const handleRsvp = async (eventId, status) => {
        try {
            // Optimistic Update
            setRsvps(prev => ({ ...prev, [eventId]: status }));

            const { error } = await supabase
                .from('event_rsvps')
                .upsert({
                    event_id: eventId,
                    player_id: user.id,
                    status: status,
                    updated_at: new Date()
                }, { onConflict: 'event_id, player_id' });

            if (error) throw error;

            console.log(`RSVP Updated: ${status}`);
        } catch (err) {
            console.error("RSVP Failed:", err);
            alert("Failed to update RSVP");
        }
    };

    // Fetch practice sessions for a selected event
    const fetchEventSessions = async (eventId) => {
        try {
            setLoadingSessions(true);
            const { data, error } = await supabase
                .from('practice_sessions')
                .select('*')
                .eq('event_id', eventId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setEventSessions(data || []);
        } catch (err) {
            console.error('Error fetching event sessions:', err);
            setEventSessions([]);
        } finally {
            setLoadingSessions(false);
        }
    };

    // Handle event click
    const handleEventClick = (event) => {
        setSelectedEvent(event);
        fetchEventSessions(event.id);
    };

    // Session Runner Functions
    const startSession = (session) => {
        // Parse drills if it's a string (from JSONB)
        let drillsData = session.drills;
        if (typeof drillsData === 'string') {
            try {
                drillsData = JSON.parse(drillsData);
            } catch (e) {
                console.error('Failed to parse drills:', e);
                drillsData = null;
            }
        }

        // Handle nested structure: { sessionMeta: {...}, drills: [...] }
        let drills = [];
        if (drillsData && Array.isArray(drillsData.drills)) {
            drills = drillsData.drills;
        } else if (Array.isArray(drillsData)) {
            drills = drillsData;
        }

        // Ensure drills is an array with items
        if (drills.length === 0) {
            alert('No drills in this session');
            return;
        }

        // Create session with flattened drills array
        const sessionWithDrills = { ...session, drills };
        setRunningSession(sessionWithDrills);
        setCurrentDrillIndex(0);
        setTimeRemaining((drills[0].duration || 1) * 60);
        setIsRunning(false);
        setSelectedEvent(null); // Close event modal
    };

    const playAlarm = () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.value = 0.3;
            osc.start();
            setTimeout(() => { osc.stop(); ctx.close(); }, 500);
        } catch (e) {
            console.log('Audio not available');
        }
    };

    // Timer effect
    useEffect(() => {
        if (isRunning && timeRemaining > 0 && runningSession) {
            timerRef.current = setInterval(() => {
                setTimeRemaining(prev => {
                    if (prev <= 1) {
                        if (alarmsEnabled) playAlarm();
                        // Move to next drill
                        if (currentDrillIndex < runningSession.drills.length - 1) {
                            setCurrentDrillIndex(i => i + 1);
                            return runningSession.drills[currentDrillIndex + 1].duration * 60;
                        } else {
                            // All drills complete
                            setIsRunning(false);
                            if (alarmsEnabled) setTimeout(() => playAlarm(), 300);
                            return 0;
                        }
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timerRef.current);
    }, [isRunning, timeRemaining, currentDrillIndex, runningSession, alarmsEnabled]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Helper: Generate .ics
    const downloadIcs = (event) => {
        const formatDate = (date) => date.toISOString().replace(/-|:|\.\d\d\d/g, "");
        const start = formatDate(new Date(event.start_time));
        const end = formatDate(new Date(event.end_time || event.start_time));

        const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${event.title}
DTSTART:${start}
DTEND:${end}
LOCATION:${event.location_name || ''}
DESCRIPTION:${event.type} - ${event.notes || ''}
END:VEVENT
END:VCALENDAR`;

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.setAttribute('download', `${event.title}.ics`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Date Helpers
    const monthName = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header / Controls */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-3xl text-white font-display uppercase font-bold flex items-center gap-3">
                        <CalendarIcon className="w-8 h-8 text-brand-gold" /> Calendar
                    </h2>
                    <p className="text-gray-400 text-sm">Manage your team schedule and availability.</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-white/5 rounded-lg px-2 border border-white/10">
                        <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))} className="p-2 text-gray-400 hover:text-white"><ChevronLeft className="w-5 h-5" /></button>
                        <span className="w-32 text-center text-white font-bold uppercase text-sm">{monthName}</span>
                        <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))} className="p-2 text-gray-400 hover:text-white"><ChevronRight className="w-5 h-5" /></button>
                    </div>

                    {(profile?.role === 'coach' || profile?.role === 'manager') && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-brand-green text-brand-dark px-4 py-2 rounded-lg font-bold uppercase text-sm flex items-center gap-2 hover:bg-white transition-colors"
                        >
                            <Plus className="w-4 h-4" /> Add Event
                        </button>
                    )}
                </div>
            </div>

            {/* Events List (Month View Placeholder for now - listing items) */}
            <div className="space-y-4">
                {events.length === 0 && !loading && (
                    <div className="p-12 text-center border border-dashed border-white/10 rounded-xl">
                        <p className="text-gray-500">No events scheduled for upcoming period.</p>
                    </div>
                )}

                {events.map((event) => {
                    const eventDate = new Date(event.start_time);
                    const isGame = event.type === 'game';
                    const userStatus = rsvps[event.id] || 'unknown';

                    return (
                        <div
                            key={event.id}
                            className={`glass-panel p-6 border-l-4 relative group cursor-pointer hover:bg-white/5 transition-colors ${isGame ? 'border-brand-gold' : 'border-brand-green'}`}
                            onClick={() => handleEventClick(event)}
                        >
                            {isGame && <div className="absolute top-0 right-0 bg-brand-gold text-brand-dark text-xs font-bold px-2 py-1 rounded-bl-lg uppercase">Match Day</div>}

                            <div className="flex flex-col md:flex-row justify-between gap-6">
                                {/* Date Box */}
                                <div className="flex-shrink-0 flex flex-col items-center justify-center w-16 h-16 bg-white/5 rounded-lg border border-white/10">
                                    <span className="text-xs text-gray-400 font-bold uppercase">{eventDate.toLocaleString('default', { month: 'short' })}</span>
                                    <span className="text-2xl text-white font-bold">{eventDate.getDate()}</span>
                                </div>

                                {/* Details */}
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-xl text-white font-bold">{event.title}</h3>
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${isGame ? 'bg-brand-gold/20 text-brand-gold' : 'bg-brand-green/20 text-brand-green'}`}>
                                            {event.type}
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                                        <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-gray-500" /> {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-gray-500" /> {event.location_name || "TBD"}</span>
                                        {event.kit_color && <span className="flex items-center gap-1.5"><Shirt className="w-4 h-4 text-gray-500" /> Kit: {event.kit_color}</span>}
                                    </div>
                                </div>

                                {/* RSVP Actions */}
                                <div className="flex flex-col items-end gap-3" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center gap-2 p-1 bg-white/5 rounded-full border border-white/10">
                                        <button
                                            onClick={() => handleRsvp(event.id, 'going')}
                                            className={`p-2 rounded-full transition-all ${userStatus === 'going' ? 'bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'text-gray-500 hover:text-white'}`}
                                            title="Going"
                                        >
                                            <CheckCircle className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleRsvp(event.id, 'not_going')}
                                            className={`p-2 rounded-full transition-all ${userStatus === 'not_going' ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 'text-gray-500 hover:text-white'}`}
                                            title="Not Going"
                                        >
                                            <XCircle className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleRsvp(event.id, 'maybe')}
                                            className={`p-2 rounded-full transition-all ${userStatus === 'maybe' ? 'bg-yellow-500 text-white' : 'text-gray-500 hover:text-white'}`}
                                            title="Unsure"
                                        >
                                            <HelpCircle className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => downloadIcs(event)}
                                        className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-brand-gold transition-colors font-bold uppercase tracking-wider"
                                    >
                                        <Download className="w-3 h-3" /> Add to Calendar
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {showCreateModal && <CreateEventModal onClose={() => setShowCreateModal(false)} onEventCreated={() => fetchEvents()} />}

            {/* Session Runner Modal */}
            {runningSession && (
                <div className="fixed inset-0 bg-gradient-to-br from-brand-dark via-gray-900 to-black flex flex-col items-center justify-center z-50">
                    {/* Close button */}
                    <button
                        onClick={() => { setRunningSession(null); setIsRunning(false); }}
                        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white"
                    >
                        <X className="w-8 h-8" />
                    </button>

                    {/* Session Title */}
                    <div className="absolute top-4 left-4">
                        <h2 className="text-white font-bold text-xl">{runningSession.name}</h2>
                        <p className="text-gray-400 text-sm">
                            Drill {currentDrillIndex + 1} of {runningSession.drills.length}
                        </p>
                    </div>

                    {/* Sound toggle */}
                    <button
                        onClick={() => setAlarmsEnabled(!alarmsEnabled)}
                        className="absolute top-4 right-16 p-2 text-gray-400 hover:text-white"
                    >
                        {alarmsEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                    </button>

                    {/* Current Drill */}
                    <div className="text-center mb-8">
                        <h3 className="text-4xl md:text-6xl text-white font-bold mb-2">
                            {runningSession.drills[currentDrillIndex]?.name || runningSession.drills[currentDrillIndex]?.title}
                        </h3>
                        {runningSession.drills[currentDrillIndex]?.isCustom && (
                            <span className="text-brand-gold text-sm">[Custom Drill]</span>
                        )}
                    </div>

                    {/* Timer Display */}
                    <div className={`text-9xl md:text-[12rem] font-mono font-bold mb-12 ${timeRemaining <= 10 ? 'text-red-500 animate-pulse' : 'text-brand-green'}`}>
                        {formatTime(timeRemaining)}
                    </div>

                    {/* Controls */}
                    <div className="flex gap-6">
                        <button
                            onClick={() => {
                                setCurrentDrillIndex(0);
                                setTimeRemaining(runningSession.drills[0].duration * 60);
                                setIsRunning(false);
                            }}
                            className="p-4 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
                        >
                            <RotateCcw className="w-8 h-8" />
                        </button>
                        <button
                            onClick={() => setIsRunning(!isRunning)}
                            className="p-8 bg-brand-green rounded-full text-brand-dark hover:bg-brand-green/90 transition-colors"
                        >
                            {isRunning ? <Pause className="w-16 h-16" /> : <Play className="w-16 h-16" />}
                        </button>
                        <button
                            onClick={() => {
                                if (currentDrillIndex < runningSession.drills.length - 1) {
                                    setCurrentDrillIndex(i => i + 1);
                                    setTimeRemaining(runningSession.drills[currentDrillIndex + 1].duration * 60);
                                    setIsRunning(false);
                                }
                            }}
                            disabled={currentDrillIndex >= runningSession.drills.length - 1}
                            className="p-4 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors disabled:opacity-30"
                        >
                            <SkipForward className="w-8 h-8" />
                        </button>
                    </div>

                    {/* Progress bar */}
                    <div className="absolute bottom-20 left-8 right-8">
                        <div className="flex gap-2">
                            {(runningSession.drills || []).map((drill, idx) => (
                                <div
                                    key={idx}
                                    className={`h-2 flex-1 rounded-full transition-colors ${
                                        idx < currentDrillIndex ? 'bg-brand-green' :
                                        idx === currentDrillIndex ? 'bg-brand-gold' : 'bg-white/20'
                                    }`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Upcoming drills */}
                    <div className="absolute bottom-4 left-8 right-8">
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {(runningSession.drills || []).slice(currentDrillIndex + 1, currentDrillIndex + 4).map((drill, idx) => (
                                <div key={idx} className="flex-shrink-0 px-3 py-1 bg-white/10 rounded text-xs text-gray-400">
                                    {drill.name || drill.title} ({drill.duration}m)
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Event Detail Modal */}
            {selectedEvent && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={() => setSelectedEvent(null)}>
                    <div className="bg-brand-dark border border-white/10 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className={`p-4 border-b border-white/10 flex items-center justify-between ${selectedEvent.type === 'game' ? 'bg-brand-gold/10' : 'bg-brand-green/10'}`}>
                            <div>
                                <h3 className="text-xl text-white font-bold">{selectedEvent.title}</h3>
                                <p className="text-sm text-gray-400">
                                    {new Date(selectedEvent.start_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                    {' at '}
                                    {new Date(selectedEvent.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                            <button onClick={() => setSelectedEvent(null)} className="p-2 hover:bg-white/10 rounded-full">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
                            {/* Event Info */}
                            <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {selectedEvent.location_name || 'TBD'}</span>
                                {selectedEvent.kit_color && <span className="flex items-center gap-1.5"><Shirt className="w-4 h-4" /> Kit: {selectedEvent.kit_color}</span>}
                            </div>

                            {selectedEvent.notes && (
                                <div className="p-3 bg-white/5 rounded-lg text-gray-300 text-sm">
                                    {selectedEvent.notes}
                                </div>
                            )}

                            {/* Practice Sessions Section */}
                            <div className="border-t border-white/10 pt-4 mt-4">
                                <h4 className="text-white font-bold flex items-center gap-2 mb-3">
                                    <ClipboardList className="w-5 h-5 text-brand-green" />
                                    Practice Plans
                                </h4>

                                {loadingSessions ? (
                                    <div className="text-gray-500 text-sm">Loading sessions...</div>
                                ) : eventSessions.length === 0 ? (
                                    <div className="text-gray-500 text-sm p-4 border border-dashed border-white/10 rounded-lg text-center">
                                        No practice plans attached to this event.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {eventSessions.map(session => (
                                            <div key={session.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <h5 className="text-white font-bold">{session.name}</h5>
                                                    <span className="text-xs text-gray-400">{session.total_duration} min</span>
                                                </div>

                                                {/* Drills List */}
                                                {(() => {
                                                    let drillsData = session.drills;
                                                    if (typeof drillsData === 'string') {
                                                        try { drillsData = JSON.parse(drillsData); } catch (e) { drillsData = null; }
                                                    }
                                                    // Handle nested structure: { sessionMeta: {...}, drills: [...] }
                                                    let drills = [];
                                                    if (drillsData && Array.isArray(drillsData.drills)) {
                                                        drills = drillsData.drills;
                                                    } else if (Array.isArray(drillsData)) {
                                                        drills = drillsData;
                                                    }
                                                    if (drills.length === 0) return null;
                                                    return (
                                                        <div className="space-y-2 mt-3">
                                                            {drills.map((drill, idx) => (
                                                                <div key={idx} className="flex items-center justify-between text-sm py-1 border-b border-white/5 last:border-0">
                                                                    <span className="text-gray-300">
                                                                        {idx + 1}. {drill.name || drill.title}
                                                                        {drill.isCustom && <span className="ml-2 text-xs text-brand-gold">[Custom]</span>}
                                                                    </span>
                                                                    <span className="text-gray-500">{drill.duration}m</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })()}

                                                {/* Run Button */}
                                                <button
                                                    onClick={() => startSession(session)}
                                                    className="mt-3 w-full py-2 bg-brand-green/20 text-brand-green rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-brand-green/30 transition-colors"
                                                >
                                                    <Play className="w-4 h-4" /> Run Session
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarHub;
