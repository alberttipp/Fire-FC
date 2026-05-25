import React, { useState, useRef, useMemo } from 'react';
import { X, Calendar, Clock, MapPin, Trophy, Users, Coffee, Sparkles } from 'lucide-react';
import { toBlob } from 'html-to-image';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import CoverPreview from '../event-cover/CoverPreview';
import { TEMPLATES, BACKGROUNDS, defaultTemplateForEvent } from '../event-cover/templates';

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
    { value: 'red',    label: 'Red',    color: '#dc2626', stroke: '#7f1d1d' },
    { value: 'white',  label: 'White',  color: '#f8fafc', stroke: '#475569' },
    { value: 'custom', label: 'Custom', color: 'transparent', stroke: '#9ca3af' }, // opens 3-piece picker
];

// 3-piece custom kit color sets (Albert's specs 2026-05-19).
const SHIRT_COLORS = [
    { value: 'navy',    color: '#1e3a8a' },
    { value: 'orange',  color: '#f97316' },
    { value: 'crimson', color: '#991b1b' },
];
const SHORTS_COLORS = [
    { value: 'black', color: '#0a0a0a' },
    { value: 'navy',  color: '#1e3a8a' },
    { value: 'grey',  color: '#6b7280' },
];
const SOCKS_COLORS = [
    { value: 'grey',  color: '#6b7280' },
    { value: 'black', color: '#0a0a0a' },
    { value: 'navy',  color: '#1e3a8a' },
];

// Resolve a stored kit value to a CSS color for preview swatches.
function kitColorToCss(name) {
    const all = [...SHIRT_COLORS, ...SHORTS_COLORS, ...SOCKS_COLORS];
    const found = all.find(c => c.value === name);
    if (found) return found.color;
    // Back-compat: red/white were stored as the literal name in old events.
    if (name === 'red') return '#dc2626';
    if (name === 'white') return '#f8fafc';
    return name; // assume it's already a CSS color
}

const LOCATION_PRESETS = [
    { value: 'Field 101',    label: 'Field 101' },
    { value: 'Field 102',    label: 'Field 102' },
    { value: 'Sportscore 1', label: 'Sportscore 1' },
    { value: 'OTHER',        label: 'Other (type your own)…' },
];

// Small color-picker row used inside the custom kit panel.
function KitColorRow({ label, options, value, onChange }) {
    return (
        <div className="flex items-center gap-3">
            <span className="text-[11px] uppercase tracking-wider text-gray-400 font-bold w-14 shrink-0">{label}</span>
            <div className="flex gap-2 flex-wrap">
                {options.map(o => (
                    <button
                        key={o.value}
                        type="button"
                        onClick={() => onChange(o.value)}
                        className={`w-9 h-9 rounded-full border-2 transition-all ${value === o.value ? 'border-brand-gold scale-110 ring-2 ring-brand-gold/40' : 'border-white/20 hover:border-white/40'}`}
                        style={{ background: o.color }}
                        title={o.value}
                        aria-label={o.value}
                    />
                ))}
            </div>
            <span className="text-[11px] text-gray-500 capitalize">{value || '—'}</span>
        </div>
    );
}

