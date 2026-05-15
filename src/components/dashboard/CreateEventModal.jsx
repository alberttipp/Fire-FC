import React, { useState } from 'react';
import { X, Calendar, Clock, MapPin, Trophy, Users, Coffee } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

const formatDateInput = (d) => {
    if (!d) return '';
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime())) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

// Inline SVG jersey — fills the body, dark stroke and shaded neckline so it
// reads as a jersey on either bg. White kit gets a light grey stroke so it
// doesn't disappear on the dark modal.
const JerseySwatch = ({ color = '#ef4444', stroke = '#0a0a0a', size = 36 }) => (
    <svg
        viewBox="0 0 100 110"
        width={size}
        height={size}
        aria-hidden="true"
        className="shrink-0"
    >
        <path
            d="M30 10 L18 22 L8 32 L14 50 L22 55 L22 102 L78 102 L78 55 L86 50 L92 32 L82 22 L70 10 L62 22 L50 26 L38 22 Z"
            fill={color}
            stroke={stroke}
            strokeWidth="2"
            strokeLinejoin="round"
        />
        <path
            d="M38 12 Q50 22 62 12"
            fill="none"
            stroke={stroke}
            strokeWidth="2"
        />
    </svg>
);

const KIT_OPTIONS = [
    { value: 'red',   label: 'Red',   color: '#dc2626', stroke: '#7f1d1d' },
    { value: 'white', label: 'White', color: '#f8fafc', stroke: '#475569' },
];

const LOCATION_PRESETS = [
    { value: 'Sportscore 1', label: 'Sportscore 1' },
    { value: 'OTHER',        label: 'Other (type your own)…' },
];

