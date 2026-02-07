import React, { useState, useEffect } from 'react';
import { Car, Hand, MapPin, Users, Loader2, X, Trash2, Plus, Calendar } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

const CarpoolVolunteerView = () => {
    const { user, profile } = useAuth();
    const [events, setEvents] = useState([]);
    const [signups, setSignups] = useState({}); // { eventId: [signup, ...] }
    const [loading, setLoading] = useState(true);
    const [teamId, setTeamId] = useState(null);
    const [showModal, setShowModal] = useState(null); // { eventId, type }
    const [modalForm, setModalForm] = useState({ seats: 3, location: '', role: '' });
    const [submitting, setSubmitting] = useState(false);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (showModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [showModal]);

    useEffect(() => {
        if (user?.id) getTeamId();
    }, [user]);

    useEffect(() => {
        if (teamId) fetchData();
    }, [teamId]);

    const getTeamId = async () => {
        if (profile?.team_id) {
            setTeamId(profile.team_id);
            return;
        }

        const { data: membership } = await supabase
            .from('team_memberships')
            .select('team_id')
            .eq('user_id', user.id)
            .limit(1)
            .single();

        if (membership?.team_id) {
            setTeamId(membership.team_id);
            return;
        }

        const { data: family } = await supabase
            .from('family_members')
            .select('player_id')
            .eq('user_id', user.id)
            .limit(1)
            .single();

        if (family?.player_id) {
            const { data: player } = await supabase
                .from('players')
                .select('team_id')
                .eq('id', family.player_id)
                .single();

            if (player?.team_id) {
                setTeamId(player.team_id);
                return;
            }
        }

        setLoading(false);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch upcoming events
            const { data: eventData } = await supabase
                .from('events')
                .select('*')
                .eq('team_id', teamId)
                .gte('start_time', new Date().toISOString())
                .order('start_time', { ascending: true })
                .limit(10);

            setEvents(eventData || []);

            if (eventData && eventData.length > 0) {
                const eventIds = eventData.map(e => e.id);

                // Fetch signups with profile names
                const { data: signupData } = await supabase
                    .from('event_signups')
                    .select('*, profiles:user_id(full_name)')
                    .in('event_id', eventIds);

                // Group by event_id
                const grouped = {};
                (signupData || []).forEach(s => {
                    if (!grouped[s.event_id]) grouped[s.event_id] = [];
                    grouped[s.event_id].push(s);
                });
                setSignups(grouped);
            }
        } catch (err) {
            console.error('Error fetching carpool data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async () => {
        if (!showModal) return;
        setSubmitting(true);

        try {
            let details = {};
            if (showModal.type === 'carpool_offer') {
                details = { seats_available: modalForm.seats, pickup_location: modalForm.location.trim() };
            } else if (showModal.type === 'carpool_request') {
                details = { pickup_location: modalForm.location.trim() };
            } else if (showModal.type === 'volunteer') {
                details = { role_name: modalForm.role.trim() };
            }

            const { error } = await supabase
                .from('event_signups')
                .insert({
                    event_id: showModal.eventId,
                    user_id: user.id,
                    type: showModal.type,
                    details
                });

            if (error) throw error;

            setShowModal(null);
            setModalForm({ seats: 3, location: '', role: '' });
            fetchData();
        } catch (err) {
            console.error('Signup error:', err);
            if (err.code === '23505') {
                alert('You already signed up for this.');
            } else {
                alert('Error: ' + (err.message || 'Unknown error'));
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (signupId) => {
        try {
            const { error } = await supabase
                .from('event_signups')
                .delete()
                .eq('id', signupId)
                .eq('user_id', user.id);

            if (error) throw error;
            fetchData();
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    const getTypeLabel = (type) => {
        switch (type) {
            case 'carpool_offer': return 'Offering ride';
            case 'carpool_request': return 'Needs ride';
            case 'volunteer': return 'Volunteering';
            default: return type;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-brand-green" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div>
                <h2 className="text-2xl md:text-3xl text-white font-display uppercase font-bold tracking-wider flex items-center gap-3">
                    <Car className="w-7 h-7 text-brand-green" /> Carpool & Volunteer
                </h2>
                <p className="text-gray-400 text-sm mt-1">Coordinate rides and volunteer for upcoming events</p>
            </div>

            {events.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-xl">
                    <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 font-bold mb-1">No upcoming events</p>
                    <p className="text-gray-500 text-sm">Events will appear here once scheduled.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {events.map(event => {
                        const date = new Date(event.start_time);
                        const eventSignups = signups[event.id] || [];
                        const offers = eventSignups.filter(s => s.type === 'carpool_offer');
                        const requests = eventSignups.filter(s => s.type === 'carpool_request');
                        const volunteers = eventSignups.filter(s => s.type === 'volunteer');
                        const totalSeats = offers.reduce((sum, o) => sum + (o.details?.seats_available || 0), 0);
                        const mySignups = eventSignups.filter(s => s.user_id === user.id);

                        return (
                            <div key={event.id} className="glass-panel overflow-hidden">
                                {/* Event Header */}
                                <div className={`px-5 py-3 flex items-center justify-between border-b border-white/10 ${
                                    event.type === 'game' ? 'bg-brand-gold/10' : event.type === 'practice' ? 'bg-brand-green/10' : 'bg-purple-500/10'
                                }`}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-white/10 flex flex-col items-center justify-center">
                                            <span className="text-[10px] text-gray-400 uppercase font-bold leading-none">
                                                {date.toLocaleDateString('en-US', { month: 'short' })}
                                            </span>
                                            <span className="text-white font-bold leading-none">{date.getDate()}</span>
                                        </div>
                                        <div>
                                            <p className="text-white font-bold text-sm">{event.title}</p>
                                            <p className="text-gray-500 text-xs">
                                                {date.toLocaleDateString('en-US', { weekday: 'short' })} at {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                                {event.location_name && ` · ${event.location_name}`}
                                            </p>
                                        </div>
                                    </div>
                                    {totalSeats > 0 && (
                                        <span className="text-xs text-brand-green bg-brand-green/10 px-2 py-1 rounded-full font-bold">
                                            {totalSeats} seat{totalSeats !== 1 ? 's' : ''} available
                                        </span>
                                    )}
                                </div>

                                <div className="p-5 space-y-4">
                                    {/* Carpool Section */}
                                    <div>
                                        <h4 className="text-xs uppercase font-bold text-gray-400 mb-2 flex items-center gap-2">
                                            <Car className="w-3.5 h-3.5" /> Carpool
                                        </h4>
                                        {offers.length === 0 && requests.length === 0 ? (
                                            <p className="text-gray-600 text-sm">No carpool signups yet</p>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {offers.map(s => (
                                                    <div key={s.id} className="flex items-center justify-between text-sm bg-green-500/5 px-3 py-2 rounded-lg">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-2 h-2 rounded-full bg-green-500" />
                                                            <span className="text-white">{s.profiles?.full_name || 'Unknown'}</span>
                                                            <span className="text-gray-500">—</span>
                                                            <span className="text-green-400 text-xs font-bold">{s.details?.seats_available || '?'} seats</span>
                                                            {s.details?.pickup_location && (
                                                                <span className="text-gray-500 text-xs flex items-center gap-1">
                                                                    <MapPin className="w-3 h-3" /> {s.details.pickup_location}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {s.user_id === user.id && (
                                                            <button onClick={() => handleDelete(s.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                {requests.map(s => (
                                                    <div key={s.id} className="flex items-center justify-between text-sm bg-yellow-500/5 px-3 py-2 rounded-lg">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                                            <span className="text-white">{s.profiles?.full_name || 'Unknown'}</span>
                                                            <span className="text-yellow-400 text-xs font-bold">needs ride</span>
                                                            {s.details?.pickup_location && (
                                                                <span className="text-gray-500 text-xs flex items-center gap-1">
                                                                    <MapPin className="w-3 h-3" /> {s.details.pickup_location}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {s.user_id === user.id && (
                                                            <button onClick={() => handleDelete(s.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Volunteer Section */}
                                    <div>
                                        <h4 className="text-xs uppercase font-bold text-gray-400 mb-2 flex items-center gap-2">
                                            <Hand className="w-3.5 h-3.5" /> Volunteers
                                        </h4>
                                        {volunteers.length === 0 ? (
                                            <p className="text-gray-600 text-sm">No volunteers yet</p>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {volunteers.map(s => (
                                                    <div key={s.id} className="flex items-center justify-between text-sm bg-blue-500/5 px-3 py-2 rounded-lg">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                                                            <span className="text-white">{s.profiles?.full_name || 'Unknown'}</span>
                                                            {s.details?.role_name && (
                                                                <span className="text-blue-400 text-xs font-bold">{s.details.role_name}</span>
                                                            )}
                                                        </div>
                                                        {s.user_id === user.id && (
                                                            <button onClick={() => handleDelete(s.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                                        {!mySignups.find(s => s.type === 'carpool_offer') && (
                                            <button
                                                onClick={() => { setShowModal({ eventId: event.id, type: 'carpool_offer' }); setModalForm({ seats: 3, location: '', role: '' }); }}
                                                className="px-3 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                                            >
                                                <Plus className="w-3 h-3" /> Offer Ride
                                            </button>
                                        )}
                                        {!mySignups.find(s => s.type === 'carpool_request') && (
                                            <button
                                                onClick={() => { setShowModal({ eventId: event.id, type: 'carpool_request' }); setModalForm({ seats: 3, location: '', role: '' }); }}
                                                className="px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                                            >
                                                <Plus className="w-3 h-3" /> Need Ride
                                            </button>
                                        )}
                                        {!mySignups.find(s => s.type === 'volunteer') && (
                                            <button
                                                onClick={() => { setShowModal({ eventId: event.id, type: 'volunteer' }); setModalForm({ seats: 3, location: '', role: '' }); }}
                                                className="px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                                            >
                                                <Hand className="w-3 h-3" /> Volunteer
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Signup Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-brand-dark border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-white font-bold text-lg uppercase">
                                {showModal.type === 'carpool_offer' ? 'Offer a Ride' :
                                 showModal.type === 'carpool_request' ? 'Request a Ride' :
                                 'Volunteer'}
                            </h3>
                            <button onClick={() => setShowModal(null)} className="text-gray-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {showModal.type === 'carpool_offer' && (
                            <>
                                <div>
                                    <label className="block text-gray-500 text-xs uppercase font-bold mb-1">Seats Available</label>
                                    <div className="flex items-center gap-3">
                                        {[1, 2, 3, 4, 5, 6].map(n => (
                                            <button
                                                key={n}
                                                onClick={() => setModalForm(prev => ({ ...prev, seats: n }))}
                                                className={`w-10 h-10 rounded-lg font-bold transition-colors ${
                                                    modalForm.seats === n
                                                        ? 'bg-brand-green text-brand-dark'
                                                        : 'bg-white/10 text-gray-400 hover:bg-white/20'
                                                }`}
                                            >
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-gray-500 text-xs uppercase font-bold mb-1">Pickup Location (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Main St & Oak Ave"
                                        value={modalForm.location}
                                        onChange={(e) => setModalForm(prev => ({ ...prev, location: e.target.value }))}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
                                    />
                                </div>
                            </>
                        )}

                        {showModal.type === 'carpool_request' && (
                            <div>
                                <label className="block text-gray-500 text-xs uppercase font-bold mb-1">Pickup Location</label>
                                <input
                                    type="text"
                                    placeholder="e.g. 123 Elm Street"
                                    value={modalForm.location}
                                    onChange={(e) => setModalForm(prev => ({ ...prev, location: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
                                />
                            </div>
                        )}

                        {showModal.type === 'volunteer' && (
                            <div>
                                <label className="block text-gray-500 text-xs uppercase font-bold mb-1">Role</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Snack duty, Water bottles, Scorekeeper"
                                    value={modalForm.role}
                                    onChange={(e) => setModalForm(prev => ({ ...prev, role: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
                                />
                            </div>
                        )}

                        <button
                            onClick={handleSignup}
                            disabled={submitting || (showModal.type === 'volunteer' && !modalForm.role.trim())}
                            className="w-full py-3 bg-brand-green text-brand-dark font-bold rounded-xl uppercase text-sm hover:bg-white transition-colors disabled:opacity-50"
                        >
                            {submitting ? 'Saving...' : 'Sign Up'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CarpoolVolunteerView;
