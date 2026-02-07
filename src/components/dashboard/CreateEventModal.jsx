import React, { useState } from 'react';
import { X, Calendar, Clock, MapPin, Trophy, Users, Coffee } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

const CreateEventModal = ({ onClose, onEventCreated }) => {
    const { user, profile } = useAuth();
    const [eventType, setEventType] = useState('practice'); // 'practice', 'game', 'social'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [formData, setFormData] = useState({
        title: '',
        date: '',
        startTime: '',
        endTime: '',
        location: '',
        notes: '',
        opponentName: '',
        videoUrl: ''
    });

    // Preset Titles based on type
    const handleTypeChange = (type) => {
        setEventType(type);
        if (type === 'practice') setFormData(prev => ({ ...prev, title: 'Team Practice' }));
        if (type === 'game') setFormData(prev => ({ ...prev, title: 'Match vs. ' }));
        if (type === 'social') setFormData(prev => ({ ...prev, title: 'Team Dinner' }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // 1. Get Team ID validation
            // Ideally we get this from profile.team_id. 
            // If the user doesn't have a team_id but is a coach, he might need to create a team first?
            let teamId = profile?.team_id;

            // Fallback check (if profile not refreshed)
            if (!teamId) {
                const { data: team } = await supabase.from('teams').select('id').eq('coach_id', user.id).single();
                if (team) teamId = team?.id;
            }

            if (!teamId) {
                throw new Error("You must create a Team before scheduling events.");
            }

            // 2. Format Dates
            // Input date is YYYY-MM-DD. Time is HH:MM.
            // Combine to ISO Timestamp.
            const startDateTime = new Date(`${formData.date}T${formData.startTime}:00`);

            let endDateTime = null;
            if (formData.endTime) {
                endDateTime = new Date(`${formData.date}T${formData.endTime}:00`);
            } else {
                // Default 90 mins
                endDateTime = new Date(startDateTime.getTime() + 90 * 60000);
            }

            // 3. Insert to Supabase
            const { data, error } = await supabase
                .from('events')
                .insert({
                    team_id: teamId,
                    title: formData.title,
                    type: eventType,
                    start_time: startDateTime.toISOString(),
                    end_time: endDateTime.toISOString(),
                    location_name: formData.location,
                    notes: formData.notes,
                    created_by: user.id,
                    opponent_name: eventType === 'game' ? (formData.opponentName || null) : null,
                    video_url: eventType === 'game' ? (formData.videoUrl || null) : null
                })
                .select()
                .single();

            if (error) throw error;

            onEventCreated(data);
            onClose();

        } catch (err) {
            console.error("Error creating event:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-brand-dark border border-white/10 w-full max-w-lg rounded-xl shadow-2xl relative overflow-hidden">
                {/* Header */}
                <div className="bg-gray-900/50 p-6 border-b border-white/10 flex justify-between items-center">
                    <h2 className="text-xl text-white font-display uppercase font-bold tracking-wider">
                        Add <span className="text-brand-green">Event</span>
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6">
                    {error && (
                        <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Type Selection */}
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                type="button"
                                onClick={() => handleTypeChange('practice')}
                                className={`p-3 rounded-lg border flex flex-col items-center justify-center gap-2 transition-all ${eventType === 'practice' ? 'bg-brand-green text-brand-dark border-brand-green font-bold shadow-lg' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'}`}
                            >
                                <Calendar className="w-5 h-5" />
                                <span className="uppercase font-display text-[10px] tracking-wider">Practice</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleTypeChange('game')}
                                className={`p-3 rounded-lg border flex flex-col items-center justify-center gap-2 transition-all ${eventType === 'game' ? 'bg-brand-gold text-brand-dark border-brand-gold font-bold shadow-lg' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'}`}
                            >
                                <Trophy className="w-5 h-5" />
                                <span className="uppercase font-display text-[10px] tracking-wider">Game</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleTypeChange('social')}
                                className={`p-3 rounded-lg border flex flex-col items-center justify-center gap-2 transition-all ${eventType === 'social' ? 'bg-purple-500 text-white border-purple-500 font-bold shadow-lg' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'}`}
                            >
                                <Coffee className="w-5 h-5" />
                                <span className="uppercase font-display text-[10px] tracking-wider">Social</span>
                            </button>
                        </div>

                        {/* Fields */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-gray-500 text-xs uppercase font-bold mb-1">Event Title</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full bg-black/30 border border-white/10 rounded px-4 py-2 text-white text-sm focus:border-brand-green outline-none"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-500 text-xs uppercase font-bold mb-1">Date</label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full bg-black/30 border border-white/10 rounded px-4 py-2 text-white text-sm focus:border-brand-green outline-none"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-gray-500 text-xs uppercase font-bold mb-1">Start</label>
                                        <input
                                            type="time"
                                            value={formData.startTime}
                                            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                            className="w-full bg-black/30 border border-white/10 rounded px-2 py-2 text-white text-sm focus:border-brand-green outline-none"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-500 text-xs uppercase font-bold mb-1">End</label>
                                        <input
                                            type="time"
                                            value={formData.endTime}
                                            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                            className="w-full bg-black/30 border border-white/10 rounded px-2 py-2 text-white text-sm focus:border-brand-green outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-gray-500 text-xs uppercase font-bold mb-1">Location</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input
                                        type="text"
                                        placeholder="e.g. Field 4 or Mercyhealth Sportscore 2"
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        className="w-full bg-black/30 border border-white/10 rounded pl-10 pr-4 py-2 text-white text-sm focus:border-brand-green outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-gray-500 text-xs uppercase font-bold mb-1">Notes (Optional)</label>
                                <textarea
                                    rows="2"
                                    placeholder="e.g. Wear grey kit, bring water."
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full bg-black/30 border border-white/10 rounded px-4 py-2 text-white text-sm focus:border-brand-green outline-none resize-none"
                                />
                            </div>

                            {/* Game-specific fields */}
                            {eventType === 'game' && (
                                <>
                                    <div>
                                        <label className="block text-gray-500 text-xs uppercase font-bold mb-1">Opponent</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Rapids FC"
                                            value={formData.opponentName}
                                            onChange={(e) => setFormData({ ...formData, opponentName: e.target.value })}
                                            className="w-full bg-black/30 border border-white/10 rounded px-4 py-2 text-white text-sm focus:border-brand-green outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-500 text-xs uppercase font-bold mb-1">YouTube Stream URL (Optional)</label>
                                        <input
                                            type="url"
                                            placeholder="https://youtube.com/watch?v=..."
                                            value={formData.videoUrl}
                                            onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                                            className="w-full bg-black/30 border border-white/10 rounded px-4 py-2 text-white text-sm focus:border-brand-green outline-none"
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="pt-2 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded text-gray-400 hover:text-white hover:bg-white/5 transition-colors uppercase font-bold text-xs tracking-wider"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2 rounded bg-brand-green text-brand-dark font-display font-bold uppercase tracking-wider hover:bg-white hover:scale-105 transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] disabled:opacity-50"
                            >
                                {loading ? 'Saving...' : 'Create Event'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreateEventModal;