// Tiny CSS-string parser for the background swatches in the picker.
function parseInlineCss(cssString) {
    const out = {};
    cssString.trim().split(';').forEach(part => {
        const i = part.indexOf(':');
        if (i < 0) return;
        const k = part.slice(0, i).trim();
        const v = part.slice(i + 1).trim();
        if (k && v) out[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
    });
    return out;
}

// existingEvent: when present, modal acts in EDIT mode (pre-fills fields,
// UPDATEs instead of INSERTs, skips chat auto-post). When null, normal
// CREATE flow.
const CreateEventModal = ({ onClose, onEventCreated, defaultType = 'practice', defaultDate = null, existingEvent = null }) => {
    const { user, profile } = useAuth();
    const isEditMode = !!existingEvent;
    const [eventType, setEventType] = useState(existingEvent?.type || defaultType);
    const [coverChoice, setCoverChoice] = useState(() => existingEvent?.cover_template || defaultTemplateForEvent(existingEvent?.type || defaultType));
    const [customBgImage, setCustomBgImage] = useState(null); // data URL when user uploads
    const [coverEnabled, setCoverEnabled] = useState(!isEditMode); // edit mode: cover stays as-is unless user explicitly re-creates
    const coverRef = useRef(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Pre-fill locationChoice from an existing event by matching against
    // presets; falls back to OTHER + populating locationOther.
    const initialLocationChoice = (() => {
        if (!existingEvent?.location_name) return 'Field 101';
        const match = LOCATION_PRESETS.find(p => p.value === existingEvent.location_name && p.value !== 'OTHER');
        return match ? match.value : 'OTHER';
    })();

    // Detect if an existing event was using a custom (3-piece) kit:
    // either it has a shorts/socks color set, or its shirt is one of
    // the custom-only shirt colors (navy/orange/crimson).
    const existingIsCustomKit = !!(existingEvent?.kit_shorts_color || existingEvent?.kit_socks_color ||
        ['navy', 'orange', 'crimson'].includes(existingEvent?.kit_color));

    const [formData, setFormData] = useState({
        title: existingEvent?.title || (defaultType === 'practice' ? 'Team Practice' : defaultType === 'social' ? 'Team Dinner' : ''),
        date: existingEvent?.start_time ? formatDateInput(new Date(existingEvent.start_time)) : formatDateInput(defaultDate),
        startTime: existingEvent?.start_time ? new Date(existingEvent.start_time).toTimeString().slice(0, 5) : '',
        endTime: existingEvent?.end_time ? new Date(existingEvent.end_time).toTimeString().slice(0, 5) : '',
        notes: existingEvent?.notes || '',
        opponentName: existingEvent?.opponent_name || '',
        videoUrl: existingEvent?.video_url || '',
        kitColor: existingEvent?.kit_color || '',
        // 3-piece custom kit (used when useCustomKit === true)
        kitShortsColor: existingEvent?.kit_shorts_color || '',
        kitSocksColor:  existingEvent?.kit_socks_color  || '',
        useCustomKit: existingIsCustomKit,
        locationChoice: initialLocationChoice,
        locationOther: initialLocationChoice === 'OTHER' ? (existingEvent?.location_name || '') : '',
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

    // Keep the cover-template default in sync with event-type changes —
    // user shouldn't get a "match day" cover on a practice event by
    // accident. They can still pick a different template manually.
    React.useEffect(() => {
        setCoverChoice(c => {
            const def = defaultTemplateForEvent(eventType);
            // Only auto-switch if user is still on the previous type's default.
            if (TEMPLATES.find(t => t.id === c.template)?.eventTypes?.includes(eventType)) return c;
            return def;
        });
    }, [eventType]);

    // Synthetic event for the live preview — uses whatever the user has
    // typed in the form so far.
    const previewEvent = useMemo(() => ({
        type: eventType,
        title: eventType === 'game'
            ? `Fire Vs ${(formData.opponentName || 'TBD').trim()}`
            : (formData.title || 'TEAM EVENT'),
        start_time: formData.date && formData.startTime
            ? new Date(`${formData.date}T${formData.startTime}:00`).toISOString()
            : null,
        location_name: formData.locationChoice === 'OTHER'
            ? (formData.locationOther || '').trim()
            : formData.locationChoice,
        opponent_name: formData.opponentName,
        kit_color: formData.kitColor,
        kit_shorts_color: formData.kitShortsColor,
        kit_socks_color: formData.kitSocksColor,
        team_name: 'ROCKFORD FIRE',
    }), [formData, eventType]);

    // Apply custom uploaded bg into the cover choice object so CoverPreview
    // picks it up. coverChoice.bg='custom' + coverChoice.bgImage=dataURL.
    const effectiveCoverChoice = useMemo(() => (
        customBgImage ? { ...coverChoice, bg: 'custom', bgImage: customBgImage } : coverChoice
    ), [coverChoice, customBgImage]);

    const handleBgUpload = (file) => {
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { setError('Background image must be under 5 MB.'); return; }
        const reader = new FileReader();
        reader.onload = (e) => setCustomBgImage(e.target.result);
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Resolve team_id — for edit mode, take from existingEvent.
            let teamId = existingEvent?.team_id || profile?.team_id;
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

            const opponent = (formData.opponentName || '').trim();
            const resolvedTitle = eventType === 'game'
                ? `Fire Vs ${opponent || 'TBD'}`
                : (formData.title || '').trim();

            if (!resolvedLocation) throw new Error('Pick a location.');

            // Build row. Kit fields: when useCustomKit, write shorts+socks.
            // Otherwise clear them (Red / White have no shorts/socks).
            const customKit = formData.useCustomKit;
            const eventRow = {
                team_id: teamId,
                title: resolvedTitle,
                type: eventType,
                start_time: startDateTime.toISOString(),
                end_time: endDateTime.toISOString(),
                location_name: resolvedLocation,
                notes: formData.notes,
                opponent_name: eventType === 'game' ? (opponent || null) : null,
                video_url: eventType === 'game' ? (formData.videoUrl || null) : null,
                kit_color: eventType === 'game' ? (formData.kitColor || null) : null,
                kit_shorts_color: eventType === 'game' && customKit ? (formData.kitShortsColor || null) : null,
                kit_socks_color:  eventType === 'game' && customKit ? (formData.kitSocksColor  || null) : null,
            };

            let data, error;
            if (isEditMode) {
                const res = await supabase
                    .from('events')
                    .update(eventRow)
                    .eq('id', existingEvent.id)
                    .select()
                    .single();
                data = res.data; error = res.error;
            } else {
                const res = await supabase
                    .from('events')
                    .insert({ ...eventRow, created_by: user.id })
                    .select()
                    .single();
                data = res.data; error = res.error;
            }

            if (error) throw error;

            // Cover image: render the picked template to PNG, upload to
            // storage, UPDATE the just-created event row with the URL,
            // then auto-post into the team chat. All best-effort — a
            // cover failure shouldn't roll back the event itself.
            // Edit mode: only re-render the cover if user toggled it on
            // (coverEnabled is false by default in edit mode). Also skip
            // chat auto-post on edits to avoid noise.
            if (coverEnabled && coverRef.current) {
                try {
                    const blob = await toBlob(coverRef.current, {
                        width: 1200, height: 630, pixelRatio: 1, cacheBust: true, backgroundColor: '#000',
                    });
                    if (blob) {
                        const path = `event-covers/${teamId}/${data.id}-${Date.now()}.png`;
                        const { error: upErr } = await supabase.storage
                            .from('media')
                            .upload(path, blob, { contentType: 'image/png', upsert: true });
                        if (!upErr) {
                            const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
                            await supabase
                                .from('events')
                                .update({ cover_image_url: publicUrl, cover_template: coverChoice })
                                .eq('id', data.id);
                            data.cover_image_url = publicUrl;
                            data.cover_template = coverChoice;

                            // Auto-post into the team chat — only on
                            // create. On edit we don't want to spam the
                            // chat every time someone tweaks the time.
                            if (!isEditMode) {
                                const { data: convo } = await supabase
                                    .from('conversations')
                                    .select('id, org_id')
                                    .eq('team_id', teamId)
                                    .eq('type', 'team')
                                    .limit(1)
                                    .maybeSingle();
                                if (convo?.id) {
                                    await supabase.from('messages').insert({
                                        conversation_id: convo.id,
                                        sender_id: user.id,
                                        content: publicUrl,
                                        message_type: 'image',
                                        sender_name: profile?.full_name || 'Coach',
                                        sender_role: profile?.role || 'coach',
                                        org_id: convo.org_id,
                                    });
                                }
                            }
                        } else {
                            console.warn('[CreateEventModal] cover upload failed:', upErr);
                        }
                    }
                } catch (coverErr) {
                    console.warn('[CreateEventModal] cover render/upload failed:', coverErr);
                }
            }

            if (!isEditMode) {
                const { data: convo } = await supabase
                    .from('conversations')
                    .select('id, org_id')
                    .eq('team_id', teamId)
                    .eq('type', 'team')
                    .limit(1)
                    .maybeSingle();
                if (convo?.id) {
                    const when = new Date(startDateTime).toLocaleString([], {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                    });
                    const locationText = resolvedLocation ? ` at ${resolvedLocation}` : '';
                    await supabase.from('messages').insert({
                        conversation_id: convo.id,
                        sender_id: user.id,
                        content: `${resolvedTitle} on ${when}${locationText}`,
                        message_type: 'announcement',
                        sender_name: profile?.full_name || 'Coach',
                        sender_role: profile?.role || 'coach',
                        org_id: convo.org_id,
                    });
                }
            }

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
                        {isEditMode ? <>Edit <span className="text-brand-gold">Event</span></> : <>Add <span className="text-brand-green">Event</span></>}
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

                            {/* Game-specific: Kit picker (Red / White / Custom 3-piece) */}
                            {eventType === 'game' && (
                                <div>
                                    <label className="block text-gray-500 text-xs uppercase font-bold mb-2">Kit</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {/* Red */}
                                        <button
                                            type="button"
                                            onClick={() => setFormData(f => ({ ...f, useCustomKit: false, kitColor: 'red', kitShortsColor: '', kitSocksColor: '' }))}
                                            className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 transition-all ${!formData.useCustomKit && formData.kitColor === 'red' ? 'bg-brand-gold/10 border-brand-gold' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                                        >
                                            <JerseySwatch color="#dc2626" stroke="#7f1d1d" size={36} />
                                            <span className="uppercase text-[10px] tracking-wider font-bold text-gray-300">Red</span>
                                        </button>
                                        {/* White */}
                                        <button
                                            type="button"
                                            onClick={() => setFormData(f => ({ ...f, useCustomKit: false, kitColor: 'white', kitShortsColor: '', kitSocksColor: '' }))}
                                            className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 transition-all ${!formData.useCustomKit && formData.kitColor === 'white' ? 'bg-brand-gold/10 border-brand-gold' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                                        >
                                            <JerseySwatch color="#f8fafc" stroke="#475569" size={36} />
                                            <span className="uppercase text-[10px] tracking-wider font-bold text-gray-300">White</span>
                                        </button>
                                        {/* Custom */}
                                        <button
                                            type="button"
                                            onClick={() => setFormData(f => ({ ...f, useCustomKit: true, kitColor: f.kitColor && !['red','white'].includes(f.kitColor) ? f.kitColor : 'navy' }))}
                                            className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 transition-all ${formData.useCustomKit ? 'bg-brand-gold/10 border-brand-gold' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                                        >
                                            <div className="w-9 h-9 rounded border-2 border-dashed border-gray-500 flex items-center justify-center text-[10px] text-gray-400 font-bold">3pc</div>
                                            <span className="uppercase text-[10px] tracking-wider font-bold text-gray-300">Custom</span>
                                        </button>
                                    </div>

                                    {/* 3-piece custom kit pickers */}
                                    {formData.useCustomKit && (
                                        <div className="mt-3 space-y-3 p-3 bg-black/30 rounded-lg border border-white/10">
                                            <KitColorRow label="Shirt"  options={SHIRT_COLORS}  value={formData.kitColor}
                                                onChange={(v) => setFormData(f => ({ ...f, kitColor: v }))} />
                                            <KitColorRow label="Shorts" options={SHORTS_COLORS} value={formData.kitShortsColor}
                                                onChange={(v) => setFormData(f => ({ ...f, kitShortsColor: v }))} />
                                            <KitColorRow label="Socks"  options={SOCKS_COLORS}  value={formData.kitSocksColor}
                                                onChange={(v) => setFormData(f => ({ ...f, kitSocksColor: v }))} />
                                        </div>
                                    )}
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

                            {/* Cover image — template + bg picker with live preview.
                                Auto-renders on submit + posts to team chat. */}
                            <div className="border-t border-white/10 pt-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-gray-300 text-xs uppercase font-bold flex items-center gap-1.5">
                                        <Sparkles className="w-3.5 h-3.5 text-brand-gold" /> Cover image
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setCoverEnabled(v => !v)}
                                        className={`px-2 py-1 text-[10px] uppercase tracking-wider rounded ${coverEnabled ? 'bg-brand-green text-brand-dark font-bold' : 'bg-white/10 text-gray-400'}`}
                                    >
                                        {coverEnabled ? 'On' : 'Off'}
                                    </button>
                                </div>

                                {coverEnabled && (
                                    <>
                                        {/* Live preview at half scale */}
                                        <div className="flex justify-center bg-black/40 p-2 rounded-lg">
                                            <div style={{ width: 600, height: 315, overflow: 'hidden' }}>
                                                <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left' }}>
                                                    <CoverPreview ref={coverRef} event={previewEvent} choice={effectiveCoverChoice} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Template buttons */}
                                        <div>
                                            <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1.5">Template</div>
                                            <div className="grid grid-cols-3 gap-2">
                                                {TEMPLATES.map(t => (
                                                    <button
                                                        key={t.id}
                                                        type="button"
                                                        onClick={() => setCoverChoice(c => ({ ...c, template: t.id }))}
                                                        className={`p-2 rounded text-left text-xs border transition-colors ${coverChoice.template === t.id ? 'bg-brand-gold/15 border-brand-gold/50 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}
                                                    >
                                                        <div className="font-bold">{t.label}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Background buttons + upload */}
                                        <div>
                                            <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1.5">Background</div>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                {BACKGROUNDS.map(b => (
                                                    <button
                                                        key={b.id}
                                                        type="button"
                                                        onClick={() => { setCustomBgImage(null); setCoverChoice(c => ({ ...c, bg: b.id })); }}
                                                        className={`relative p-2 rounded text-left text-[11px] border h-14 overflow-hidden ${(coverChoice.bg === b.id && !customBgImage) ? 'border-brand-gold ring-2 ring-brand-gold/40' : 'border-white/10 hover:border-white/30'}`}
                                                        style={parseInlineCss(b.css)}
                                                    >
                                                        <div className="absolute inset-0 bg-black/30" />
                                                        <div className="relative text-white font-bold uppercase tracking-wider">{b.label}</div>
                                                    </button>
                                                ))}
                                                {/* Upload custom bg */}
                                                <label className={`relative p-2 rounded text-left text-[11px] border h-14 overflow-hidden bg-white/5 cursor-pointer flex items-center justify-center gap-1 ${customBgImage ? 'border-brand-gold ring-2 ring-brand-gold/40' : 'border-white/10 hover:border-white/30'}`}
                                                    style={customBgImage ? { backgroundImage: `url(${customBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                                                >
                                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleBgUpload(e.target.files?.[0])} />
                                                    <div className="absolute inset-0 bg-black/40" />
                                                    <div className="relative text-white font-bold uppercase tracking-wider text-center">
                                                        {customBgImage ? '✓ Custom' : '⬆ Upload'}
                                                    </div>
                                                </label>
                                            </div>
                                            {customBgImage && (
                                                <button type="button" onClick={() => setCustomBgImage(null)} className="text-[10px] text-gray-500 hover:text-white mt-2">
                                                    Clear custom background
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
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
                                {loading ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Create Event')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreateEventModal;
