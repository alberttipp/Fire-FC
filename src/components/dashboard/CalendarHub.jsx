import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, MapPin, Clock, Users, Plus, CheckCircle, XCircle, HelpCircle, Shirt, StickyNote, Download, ChevronLeft, ChevronRight } from 'lucide-react';
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
                        <div key={event.id} className={`glass-panel p-6 border-l-4 relative group ${isGame ? 'border-brand-gold' : 'border-brand-green'}`}>
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
                                <div className="flex flex-col items-end gap-3">
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
        </div>
    );
};

export default CalendarHub;
