import React, { useEffect, useMemo, useState } from 'react';
import {
    Plus, Calendar, Clock, MapPin, CheckCircle2, X, Save, Loader2,
    Trash2, Edit3, Award, Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import { useConfirm } from '../ConfirmDialog';

// =====================================================================
// Phase B: per-group sessions log + attendance + auto-credit.
// Rendered inside PrivateTrainingView when the "Sessions" tab is active.
// =====================================================================

const STATUS_META = {
    scheduled: { label: 'Scheduled', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
    completed: { label: 'Completed', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
    canceled:  { label: 'Canceled',  cls: 'bg-gray-500/15 text-gray-300 border-gray-500/30' },
};

const isoToFormParts = (iso) => {
    if (!iso) return { date: '', time: '' };
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return {
        date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
};

const PrivateSessionsPanel = ({ groupId, groupName, roster, orgId }) => {
    const { user } = useAuth();
    const toast = useToast();
    const confirm = useConfirm();

    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);   // existing session being edited (metadata)
    const [detailFor, setDetailFor] = useState(null); // session whose attendees we're managing

    // -------- Fetch --------
    const fetchSessions = async () => {
        if (!groupId) { setSessions([]); return; }
        const { data, error } = await supabase
            .from('private_sessions')
            .select('*')
            .eq('team_id', groupId)
            .order('start_time', { ascending: false });
        if (error) {
            console.error('[PrivateSessions] fetch:', error);
            setSessions([]);
        } else {
            setSessions(data || []);
        }
    };

    useEffect(() => {
        (async () => {
            setLoading(true);
            await fetchSessions();
            setLoading(false);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId]);

    const { upcoming, past } = useMemo(() => {
        const now = new Date();
        const up = [], pa = [];
        sessions.forEach(s => {
            if (s.status === 'completed' || new Date(s.start_time) < now) pa.push(s);
            else up.push(s);
        });
        return { upcoming: up.reverse(), past: pa };
    }, [sessions]);

    // -------- Create / Edit --------
    const handleSave = async (form, editingId) => {
        if (!form.title?.trim() && !editingId) {
            // title optional — fall through
        }
        if (!form.date) { toast.error('Pick a date.'); return false; }
        if (!form.startTime) { toast.error('Pick a start time.'); return false; }

        const start = new Date(`${form.date}T${form.startTime}:00`);
        const end = form.endTime ? new Date(`${form.date}T${form.endTime}:00`) : null;

        const row = {
            title: form.title?.trim() || null,
            start_time: start.toISOString(),
            end_time: end ? end.toISOString() : null,
            location_name: form.location?.trim() || null,
            notes: form.notes?.trim() || null,
            default_minutes: form.defaultMinutes ? parseInt(form.defaultMinutes, 10) : 60,
            default_touches: form.defaultTouches ? parseInt(form.defaultTouches, 10) : 200,
        };

        try {
            if (editingId) {
                const { error } = await supabase
                    .from('private_sessions')
                    .update({ ...row, updated_at: new Date().toISOString() })
                    .eq('id', editingId);
                if (error) throw error;
                toast.success('Session updated.');
            } else {
                const { data: inserted, error: sessErr } = await supabase
                    .from('private_sessions')
                    .insert({
                        ...row,
                        team_id: groupId,
                        org_id: orgId,
                        coach_id: user.id,
                        created_by: user.id,
                    })
                    .select()
                    .single();
                if (sessErr) throw sessErr;

                // Auto-create attendee placeholder rows for current roster
                if (roster?.length > 0) {
                    const attendeeRows = roster.map(p => ({
                        session_id: inserted.id,
                        player_id: p.id,
                        attended: false,
                        minutes_credited: row.default_minutes || 0,
                        touches_credited: row.default_touches || 0,
                    }));
                    const { error: attErr } = await supabase
                        .from('private_session_attendees')
                        .insert(attendeeRows);
                    if (attErr) console.error('[PrivateSessions] attendee seed:', attErr);
                }
                toast.success('Session added.');
            }
            await fetchSessions();
            return true;
        } catch (err) {
            console.error('[PrivateSessions] save:', err);
            toast.error(err?.message?.includes('policy')
                ? "You don't have permission to manage sessions here."
                : `Save failed: ${err?.message || 'Unknown error'}.`);
            return false;
        }
    };

    const handleDelete = async (session) => {
        const ok = await confirm({
            title: 'Delete session?',
            body: `Removes the session and any attendance records. Any training credits already given to players stay on their stats.`,
            confirmLabel: 'Delete',
            destructive: true,
        });
        if (!ok) return;
        try {
            const { error } = await supabase.from('private_sessions').delete().eq('id', session.id);
            if (error) throw error;
            toast.success('Session deleted.');
            await fetchSessions();
        } catch (err) {
            console.error('[PrivateSessions] delete:', err);
            toast.error('Delete failed.');
        }
    };

    // -------- Render --------
    return (
        <>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-white font-display uppercase font-bold tracking-wider text-sm">
                        Sessions
                    </h3>
                    <p className="text-[11px] text-gray-500">
                        Log private trainings. Marking a session complete credits each attendee's minutes + touches into their player stats.
                    </p>
                </div>
                <button
                    onClick={() => { setEditing(null); setShowForm(true); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider bg-brand-gold/15 border border-brand-gold/40 text-brand-gold hover:bg-brand-gold/25"
                >
                    <Plus className="w-3.5 h-3.5" /> Add Session
                </button>
            </div>

            {loading ? (
                <div className="text-center text-gray-500 text-sm py-6">Loading…</div>
            ) : sessions.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-white/10 rounded-lg">
                    <Calendar className="w-10 h-10 text-gray-700 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No sessions yet</p>
                    <p className="text-gray-600 text-xs mt-1">Tap "Add Session" to schedule your first one.</p>
                </div>
            ) : (
                <div className="space-y-5">
                    {upcoming.length > 0 && (
                        <div>
                            <h4 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Upcoming</h4>
                            <SessionList items={upcoming} onTap={setDetailFor} onEdit={(s) => { setEditing(s); setShowForm(true); }} onDelete={handleDelete} />
                        </div>
                    )}
                    {past.length > 0 && (
                        <div>
                            <h4 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Past</h4>
                            <SessionList items={past} onTap={setDetailFor} onEdit={(s) => { setEditing(s); setShowForm(true); }} onDelete={handleDelete} />
                        </div>
                    )}
                </div>
            )}

            {showForm && (
                <SessionFormModal
                    initial={editing}
                    onClose={() => { setShowForm(false); setEditing(null); }}
                    onSave={async (form) => {
                        const ok = await handleSave(form, editing?.id || null);
                        if (ok) { setShowForm(false); setEditing(null); }
                    }}
                />
            )}

            {detailFor && (
                <SessionDetailModal
                    session={detailFor}
                    groupId={groupId}
                    groupName={groupName}
                    roster={roster}
                    onClose={() => setDetailFor(null)}
                    onChanged={fetchSessions}
                />
            )}
        </>
    );
};

// ---------------------------------------------------------------------
// List subcomponent
// ---------------------------------------------------------------------
const SessionList = ({ items, onTap, onEdit, onDelete }) => (
    <ul className="space-y-2">
        {items.map(s => {
            const meta = STATUS_META[s.status] || STATUS_META.scheduled;
            const d = new Date(s.start_time);
            return (
                <li
                    key={s.id}
                    className="bg-white/[0.03] border border-white/10 rounded-lg p-3 group cursor-pointer hover:bg-white/5"
                    onClick={() => onTap(s)}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-widest text-brand-gold font-bold">
                                {format(d, 'EEE MMM d · h:mm a')}
                            </div>
                            <h5 className="text-white font-bold text-sm truncate">{s.title || 'Private Session'}</h5>
                            {(s.location_name || s.default_minutes) && (
                                <p className="text-[11px] text-gray-500 truncate">
                                    {s.location_name}
                                    {s.location_name && s.default_minutes ? ' · ' : ''}
                                    {s.default_minutes ? `${s.default_minutes} min default` : ''}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${meta.cls}`}>
                                {meta.label}
                            </span>
                            <button
                                onClick={(e) => { e.stopPropagation(); onEdit(s); }}
                                className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Edit"
                            >
                                <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(s); }}
                                className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </li>
            );
        })}
    </ul>
);

// ---------------------------------------------------------------------
// Create/Edit metadata modal
// ---------------------------------------------------------------------
const SessionFormModal = ({ initial, onClose, onSave }) => {
    const isEdit = !!initial;
    const initParts = isoToFormParts(initial?.start_time);
    const endParts = isoToFormParts(initial?.end_time);

    const [form, setForm] = useState({
        title: initial?.title || '',
        date: initParts.date,
        startTime: initParts.time,
        endTime: endParts.time,
        location: initial?.location_name || 'Sportscore 1',
        defaultMinutes: initial?.default_minutes ?? 60,
        defaultTouches: initial?.default_touches ?? 200,
        notes: initial?.notes || '',
    });
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        setSaving(true);
        await onSave(form);
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-brand-dark border border-white/10 rounded-t-2xl md:rounded-2xl w-full md:max-w-md max-h-[90vh] overflow-y-auto shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                <div className="p-6 space-y-4">
                    <h3 className="text-xl font-display uppercase font-bold text-white tracking-wider">
                        {isEdit ? 'Edit session' : 'New session'}
                    </h3>

                    <label className="block">
                        <span className="text-gray-400 text-[11px] uppercase tracking-wider">Title <span className="normal-case font-normal">(optional)</span></span>
                        <input
                            type="text"
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            placeholder="Private Session"
                            className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-gold"
                        />
                    </label>

                    <div className="grid grid-cols-3 gap-3">
                        <label className="block col-span-1">
                            <span className="text-gray-400 text-[11px] uppercase tracking-wider">Date</span>
                            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                                className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-brand-gold" />
                        </label>
                        <label className="block col-span-1">
                            <span className="text-gray-400 text-[11px] uppercase tracking-wider">Start</span>
                            <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                                className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-brand-gold" />
                        </label>
                        <label className="block col-span-1">
                            <span className="text-gray-400 text-[11px] uppercase tracking-wider">End</span>
                            <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                                className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-brand-gold" />
                        </label>
                    </div>

                    <label className="block">
                        <span className="text-gray-400 text-[11px] uppercase tracking-wider">Location</span>
                        <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                            className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-gold" />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-gray-400 text-[11px] uppercase tracking-wider">Default minutes</span>
                            <input type="number" inputMode="numeric" min={0} value={form.defaultMinutes}
                                onChange={(e) => setForm({ ...form, defaultMinutes: e.target.value })}
                                className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-gold" />
                        </label>
                        <label className="block">
                            <span className="text-gray-400 text-[11px] uppercase tracking-wider">Default touches</span>
                            <input type="number" inputMode="numeric" min={0} value={form.defaultTouches}
                                onChange={(e) => setForm({ ...form, defaultTouches: e.target.value })}
                                className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-gold" />
                        </label>
                    </div>

                    <label className="block">
                        <span className="text-gray-400 text-[11px] uppercase tracking-wider">Notes <span className="normal-case font-normal">(optional)</span></span>
                        <textarea
                            rows={2}
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-gold resize-none"
                        />
                    </label>

                    <div className="flex gap-2 pt-1">
                        <button onClick={onClose} disabled={saving}
                            className="flex-1 py-2 rounded-lg border border-white/10 text-gray-300 text-sm font-bold uppercase tracking-wider hover:bg-white/5 disabled:opacity-50">
                            Cancel
                        </button>
                        <button onClick={submit} disabled={saving}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-brand-gold text-black text-sm font-bold uppercase tracking-wider hover:bg-brand-gold/90 disabled:opacity-50">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {saving ? 'Saving' : (isEdit ? 'Save' : 'Add')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------
// Detail modal: per-attendee attendance + complete
// ---------------------------------------------------------------------
const SessionDetailModal = ({ session, groupId, groupName, roster, onClose, onChanged }) => {
    const toast = useToast();
    const confirm = useConfirm();
    const [attendees, setAttendees] = useState([]);   // rows from private_session_attendees
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [completing, setCompleting] = useState(false);

    // Build a {player_id: attendee_row} index
    const indexByPlayer = useMemo(() => {
        const o = {};
        attendees.forEach(a => { o[a.player_id] = a; });
        return o;
    }, [attendees]);

    const fetchAttendees = async () => {
        const { data, error } = await supabase
            .from('private_session_attendees')
            .select('*')
            .eq('session_id', session.id);
        if (error) {
            console.error('[SessionDetail] attendees fetch:', error);
            setAttendees([]);
        } else {
            setAttendees(data || []);
        }
    };

    useEffect(() => {
        (async () => {
            setLoading(true);
            await fetchAttendees();
            setLoading(false);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session.id]);

    const updateLocal = (playerId, patch) => {
        setAttendees(prev => {
            const existing = prev.find(a => a.player_id === playerId);
            if (existing) {
                return prev.map(a => a.player_id === playerId ? { ...a, ...patch } : a);
            }
            // Roster member with no attendee row yet (rare — Add-Session
            // auto-seeds rows, but defensively handle missing rows for
            // kids added to the group AFTER the session was created)
            return [...prev, {
                id: null,
                session_id: session.id,
                player_id: playerId,
                attended: false,
                minutes_credited: session.default_minutes || 0,
                touches_credited: session.default_touches || 0,
                ...patch,
            }];
        });
    };

    const handleSaveAttendees = async () => {
        setSaving(true);
        try {
            // Upsert each row. Need session_id+player_id unique constraint.
            const rows = roster.map(p => {
                const a = indexByPlayer[p.id] || {};
                return {
                    session_id: session.id,
                    player_id: p.id,
                    attended: !!a.attended,
                    minutes_credited: a.attended ? (parseInt(a.minutes_credited, 10) || session.default_minutes || 0) : 0,
                    touches_credited: a.attended ? (parseInt(a.touches_credited, 10) || session.default_touches || 0) : 0,
                    notes: a.notes || null,
                    updated_at: new Date().toISOString(),
                };
            });
            const { error } = await supabase
                .from('private_session_attendees')
                .upsert(rows, { onConflict: 'session_id,player_id' });
            if (error) throw error;
            toast.success('Attendance saved.');
            await fetchAttendees();
            onChanged?.();
        } catch (err) {
            console.error('[SessionDetail] save:', err);
            toast.error(err?.message || 'Save failed.');
        } finally {
            setSaving(false);
        }
    };

    const handleComplete = async () => {
        const goingCount = roster.filter(p => indexByPlayer[p.id]?.attended).length;
        if (goingCount === 0) {
            toast.error('Mark at least one attendee before completing.');
            return;
        }
        const ok = await confirm({
            title: `Complete session?`,
            body: `${goingCount} attendee(s) will get their minutes + touches credited to their player stats. This is idempotent — running again won't double-credit.`,
            confirmLabel: 'Complete & credit',
        });
        if (!ok) return;
        setCompleting(true);
        try {
            // Save attendance first so the function picks up the latest state
            await handleSaveAttendees();
            const { data, error } = await supabase.rpc('complete_private_session', { p_session_id: session.id });
            if (error) throw error;
            const result = (data && data[0]) || {};
            toast.success(
                `Session completed. Credited ${result.credited_count || 0} player(s) · ${result.total_minutes || 0} min · ${(result.total_touches || 0).toLocaleString()} touches.`
            );
            onChanged?.();
            onClose();
        } catch (err) {
            console.error('[SessionDetail] complete:', err);
            toast.error(err?.message || 'Complete failed.');
        } finally {
            setCompleting(false);
        }
    };

    const isCompleted = session.status === 'completed';
    const sessionDate = new Date(session.start_time);

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-brand-dark border border-white/10 rounded-t-2xl md:rounded-2xl w-full md:max-w-2xl max-h-[92vh] flex flex-col shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-3 right-3 z-10 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>

                {/* Header */}
                <div className="p-6 border-b border-white/10 shrink-0">
                    <div className="text-[10px] uppercase tracking-widest text-brand-gold font-bold mb-1">
                        {format(sessionDate, 'EEE MMM d · h:mm a')}
                    </div>
                    <h3 className="text-xl font-display uppercase font-bold text-white tracking-wider">
                        {session.title || 'Private Session'}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                        {groupName}
                        {session.location_name && ` · ${session.location_name}`}
                        {' · '}{session.default_minutes || 0} min / {(session.default_touches || 0).toLocaleString()} touches default
                    </p>
                    {isCompleted && (
                        <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] uppercase font-bold border bg-emerald-500/15 border-emerald-500/30 text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> Completed {session.completed_at && '· ' + format(new Date(session.completed_at), 'MMM d')}
                        </div>
                    )}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="flex items-center gap-2 mb-3 text-gray-400 text-xs uppercase tracking-widest font-bold">
                        <Users className="w-3.5 h-3.5" /> Attendance ({roster.length})
                    </div>

                    {loading ? (
                        <div className="text-center text-gray-500 text-sm py-6">Loading…</div>
                    ) : roster.length === 0 ? (
                        <div className="text-center text-gray-500 text-sm py-6">No players in this group yet. Add players on the Roster tab.</div>
                    ) : (
                        <ul className="space-y-2">
                            {roster.map(p => {
                                const a = indexByPlayer[p.id] || {};
                                const isAttended = !!a.attended;
                                const wasCredited = !!a.credited_at;
                                return (
                                    <li key={p.id} className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={isAttended}
                                                    onChange={(e) => updateLocal(p.id, { attended: e.target.checked })}
                                                    disabled={isCompleted}
                                                    className="w-5 h-5 accent-brand-gold shrink-0"
                                                />
                                                <div className="min-w-0">
                                                    <p className="text-white text-sm font-bold truncate">{p.first_name} {p.last_name}</p>
                                                    {wasCredited && (
                                                        <p className="text-[11px] text-emerald-300/80 flex items-center gap-1">
                                                            <Award className="w-3 h-3" /> Credited
                                                        </p>
                                                    )}
                                                </div>
                                            </label>
                                            {isAttended && (
                                                <div className="grid grid-cols-2 gap-2 w-44 shrink-0">
                                                    <input
                                                        type="number"
                                                        inputMode="numeric"
                                                        min={0}
                                                        value={a.minutes_credited ?? session.default_minutes ?? 0}
                                                        onChange={(e) => updateLocal(p.id, { minutes_credited: e.target.value })}
                                                        disabled={isCompleted}
                                                        placeholder="min"
                                                        title="Minutes credited"
                                                        className="bg-black/40 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-brand-gold disabled:opacity-60"
                                                    />
                                                    <input
                                                        type="number"
                                                        inputMode="numeric"
                                                        min={0}
                                                        value={a.touches_credited ?? session.default_touches ?? 0}
                                                        onChange={(e) => updateLocal(p.id, { touches_credited: e.target.value })}
                                                        disabled={isCompleted}
                                                        placeholder="touches"
                                                        title="Touches credited"
                                                        className="bg-black/40 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-brand-gold disabled:opacity-60"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-white/10 p-4 shrink-0 flex flex-col sm:flex-row gap-2">
                    <button onClick={onClose} disabled={saving || completing}
                        className="sm:flex-1 py-2 rounded-lg border border-white/10 text-gray-300 text-sm font-bold uppercase tracking-wider hover:bg-white/5 disabled:opacity-50">
                        Close
                    </button>
                    {!isCompleted && (
                        <>
                            <button onClick={handleSaveAttendees} disabled={saving || completing}
                                className="sm:flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm font-bold uppercase tracking-wider hover:bg-white/15 disabled:opacity-50">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving ? 'Saving' : 'Save attendance'}
                            </button>
                            <button onClick={handleComplete} disabled={saving || completing}
                                className="sm:flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-500 text-black text-sm font-bold uppercase tracking-wider hover:bg-emerald-500/90 disabled:opacity-50">
                                {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                {completing ? 'Crediting…' : 'Complete & credit'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PrivateSessionsPanel;
