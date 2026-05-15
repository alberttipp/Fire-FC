import React, { useEffect, useState } from 'react';
import { Plane, Plus, Trash2, Loader2, Save, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useToast } from '../Toast';
import { useConfirm } from '../ConfirmDialog';

// One vacation period = "Bo is gone from start_date through end_date."
// Inserting a row fires a SECURITY DEFINER trigger that upserts every
// matching event_rsvp to status='vacation' for that player. Parents
// see the auto-mark happen on the schedule the next time it loads.

const formatRange = (start, end) => {
    const s = new Date(start + 'T00:00');
    const e = new Date(end + 'T00:00');
    const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const year = e.getFullYear() !== new Date().getFullYear() ? `, ${e.getFullYear()}` : '';
    if (start === end) return `${fmt(s)}${year}`;
    return `${fmt(s)} – ${fmt(e)}${year}`;
};

const VacationPeriodsManager = ({ playerId, playerName = 'this player' }) => {
    const toast = useToast();
    const confirm = useConfirm();
    const [periods, setPeriods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ start: '', end: '', note: '' });

    const todayIso = new Date().toISOString().slice(0, 10);

    const fetchPeriods = async () => {
        if (!playerId) { setPeriods([]); setLoading(false); return; }
        const { data, error } = await supabase
            .from('vacation_periods')
            .select('id, start_date, end_date, note, created_at')
            .eq('player_id', playerId)
            .order('start_date', { ascending: true });
        if (error) {
            console.error('[VacationPeriodsManager] fetch failed:', error);
            setPeriods([]);
        } else {
            setPeriods(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        setLoading(true);
        fetchPeriods();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playerId]);

    const openAdd = () => {
        setForm({ start: todayIso, end: todayIso, note: '' });
        setAdding(true);
    };

    const handleSave = async () => {
        if (!form.start || !form.end) { toast.error('Pick a start and end date.'); return; }
        if (form.end < form.start) { toast.error('End date must be on or after start date.'); return; }

        setSaving(true);
        try {
            const { data: userRes } = await supabase.auth.getUser();
            const { error } = await supabase
                .from('vacation_periods')
                .insert({
                    player_id: playerId,
                    start_date: form.start,
                    end_date: form.end,
                    note: form.note.trim() || null,
                    created_by: userRes?.user?.id || null,
                });
            if (error) throw error;
            toast.success('Vacation saved — events in that range are marked.');
            setAdding(false);
            await fetchPeriods();
        } catch (err) {
            console.error('[VacationPeriodsManager] save failed:', err);
            toast.error(err?.message?.includes('policy')
                ? "You don't have permission to set vacation for this player."
                : `Save failed: ${err?.message || 'Unknown error.'}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (period) => {
        const ok = await confirm({
            title: 'Remove this vacation?',
            body: `Delete the ${formatRange(period.start_date, period.end_date)} vacation for ${playerName}? Any events already marked as "vacation" will keep that status — re-RSVP them individually if plans changed.`,
            confirmLabel: 'Remove',
            destructive: true,
        });
        if (!ok) return;
        try {
            const { error } = await supabase
                .from('vacation_periods')
                .delete()
                .eq('id', period.id);
            if (error) throw error;
            toast.success('Vacation removed.');
            setPeriods(prev => prev.filter(p => p.id !== period.id));
        } catch (err) {
            console.error('[VacationPeriodsManager] delete failed:', err);
            toast.error('Delete failed.');
        }
    };

    return (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-display font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                    <Plane className="w-4 h-4 text-sky-400" /> Vacation
                </h3>
                {!adding && (
                    <button
                        onClick={openAdd}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-sky-500/15 border border-sky-500/40 text-sky-400 hover:bg-sky-500/25 transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                )}
            </div>

            {adding && (
                <div className="mb-4 p-3 bg-black/30 border border-sky-500/30 rounded-lg space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-gray-400 text-[11px] uppercase tracking-wider">Start</span>
                            <input
                                type="date"
                                value={form.start}
                                onChange={(e) => setForm({ ...form, start: e.target.value })}
                                className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-400"
                            />
                        </label>
                        <label className="block">
                            <span className="text-gray-400 text-[11px] uppercase tracking-wider">End</span>
                            <input
                                type="date"
                                value={form.end}
                                onChange={(e) => setForm({ ...form, end: e.target.value })}
                                min={form.start || undefined}
                                className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-400"
                            />
                        </label>
                    </div>
                    <label className="block">
                        <span className="text-gray-400 text-[11px] uppercase tracking-wider">Note <span className="normal-case font-normal">(optional)</span></span>
                        <input
                            type="text"
                            placeholder="e.g. Family trip"
                            value={form.note}
                            onChange={(e) => setForm({ ...form, note: e.target.value })}
                            className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-400"
                        />
                    </label>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setAdding(false)}
                            disabled={saving}
                            className="flex-1 py-2 rounded-lg border border-white/10 text-gray-300 text-sm font-bold uppercase tracking-wider hover:bg-white/5 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-sky-500 text-white text-sm font-bold uppercase tracking-wider hover:bg-sky-500/90 disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {saving ? 'Saving' : 'Save'}
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="text-center text-gray-500 text-xs py-4">Loading…</div>
            ) : periods.length === 0 ? (
                <div className="text-center py-6">
                    <Plane className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No vacations set</p>
                    <p className="text-gray-600 text-xs mt-1">
                        Tell the coach when {playerName} will be away and we'll auto-mark every event in that range.
                    </p>
                </div>
            ) : (
                <ul className="space-y-2">
                    {periods.map(p => (
                        <li
                            key={p.id}
                            className="flex items-center justify-between p-3 bg-white/[0.03] rounded-lg border border-white/5"
                        >
                            <div className="min-w-0">
                                <p className="text-white text-sm font-semibold">{formatRange(p.start_date, p.end_date)}</p>
                                {p.note && <p className="text-gray-400 text-xs truncate">{p.note}</p>}
                            </div>
                            <button
                                onClick={() => handleDelete(p)}
                                aria-label="Delete vacation"
                                className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default VacationPeriodsManager;