const CreateEventModal = ({ onClose, onEventCreated, defaultType = 'practice', defaultDate = null }) => {
    const { user, profile } = useAuth();
    const [eventType, setEventType] = useState(defaultType); // 'practice', 'game', 'social'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [formData, setFormData] = useState({
        title: defaultType === 'practice' ? 'Team Practice' : defaultType === 'social' ? 'Team Dinner' : '',
        date: formatDateInput(defaultDate),
        startTime: '',
        endTime: '',
        notes: '',
        opponentName: '',
        videoUrl: '',
        kitColor: '',
        // Location: locationChoice is the dropdown value ('Sportscore 1', 'OTHER',
        // or ''); locationOther is the text the user types when 'OTHER' is picked.
        locationChoice: 'Sportscore 1',
        locationOther: '',
    });

    // Title presets per type. Games are special — the title is auto-built
    // from "Fire Vs " + opponent, so the user only types the opponent and
    // we hide the title field entirely.
    const handleTypeChange = (type) => {
        setEventType(type);
        if (type === 'practice') setFormData(prev => ({ ...prev, title: 'Team Practice' }));
        if (type === 'social')   setFormData(prev => ({ ...prev, title: 'Team Dinner' }));
        if (type === 'game')     setFormData(prev => ({ ...prev, title: '' })); // computed at submit
    };

    const resolvedLocation = formData.locationChoice === 'OTHER'
        ? (formData.locationOther || '').trim()
        : formData.locationChoice;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Resolve team_id from profile or memberships fallback
            let teamId = profile?.team_id;
            if (!teamId) {
                const { data: memberships } = await supabase
                    .from('team_memberships')
                    .select('team_id')
                    .eq('user_id', user.id)
                    .limit(1);
                if (memberships?.length > 0) teamId = memberships[0].team_id;
            }
            if (!teamId) throw new Error("You must create a Team before scheduling events.");

            const startDateTime = new Date(`${formData.date}T${formData.startTime}:00`);
            const endDateTime = formData.endTime
                ? new Date(`${formData.date}T${formData.endTime}:00`)
                : new Date(startDateTime.getTime() + 90 * 60000);

            // Resolve title. Games: always "Fire Vs <opponent>", even if the
            // user leaves opponent blank we still get a recognizable label.
            const opponent = (formData.opponentName || '').trim();
            const resolvedTitle = eventType === 'game'
                ? `Fire Vs ${opponent || 'TBD'}`
                : (formData.title || '').trim();

            if (!resolvedLocation) throw new Error('Pick a location.');

            const { data, error } = await supabase
                .from('events')
                .insert({
                    team_id: teamId,
                    title: resolvedTitle,
                    type: eventType,
                    start_time: startDateTime.toISOString(),
                    end_time: endDateTime.toISOString(),
                    location_name: resolvedLocation,
                    notes: formData.notes,
                    created_by: user.id,
                    opponent_name: eventType === 'game' ? (opponent || null) : null,
                    video_url: eventType === 'game' ? (formData.videoUrl || null) : null,
                    kit_color: eventType === 'game' ? (formData.kitColor || null) : null,
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
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center md:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-brand-dark border border-white/10 w-full max-w-lg rounded-xl shadow-2xl relative overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="bg-gray-900/50 p-6 border-b border-white/10 flex justify-between items-center shrink-0">
                    <h2 className="text-xl text-white font-display uppercase font-bold tracking-wider">
                        Add <span className="text-brand-green">Event</span>
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
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
                            {/* Game type: opponent first (drives title); other types: regular title field */}
                            {eventType === 'game' ? (
                                <div>
                                    <label className="block text-gray-500 text-xs uppercase font-bold mb-1">Opponent</label>
                                    <div className="flex items-stretch">
                                        <span className="inline-flex items-center px-3 bg-brand-gold/15 border border-r-0 border-white/10 rounded-l text-brand-gold text-sm font-bold uppercase tracking-wider">
                                            Fire Vs
                                        </span>
                                        <input
                                            type="text"
                                            autoFocus
                                            placeholder="Rapids FC"
                                            value={formData.opponentName}
                                            onChange={(e) => setFormData({ ...formData, opponentName: e.target.value })}
                                            className="flex-1 bg-black/30 border border-white/10 rounded-r px-3 py-2 text-white text-sm focus:border-brand-green outline-none"
                                        />
                                    </div>
                                    <p className="text-[11px] text-gray-500 mt-1">Game title is set automatically: <span className="text-gray-300">Fire Vs {(formData.opponentName || 'TBD').trim() || 'TBD'}</span></p>
                                </div>
                            ) : (
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
                            )}

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
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                                    <select
                                        value={formData.locationChoice}
                                        onChange={(e) => setFormData({ ...formData, locationChoice: e.target.value, locationOther: '' })}
                                        className="w-full bg-black/30 border border-white/10 rounded pl-10 pr-4 py-2 text-white text-sm focus:border-brand-green outline-none appearance-none"
                                    >
                                        {LOCATION_PRESETS.map(opt => (
                                            <option key={opt.value} value={opt.value} className="bg-gray-900">{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                                {formData.locationChoice === 'OTHER' && (
                                    <input
                                        type="text"
                                        autoFocus
                                        placeholder="e.g. Field 4 or Mercyhealth Sportscore Two"
                                        value={formData.locationOther}
                                        onChange={(e) => setFormData({ ...formData, locationOther: e.target.value })}
                                        className="mt-2 w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-white text-sm focus:border-brand-green outline-none"
                                        required
                                    />
                                )}
                            </div>

                            {/* Game-specific: Kit picker */}
                            {eventType === 'game' && (
                                <div>
                                    <label className="block text-gray-500 text-xs uppercase font-bold mb-2">Kit</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {KIT_OPTIONS.map(kit => {
                                            const selected = formData.kitColor === kit.value;
                                            return (
                                                <button
                                                    key={kit.value}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, kitColor: kit.value })}
                                                    className={`p-3 rounded-lg border flex items-center gap-3 transition-all ${selected ? 'bg-brand-gold/10 border-brand-gold shadow-lg' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                                                >
                                                    <JerseySwatch color={kit.color} stroke={kit.stroke} size={40} />
                                                    <span className={`uppercase font-display text-xs tracking-wider font-bold ${selected ? 'text-brand-gold' : 'text-gray-300'}`}>{kit.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-gray-500 text-xs uppercase font-bold mb-1">Notes (Optional)</label>
                                <textarea
                                    rows="2"
                                    placeholder="e.g. Bring water, arrive 30 min early."
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full bg-black/30 border border-white/10 rounded px-4 py-2 text-white text-sm focus:border-brand-green outline-none resize-none"
                                />
                            </div>

                            {/* Game-specific: YouTube stream */}
                            {eventType === 'game' && (
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
