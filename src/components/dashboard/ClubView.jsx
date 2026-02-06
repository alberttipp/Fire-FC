import React, { useState, useEffect } from 'react';
import { 
    Users, Trophy, Calendar, Plus, UserPlus, ClipboardList, 
    Mic, Send, Clock, MapPin, ChevronRight, Star, FileText,
    CalendarDays, AlertCircle
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import UpcomingWeek from './UpcomingWeek';
import VoiceScoutingNotes from './VoiceScoutingNotes';

const ClubView = () => {
    const { user, profile } = useAuth();
    const [stats, setStats] = useState({ players: 0, teams: 0, events: 0 });
    const [waitlist, setWaitlist] = useState([]);
    const [keyDates, setKeyDates] = useState([]);
    const [showAddWaitlist, setShowAddWaitlist] = useState(false);
    const [showScoutingNotes, setShowScoutingNotes] = useState(false);
    const [recentNotes, setRecentNotes] = useState([]);
    const [newProspect, setNewProspect] = useState({ name: '', email: '', phone: '', age_group: '', notes: '' });
    const [loading, setLoading] = useState(true);
    const [addError, setAddError] = useState(null);
    const [adding, setAdding] = useState(false);

    // Lock body scroll when modal is open (prevents background movement on mobile)
    useEffect(() => {
        if (showAddWaitlist || showScoutingNotes) {
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
        } else {
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
        }
        return () => {
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
        };
    }, [showAddWaitlist, showScoutingNotes]);

    // Fetch club stats
    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                // Get player count
                const { count: playerCount } = await supabase
                    .from('players')
                    .select('*', { count: 'exact', head: true });

                // Get team count
                const { count: teamCount } = await supabase
                    .from('teams')
                    .select('*', { count: 'exact', head: true });

                // Get events this week
                const today = new Date();
                const nextWeek = new Date(today);
                nextWeek.setDate(nextWeek.getDate() + 7);

                const { count: eventCount } = await supabase
                    .from('events')
                    .select('*', { count: 'exact', head: true })
                    .gte('start_time', today.toISOString())
                    .lte('start_time', nextWeek.toISOString());

                setStats({
                    players: playerCount || 0,
                    teams: teamCount || 0,
                    events: eventCount || 0
                });

                // Fetch tryout waitlist
                const { data: waitlistData } = await supabase
                    .from('tryout_waitlist')
                    .select('*')
                    .order('created_at', { ascending: false });

                setWaitlist(waitlistData || []);

                // Fetch key dates (future events marked as key dates or specific types)
                const { data: keyDateData } = await supabase
                    .from('events')
                    .select('*')
                    .in('type', ['tryout', 'tournament', 'break', 'season_start', 'season_end'])
                    .gte('start_time', today.toISOString())
                    .order('start_time', { ascending: true })
                    .limit(10);

                setKeyDates(keyDateData || []);

                // Fetch recent scouting notes
                const { data: notesData } = await supabase
                    .from('scouting_notes')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(3);

                setRecentNotes(notesData || []);

            } catch (err) {
                console.error('Error fetching club stats:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    // Add prospect to waitlist
    const handleAddProspect = async (e) => {
        e.preventDefault();
        setAddError(null);
        setAdding(true);

        try {
            const { error } = await supabase
                .from('tryout_waitlist')
                .insert([{
                    name: newProspect.name,
                    email: newProspect.email || null,
                    phone: newProspect.phone || null,
                    age_group: newProspect.age_group || null,
                    notes: newProspect.notes || null,
                    status: 'pending'
                }]);

            if (error) throw error;

            // Refresh waitlist
            const { data } = await supabase
                .from('tryout_waitlist')
                .select('*')
                .order('created_at', { ascending: false });

            setWaitlist(data || []);
            setNewProspect({ name: '', email: '', phone: '', age_group: '', notes: '' });
            setShowAddWaitlist(false);
        } catch (err) {
            console.error('Error adding prospect:', err);
            setAddError(err.message || 'Failed to add prospect');
        } finally {
            setAdding(false);
        }
    };

    // Copy waitlist signup link
    const copyWaitlistLink = () => {
        const link = `${window.location.origin}/tryout-signup`;
        navigator.clipboard.writeText(link);
        alert('Waitlist signup link copied!');
    };

    // Sample key dates if none exist
    const displayKeyDates = keyDates.length > 0 ? keyDates : [
        { id: 1, title: 'Spring Tryouts', start_time: '2026-03-15T10:00:00', type: 'tryout', location_name: 'Main Field' },
        { id: 2, title: 'Winter Season Ends', start_time: '2026-02-28T18:00:00', type: 'season_end' },
        { id: 3, title: 'Spring Break - No Practice', start_time: '2026-03-20T00:00:00', type: 'break' },
        { id: 4, title: 'Spring Season Starts', start_time: '2026-04-01T00:00:00', type: 'season_start' },
        { id: 5, title: 'Summer Tournament', start_time: '2026-06-15T08:00:00', type: 'tournament', location_name: 'Regional Complex' },
    ];

    const getKeyDateIcon = (type) => {
        switch (type) {
            case 'tryout': return <UserPlus className="w-4 h-4 text-green-400" />;
            case 'tournament': return <Trophy className="w-4 h-4 text-yellow-400" />;
            case 'break': return <AlertCircle className="w-4 h-4 text-orange-400" />;
            case 'season_start': return <Star className="w-4 h-4 text-blue-400" />;
            case 'season_end': return <Calendar className="w-4 h-4 text-red-400" />;
            default: return <CalendarDays className="w-4 h-4 text-gray-400" />;
        }
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 border-l-4 border-brand-gold">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-400 text-sm uppercase tracking-wider">Total Players</p>
                            <h3 className="text-4xl text-white font-display font-bold">{stats.players}</h3>
                        </div>
                        <Users className="text-brand-gold w-8 h-8 opacity-50" />
                    </div>
                </div>

                <div className="glass-panel p-6 border-l-4 border-brand-green">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-400 text-sm uppercase tracking-wider">Active Teams</p>
                            <h3 className="text-4xl text-white font-display font-bold">{stats.teams}</h3>
                        </div>
                        <Trophy className="text-brand-green w-8 h-8 opacity-50" />
                    </div>
                </div>

                <div className="glass-panel p-6 border-l-4 border-blue-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-400 text-sm uppercase tracking-wider">Events This Week</p>
                            <h3 className="text-4xl text-white font-display font-bold">{stats.events}</h3>
                        </div>
                        <Calendar className="text-blue-500 w-8 h-8 opacity-50" />
                    </div>
                </div>
            </div>

            {/* Main Grid: Calendar + Key Dates */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* All Events Calendar */}
                <div className="lg:col-span-2">
                    <UpcomingWeek showAllTeams={true} />
                </div>

                {/* Key Dates - Next 6-12 Months */}
                <div className="glass-panel p-6">
                    <h3 className="text-lg text-brand-gold font-display uppercase font-bold mb-4 flex items-center gap-2">
                        <CalendarDays className="w-5 h-5" /> Key Dates
                    </h3>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {displayKeyDates.map((date) => {
                            const eventDate = new Date(date.start_time);
                            return (
                                <div
                                    key={date.id}
                                    className="p-3 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
                                >
                                    <div className="flex items-start gap-3">
                                        {getKeyDateIcon(date.type)}
                                        <div className="flex-1">
                                            <h4 className="text-white font-bold text-sm">{date.title}</h4>
                                            <p className="text-xs text-gray-400 mt-1">
                                                {eventDate.toLocaleDateString('en-US', { 
                                                    weekday: 'short', 
                                                    month: 'short', 
                                                    day: 'numeric',
                                                    year: eventDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                                                })}
                                            </p>
                                            {date.location_name && (
                                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                                    <MapPin className="w-3 h-3" /> {date.location_name}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Recruiting Tools Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tryout Waitlist */}
                <div className="glass-panel p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg text-brand-green font-display uppercase font-bold flex items-center gap-2">
                            <ClipboardList className="w-5 h-5" /> Tryout Waitlist
                        </h3>
                        <div className="flex gap-2">
                            <button
                                onClick={copyWaitlistLink}
                                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-gray-300 hover:bg-white/10 transition-colors flex items-center gap-1"
                            >
                                <Send className="w-3 h-3" /> Share Link
                            </button>
                            <button
                                onClick={() => setShowAddWaitlist(true)}
                                className="px-3 py-1.5 bg-brand-green/10 border border-brand-green/30 rounded text-xs text-brand-green hover:bg-brand-green/20 transition-colors flex items-center gap-1"
                            >
                                <Plus className="w-3 h-3" /> Add
                            </button>
                        </div>
                    </div>

                    {waitlist.length === 0 ? (
                        <div className="text-center py-8">
                            <UserPlus className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                            <p className="text-gray-500 text-sm">No prospects on waitlist</p>
                            <p className="text-gray-600 text-xs mt-1">Share the signup link to collect interest</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {waitlist.map((prospect) => (
                                <div
                                    key={prospect.id}
                                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-brand-green/20 text-brand-green flex items-center justify-center text-xs font-bold">
                                            {prospect.name?.charAt(0) || '?'}
                                        </div>
                                        <div>
                                            <p className="text-white font-bold text-sm">{prospect.name}</p>
                                            <p className="text-xs text-gray-500">{prospect.age_group || 'Age TBD'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                            prospect.status === 'contacted' ? 'bg-blue-500/20 text-blue-400' :
                                            prospect.status === 'scheduled' ? 'bg-green-500/20 text-green-400' :
                                            'bg-yellow-500/20 text-yellow-400'
                                        }`}>
                                            {prospect.status || 'pending'}
                                        </span>
                                        <ChevronRight className="w-4 h-4 text-gray-500" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* AI Scouting Notes */}
                <div className="glass-panel p-6">
                    <h3 className="text-lg text-brand-gold font-display uppercase font-bold mb-4 flex items-center gap-2">
                        <Mic className="w-5 h-5" /> Scouting Notes
                    </h3>
                    <div className="text-center py-6">
                        <Mic className="w-12 h-12 text-brand-gold/30 mx-auto mb-3" />
                        <p className="text-gray-400 text-sm mb-4">
                            Record voice notes during tryouts
                        </p>
                        <button 
                            onClick={() => setShowScoutingNotes(true)}
                            className="px-6 py-3 bg-brand-gold/10 border border-brand-gold/30 rounded-full text-brand-gold hover:bg-brand-gold/20 transition-colors flex items-center gap-2 mx-auto"
                        >
                            <Mic className="w-5 h-5" />
                            <span className="font-bold">Open Notes</span>
                        </button>
                    </div>
                    
                    {/* Recent Notes */}
                    <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-xs text-gray-500 uppercase font-bold mb-3">Recent Notes</p>
                        <div className="space-y-2 max-h-[150px] overflow-y-auto">
                            {recentNotes.length === 0 ? (
                                <p className="text-xs text-gray-600 text-center py-2">No notes recorded yet</p>
                            ) : (
                                recentNotes.map(note => (
                                    <div key={note.id} className="p-3 bg-white/5 rounded-lg">
                                        <p className="text-sm text-gray-300 line-clamp-2">"{note.note_text}"</p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {note.player_name && `${note.player_name} • `}
                                            {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* Add Prospect Modal - Moved outside grid to prevent overlap */}
            {showAddWaitlist && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={() => setShowAddWaitlist(false)}>
                    <div
                        className="bg-brand-dark border border-white/10 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-xl text-white font-bold mb-4">Add to Waitlist</h3>
                        <form onSubmit={handleAddProspect} className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-400 uppercase">Name *</label>
                                <input
                                    type="text"
                                    value={newProspect.name}
                                    onChange={(e) => setNewProspect({ ...newProspect, name: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-400 uppercase">Email</label>
                                    <input
                                        type="email"
                                        value={newProspect.email}
                                        onChange={(e) => setNewProspect({ ...newProspect, email: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 uppercase">Phone</label>
                                    <input
                                        type="tel"
                                        value={newProspect.phone}
                                        onChange={(e) => setNewProspect({ ...newProspect, phone: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 uppercase">Age Group</label>
                                <select
                                    value={newProspect.age_group}
                                    onChange={(e) => setNewProspect({ ...newProspect, age_group: e.target.value })}
                                    className="w-full bg-[#1a1a2e] border border-white/10 rounded p-2 text-white mt-1"
                                >
                                    <option value="" className="bg-[#1a1a2e]">Select...</option>
                                    <option value="U8" className="bg-[#1a1a2e]">U8</option>
                                    <option value="U9" className="bg-[#1a1a2e]">U9</option>
                                    <option value="U10" className="bg-[#1a1a2e]">U10</option>
                                    <option value="U11" className="bg-[#1a1a2e]">U11</option>
                                    <option value="U12" className="bg-[#1a1a2e]">U12</option>
                                    <option value="U13" className="bg-[#1a1a2e]">U13</option>
                                    <option value="U14" className="bg-[#1a1a2e]">U14</option>
                                    <option value="U15+" className="bg-[#1a1a2e]">U15+</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 uppercase">Notes</label>
                                <textarea
                                    value={newProspect.notes}
                                    onChange={(e) => setNewProspect({ ...newProspect, notes: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1 h-20 resize-none"
                                    placeholder="Position, experience, referred by..."
                                />
                            </div>
                            {addError && (
                                <div className="p-3 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm">
                                    {addError}
                                </div>
                            )}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowAddWaitlist(false); setAddError(null); }}
                                    className="flex-1 py-2 border border-white/10 rounded text-gray-400 hover:bg-white/5"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={adding}
                                    className="flex-1 py-2 bg-brand-green text-white rounded font-bold hover:bg-brand-green/90 disabled:opacity-50"
                                >
                                    {adding ? 'Saving...' : 'Add Prospect'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Voice Scouting Notes Modal */}
            {showScoutingNotes && (
                <VoiceScoutingNotes onClose={() => setShowScoutingNotes(false)} />
            )}
        </div>
    );
};

export default ClubView;
