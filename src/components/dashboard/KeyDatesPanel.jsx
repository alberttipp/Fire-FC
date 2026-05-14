import React, { useEffect, useMemo, useState } from 'react';
import {
    CalendarDays, MapPin, Plus, Pencil, Trash2, X, Save,
    UserPlus, Trophy, AlertCircle, Star, Calendar, Loader2,
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';

// The 5 event "types" that count as key dates. Matches the original
// inline ClubView filter so existing data shows up unchanged.
const KEY_DATE_TYPES = [
    { value: 'tryout',       label: 'Tryout' },
    { value: 'tournament',   label: 'Tournament' },
    { value: 'break',        label: 'Break / No Practice' },
    { value: 'season_start', label: 'Season Start' },
    { value: 'season_end',   label: 'Season End' },
];

// Staff roles that can manage key dates. Matches the events table's
// existing "Coaches can manage events" RLS policy (coach/manager).
const STAFF_ROLES = new Set(['coach', 'manager', 'head_coach', 'assistant_coach', 'team_manager']);

const iconForType = (type) => {
    switch (type) {
        case 'tryout':       return <UserPlus    className="w-4 h-4 text-green-400" />;
        case 'tournament':   return <Trophy      className="w-4 h-4 text-yellow-400" />;
        case 'break':        return <AlertCircle className="w-4 h-4 text-orange-400" />;
        case 'season_start': return <Star        className="w-4 h-4 text-blue-400" />;
        case 'season_end':   return <Calendar    className="w-4 h-4 text-red-400" />;
        default:             return <CalendarDays className="w-4 h-4 text-gray-400" />;
    }
};

// Format a timestamptz into the two strings the date+time inputs want.
// Local-time, so when the coach picks "Mar 15 at 10am" that's what stores.
const isoToFormParts = (iso) => {
    if (!iso) return { date: '', time: '' };
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return {
        date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
};

const KeyDatesPanel = () => {
    const { user } = useAuth();
    const toast = useToast();

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    // The teams this user is staff on. First one becomes the default
    // team_id when creating a new key date (events.team_id is NOT NULL).
    const [staffTeams, setStaffTeams] = useState([]); // [{id, name, role, org_id}]

    // Modal state
    const [editing, setEditing] = useState(null); // null = closed; {} = new; object = editing existing
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    const canEdit = staffTeams.length > 0;

    // ---- Fetch ----
    const fetchKeyDates = async () => {
        const today = new Date();
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .in('type', KEY_DATE_TYPES.map(t => t.value))
            .gte('start_time', today.toISOString())
            .order('start_time', { ascending: true })
            .limit(20);
        if (error) {
            console.error('[KeyDatesPanel] fetch failed:', error);
            toast.error("Couldn't load key dates.");
            setItems([]);
        } else {
            setItems(data || []);
        }
    };

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await fetchKeyDates();

            // Find the teams where this user is staff. We need a team_id +
            // org_id to insert events, so this is required for canEdit.
            if (user?.id) {
                const { data: memberships } = await supabase
                    .from('team_memberships')
                    .select('team_id, role, teams!inner(id, name, org_id)')
                    .eq('user_id', user.id);
                const staff = (memberships || [])
                    .filter(m => STAFF_ROLES.has(m.role))
                    .map(m => ({
                        id: m.teams.id,
                        name: m.teams.name,
                        role: m.role,
                        org_id: m.teams.org_id,
                    }));
                setStaffTeams(staff);
            }
            setLoading(false);
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    // ---- Modal helpers ----
    const openNew = () => {
        if (!canEdit) return;
        setEditing({
            isNew: true,
            title: '',
            type: 'tournament',
            date: '',
            time: '',
            location_name: '',
            notes: '',
            team_id: staffTeams[0]?.id || '',
        });
    };
    const openEdit = (row) => {
        const { date, time } = isoToFormParts(row.start_time);
        setEditing({
            isNew: false,
            id: row.id,
            title: row.title || '',
            type: row.type || 'tournament',
            date,
            time,
            location_name: row.location_name || '',
            notes: row.notes || '',
            team_id: row.team_id,
        });
    };
    const closeModal = () => { if (!saving) setEditing(null); };

    const save = async () => {
        if (!editing) return;
        if (!editing.title.trim()) { toast.error('Title is required.'); return; }
        if (!editing.date)         { toast.error('Date is required.');  return; }
        if (!editing.team_id)      { toast.error('No team selected.');  return; }

        const start_time = editing.time
            ? new Date(`${editing.date}T${editing.time}`).toISOString()
            : new Date(`${editing.date}T00:00`).toISOString();

        const row = {
            title: editing.title.trim(),
            type: editing.type,
            start_time,
            location_name: editing.location_name?.trim() || null,
            notes: editing.notes?.trim() || null,
        };

        setSaving(true);
        try {
            if (editing.isNew) {
                // Need org_id for the team — pull it from staffTeams cache
                const team = staffTeams.find(t => t.id === editing.team_id);
                const insertRow = {
                    ...row,
                    team_id: editing.team_id,
                    org_id: team?.org_id,
                    created_by: user?.id || null,
                };
                const { error } = await supabase.from('events').insert(insertRow);
                if (error) throw error;
                toast.success('Key date added.');
            } else {
                const { error } = await supabase.from('events').update(row).eq('id', editing.id);
                if (error) throw error;
                toast.success('Key date updated.');
            }
            await fetchKeyDates();
            setEditing(null);
        } catch (err) {
            console.error('[KeyDatesPanel] save failed:', err);
            const msg = err?.message || 'Save failed.';
            toast.error(msg.includes('policy') || msg.includes('permission')
                ? "You don't have permission to save this key date."
                : `Save failed: ${msg}`);
        } finally {
            setSaving(false);
        }
    };

    const remove = async (row) => {
        if (!confirm(`Delete "${row.title}"?`)) return;
        setDeletingId(row.id);
        try {
            const { error } = await supabase.from('events').delete().eq('id', row.id);
            if (error) throw error;
            toast.success('Key date deleted.');
            await fetchKeyDates();
        } catch (err) {
            console.error('[KeyDatesPanel] delete failed:', err);
            toast.error(err?.message || 'Delete failed.');
        } finally {
            setDeletingId(null);
        }
    };

    // ---- Render ----
    return (
        <div className="glass-panel p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg text-brand-gold font-display uppercase font-bold flex items-center gap-2">
                    <CalendarDays className="w-5 h-5" /> Key Dates
                </h3>
                {canEdit && (
                    <button
                        onClick={openNew}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-brand-gold/15 border border-brand-gold/40 text-brand-gold hover:bg-brand-gold/25 transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                )}
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {loading ? (
                    <div className="text-center text-gray-500 text-sm py-6">Loading…</div>
                ) : items.length === 0 ? (
                    <div className="text-center py-8">
                        <CalendarDays className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">No key dates yet</p>
                        {canEdit && (
                            <p className="text-gray-600 text-xs mt-1">Tap "Add" to set tryouts, tournaments, season starts, breaks, etc.</p>
                        )}
                    </div>
                ) : (
                    items.map((date) => {
                        const eventDate = new Date(date.start_time);
                        return (
                            <div
                                key={date.id}
                                className="p-3 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-colors group"
                            >
                                <div className="flex items-start gap-3">
                                    {iconForType(date.type)}
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-white font-bold text-sm truncate">{date.title}</h4>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {eventDate.toLocaleDateString('en-US', {
                                                weekday: 'short',
                                                month: 'short',
                                                day: 'numeric',
                                                year: eventDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
                                            })}
                                            {date.start_time && eventDate.getHours() + eventDate.getMinutes() > 0 && (
                                                <> · {eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</>
                                            )}
                                        </p>
                                        {date.location_name && (
                                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                                <MapPin className="w-3 h-3" /> {date.location_name}
                                            </p>
                                        )}
                                    </div>
                                    {canEdit && (
                                        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => openEdit(date)}
                                                aria-label="Edit"
                                                className="p-1.5 rounded hover:bg-white/10 text-gray-300 hover:text-white"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => remove(date)}
                                                disabled={deletingId === date.id}
                                                aria-label="Delete"
                                                className="p-1.5 rounded hover:bg-red-500/10 text-gray-400 hover:text-red-400 disabled:opacity-50"
                                            >
                                                {deletingId === date.id ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Add / Edit Modal */}
            {editing && (
                <div
                    className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4 animate-fade-in"
                    onClick={closeModal}
                >
                    <div
                        className="bg-brand-dark border border-white/10 rounded-t-2xl md:rounded-2xl w-full md:max-w-md max-h-[90vh] overflow-y-auto shadow-2xl relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={closeModal}
                            disabled={saving}
                            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 border border-white/20 text-white hover:bg-white hover:text-brand-dark transition-colors flex items-center justify-center"
                            aria-label="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="p-6 pb-[max(1.5rem,env(safe-area-inset-bottom)+1rem)]">
                            <h3 className="text-xl font-display uppercase font-bold text-white tracking-wider mb-1">
                                {editing.isNew ? 'Add key date' : 'Edit key date'}
                            </h3>
                            <p className="text-xs text-gray-500 mb-5">
                                Tryouts, tournaments, season boundaries, breaks — anything families should know in advance.
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-1.5">Title</label>
                                    <input
                                        type="text"
                                        value={editing.title}
                                        onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green"
                                        placeholder="e.g. Summer Tournament"
                                    />
                                </div>

                                <div>
                                    <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-1.5">Type</label>
                                    <select
                                        value={editing.type}
                                        onChange={(e) => setEditing({ ...editing, type: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green"
                                    >
                                        {KEY_DATE_TYPES.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-1.5">Date</label>
                                        <input
                                            type="date"
                                            value={editing.date}
                                            onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-1.5">Time (optional)</label>
                                        <input
                                            type="time"
                                            value={editing.time}
                                            onChange={(e) => setEditing({ ...editing, time: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-1.5">Location (optional)</label>
                                    <input
                                        type="text"
                                        value={editing.location_name}
                                        onChange={(e) => setEditing({ ...editing, location_name: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green"
                                        placeholder="Regional Complex"
                                    />
                                </div>

                                {staffTeams.length > 1 && (
                                    <div>
                                        <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-1.5">Team</label>
                                        <select
                                            value={editing.team_id}
                                            onChange={(e) => setEditing({ ...editing, team_id: e.target.value })}
                                            disabled={!editing.isNew}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green disabled:opacity-60"
                                        >
                                            {staffTeams.map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-1.5">Notes (optional)</label>
                                    <textarea
                                        value={editing.notes}
                                        onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                                        rows={2}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green resize-none"
                                        placeholder="Anything families should know"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={closeModal}
                                    disabled={saving}
                                    className="flex-1 py-2.5 rounded-lg border border-white/10 text-gray-300 text-sm font-bold uppercase tracking-wider hover:bg-white/5 transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={save}
                                    disabled={saving}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-brand-gold text-black text-sm font-bold uppercase tracking-wider hover:bg-brand-gold/90 disabled:opacity-50 transition-colors"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {saving ? 'Saving' : (editing.isNew ? 'Add' : 'Save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KeyDatesPanel;
