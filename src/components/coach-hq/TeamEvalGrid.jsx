import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Check, ChevronDown, ChevronUp, Star, ArrowUpDown } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import { getCard, activeSubs, overallRating, GK_POSITION, DEFAULT_SUBSTAT } from '../../constants/fifaAttributes';

// Squad Eval Grid — rate the WHOLE team on one screen, set positions inline,
// and compare kids side by side. Bulk-friendly companion to the deep
// per-player PlayerEvaluationModal (which stays for granular sub-stat work).
//
// Preserves existing data: each row pre-loads the player's latest evaluation
// (the 6 face columns) + current position. Saving INSERTS a new evaluation row
// (append-only history, identical to the modal) — nothing is overwritten — and
// only rows the coach actually changed are saved.

// Same 9-position vocabulary as the eval modal's Info tab / TryoutSignup.
const POSITIONS = [
    'Goalkeeper', 'Center Back', 'Fullback', 'Defensive Midfielder',
    'Center Midfielder', 'Attacking Midfielder', 'Winger', 'Striker', 'Anywhere',
];

const SEASON = 'Spring 2026'; // matches PlayerEvaluationModal

const clamp = (n) => Math.max(0, Math.min(99, Math.round(Number(n) || 0)));

// Color a stat number red→green so the comparison pops at a glance.
const statColor = (v) => v >= 80 ? '#22c55e' : v >= 70 ? '#84cc16' : v >= 60 ? '#eab308' : '#ef4444';

// Build the modal-compatible sub_stats payload from 6 face values so a
// grid-saved eval hydrates correctly in the detailed PlayerEvaluationModal:
// outfield faces spread across their active sub-stats; directly-scored faces
// (e.g. youth GK) go in directFaces.
const buildSubStats = (card, mode, faceByKey) => {
    const subs = {}; const directFaces = {};
    card.forEach((attr) => {
        const v = faceByKey[attr.key];
        const active = activeSubs(attr, mode);
        if (active.length === 0) directFaces[attr.key] = v;
        else active.forEach((s) => { subs[s.key] = v; });
    });
    return { subs, directFaces };
};

const cardTypeFor = (position, evalCardType) => {
    if (position === GK_POSITION) return 'gk';
    if (evalCardType === 'gk') return 'gk';
    return 'outfield';
};

const TeamEvalGrid = ({ teamId, onClose }) => {
    const { user } = useAuth();
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState([]);          // see shape in load()
    const [expandedId, setExpandedId] = useState(null);
    const [savingId, setSavingId] = useState(null);
    const [savingAll, setSavingAll] = useState(false);
    const [sort, setSort] = useState('ovr');       // 'ovr' | 'name' | 'position'
    const [filter, setFilter] = useState('all');   // 'all' | 'no_position' | 'no_eval'

    const load = useCallback(async () => {
        if (!teamId) return;
        setLoading(true);
        const { data: roster, error: rErr } = await supabase
            .from('player_teams')
            .select('player_id, players!inner(id, first_name, last_name, jersey_number, position, avatar_url)')
            .eq('team_id', teamId)
            .eq('status', 'active');
        if (rErr) { console.warn('[TeamEvalGrid] roster error', rErr); toast.error('Could not load the roster.'); setLoading(false); return; }

        const players = (roster || []).map((r) => r.players).filter(Boolean);
        const ids = players.map((p) => p.id);

        // Latest evaluation per player (the 6 face columns, in card order).
        const latestByPlayer = {};
        if (ids.length) {
            const { data: evals } = await supabase
                .from('evaluations')
                .select('player_id, pace, shooting, passing, dribbling, defending, physical, card_type, created_at')
                .in('player_id', ids)
                .order('created_at', { ascending: false });
            (evals || []).forEach((e) => { if (!latestByPlayer[e.player_id]) latestByPlayer[e.player_id] = e; });
        }

        const next = players.map((p) => {
            const ev = latestByPlayer[p.id] || null;
            const position = p.position || '';
            const cardType = cardTypeFor(position, ev?.card_type);
            const stats = ev
                ? [ev.pace, ev.shooting, ev.passing, ev.dribbling, ev.defending, ev.physical].map((v) => clamp(v ?? DEFAULT_SUBSTAT))
                : [DEFAULT_SUBSTAT, DEFAULT_SUBSTAT, DEFAULT_SUBSTAT, DEFAULT_SUBSTAT, DEFAULT_SUBSTAT, DEFAULT_SUBSTAT];
            return {
                id: p.id,
                name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Player',
                jersey: p.jersey_number,
                avatar: p.avatar_url || null,
                position,
                cardType,
                stats,
                hasEval: !!ev,
                // Snapshot of what's in the DB, to detect unsaved changes.
                origPosition: position,
                origStats: ev ? stats.join(',') : null,
                saved: false,
            };
        });
        setRows(next);
        setLoading(false);
    }, [teamId, toast]);

    useEffect(() => { load(); }, [load]);

    const isDirty = useCallback((r) => {
        const posChanged = (r.position || '') !== (r.origPosition || '');
        const statsChanged = r.stats.join(',') !== (r.origStats ?? '__none__');
        return posChanged || statsChanged;
    }, []);

    const ovrOf = (r) => overallRating(r.stats);

    const setPosition = (id, position) => {
        setRows((prev) => prev.map((r) => r.id === id
            ? { ...r, position, cardType: cardTypeFor(position, r.cardType), saved: false }
            : r));
    };
    const setStat = (id, idx, value) => {
        const v = clamp(value);
        setRows((prev) => prev.map((r) => {
            if (r.id !== id) return r;
            const stats = r.stats.slice(); stats[idx] = v;
            return { ...r, stats, saved: false };
        }));
    };

    const saveRow = async (id) => {
        const r = rows.find((x) => x.id === id);
        if (!r) return;
        const posChanged = (r.position || '') !== (r.origPosition || '');
        const statsChanged = r.stats.join(',') !== (r.origStats ?? '__none__');
        if (!posChanged && !statsChanged) return;
        // Saving an eval requires a position (mirrors the modal's gate) — but
        // setting position alone (no stat change) is allowed.
        if (statsChanged && !r.position) {
            toast.warning(`Pick a position for ${r.name} first.`);
            setExpandedId(id);
            return;
        }
        setSavingId(id);
        try {
            if (posChanged) {
                const { error } = await supabase.from('players').update({ position: r.position || null }).eq('id', r.id);
                if (error) throw error;
            }
            if (statsChanged) {
                const card = getCard(r.cardType);
                const faceByKey = {}; card.forEach((a, i) => { faceByKey[a.key] = r.stats[i]; });
                const { subs, directFaces } = buildSubStats(card, 'youth', faceByKey);
                const [c0, c1, c2, c3, c4, c5] = r.stats;
                const { error } = await supabase.from('evaluations').insert([{
                    player_id: r.id,
                    coach_id: user.id,
                    season: SEASON,
                    card_type: r.cardType,
                    eval_mode: 'youth',
                    sub_stats: { card_type: r.cardType, mode: 'youth', attributes: faceByKey, subs, directFaces },
                    pace: c0, shooting: c1, passing: c2, dribbling: c3, defending: c4, physical: c5,
                }]);
                if (error) throw error;
            }
            // Re-baseline this row so it's no longer "dirty".
            setRows((prev) => prev.map((x) => x.id === id
                ? { ...x, origPosition: x.position, origStats: x.stats.join(','), hasEval: statsChanged ? true : x.hasEval, saved: true }
                : x));
        } catch (err) {
            console.error('[TeamEvalGrid] save failed', err);
            const msg = err?.message || 'Save failed.';
            toast.error(msg.includes('policy') || msg.includes('permission')
                ? "You don't have permission to edit this player."
                : `Save failed: ${msg}`);
        } finally {
            setSavingId(null);
        }
    };

    const saveAll = async () => {
        const dirty = rows.filter(isDirty);
        if (dirty.length === 0) { toast.info('No changes to save.'); return; }
        const missingPos = dirty.filter((r) => r.stats.join(',') !== (r.origStats ?? '__none__') && !r.position);
        if (missingPos.length) {
            toast.warning(`Set a position for ${missingPos.length} player${missingPos.length === 1 ? '' : 's'} before saving their ratings.`);
            setFilter('no_position');
            return;
        }
        setSavingAll(true);
        let ok = 0;
        for (const r of dirty) {
            // eslint-disable-next-line no-await-in-loop
            await saveRow(r.id);
            ok += 1;
        }
        setSavingAll(false);
        toast.success(`Saved ${ok} player${ok === 1 ? '' : 's'}.`);
    };

    const ratedCount = rows.filter((r) => r.hasEval).length;
    const noPosCount = rows.filter((r) => !r.position).length;
    const dirtyCount = rows.filter(isDirty).length;

    const visible = useMemo(() => {
        let list = rows.slice();
        if (filter === 'no_position') list = list.filter((r) => !r.position);
        else if (filter === 'no_eval') list = list.filter((r) => !r.hasEval);
        if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
        else if (sort === 'position') list.sort((a, b) => (a.position || 'zzz').localeCompare(b.position || 'zzz') || a.name.localeCompare(b.name));
        else list.sort((a, b) => ovrOf(b) - ovrOf(a) || a.name.localeCompare(b.name)); // ovr
        return list;
    }, [rows, filter, sort]);

    const overlay = (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-stretch sm:items-center sm:justify-center sm:p-4">
            <div className="w-full sm:max-w-3xl bg-[#0f0f12] sm:rounded-2xl border border-white/10 flex flex-col h-[100dvh] sm:h-[88dvh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
                    <Star className="w-5 h-5 text-brand-gold shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="text-white font-bold text-base leading-tight">Squad Eval Grid</div>
                        <div className="text-[11px] text-gray-400">
                            {ratedCount}/{rows.length} rated{noPosCount > 0 && <span className="text-brand-gold"> · {noPosCount} need a position</span>}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-white" aria-label="Close"><X className="w-5 h-5" /></button>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 shrink-0 overflow-x-auto">
                    <button
                        onClick={() => setSort((s) => s === 'ovr' ? 'name' : s === 'name' ? 'position' : 'ovr')}
                        className="flex items-center gap-1 text-xs font-semibold text-gray-300 bg-white/5 hover:bg-white/10 rounded-lg px-2.5 py-1.5 shrink-0"
                    >
                        <ArrowUpDown className="w-3.5 h-3.5" />
                        {sort === 'ovr' ? 'OVR' : sort === 'name' ? 'Name' : 'Position'}
                    </button>
                    {[
                        { k: 'all', label: `All ${rows.length}` },
                        { k: 'no_eval', label: 'Needs eval' },
                        { k: 'no_position', label: 'Needs position' },
                    ].map((f) => (
                        <button
                            key={f.k}
                            onClick={() => setFilter(f.k)}
                            className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 shrink-0 transition-colors ${filter === f.k ? 'bg-brand-gold text-black' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
                    ) : visible.length === 0 ? (
                        <div className="text-center text-gray-400 py-16 text-sm">No players match this filter.</div>
                    ) : visible.map((r) => {
                        const card = getCard(r.cardType);
                        const ovr = ovrOf(r);
                        const dirty = isDirty(r);
                        const expanded = expandedId === r.id;
                        return (
                            <div key={r.id} className={`rounded-xl border ${dirty ? 'border-brand-gold/50' : 'border-white/10'} bg-white/[0.03]`}>
                                {/* Collapsed comparison row */}
                                <button
                                    type="button"
                                    onClick={() => setExpandedId(expanded ? null : r.id)}
                                    className="w-full flex items-center gap-3 p-2.5 text-left"
                                >
                                    <div className="w-9 h-9 rounded-full bg-white/10 overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-gray-300">
                                        {r.avatar ? <img src={r.avatar} alt="" className="w-full h-full object-cover" /> : (r.name[0] || '?')}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-white text-sm font-semibold truncate">
                                            {r.jersey != null && <span className="text-gray-500">#{r.jersey} </span>}{r.name}
                                        </div>
                                        <div className={`text-[11px] truncate ${r.position ? 'text-gray-400' : 'text-brand-gold'}`}>
                                            {r.position || 'No position — tap to set'}
                                        </div>
                                    </div>
                                    {/* 6-stat strip (comparison) */}
                                    <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                                        {card.map((a, i) => (
                                            <div key={a.key} className="w-7 text-center">
                                                <div className="text-[8px] text-gray-500 leading-none">{a.key}</div>
                                                <div className="text-[12px] font-bold leading-tight" style={{ color: r.hasEval || dirty ? statColor(r.stats[i]) : '#6b7280' }}>
                                                    {r.hasEval || dirty ? r.stats[i] : '–'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="w-11 text-center shrink-0">
                                        <div className="text-[8px] text-gray-500 leading-none">OVR</div>
                                        <div className="text-lg font-black leading-tight" style={{ color: r.hasEval || dirty ? statColor(ovr) : '#6b7280' }}>
                                            {r.hasEval || dirty ? ovr : '–'}
                                        </div>
                                    </div>
                                    {r.saved && !dirty
                                        ? <Check className="w-4 h-4 text-brand-green shrink-0" />
                                        : (expanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />)}
                                </button>

                                {/* Expanded editor */}
                                {expanded && (
                                    <div className="px-3 pb-3 pt-1 border-t border-white/10 space-y-3">
                                        {/* Position */}
                                        <label className="block">
                                            <span className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">Position</span>
                                            <div className="relative mt-1">
                                                <select
                                                    value={r.position}
                                                    onChange={(e) => setPosition(r.id, e.target.value)}
                                                    className="w-full appearance-none bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-gold outline-none"
                                                >
                                                    <option value="" className="bg-[#0f0f12]">— Select position —</option>
                                                    {POSITIONS.map((p) => <option key={p} value={p} className="bg-[#0f0f12]">{p}</option>)}
                                                </select>
                                                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                            </div>
                                            {r.cardType === 'gk' && <span className="text-[10px] text-brand-gold mt-1 block">Goalkeeper card (DIV/HAN/KIC/REF/SPD/POS)</span>}
                                        </label>

                                        {/* 6 stat sliders */}
                                        <div className="space-y-2">
                                            {card.map((a, i) => (
                                                <div key={a.key} className="flex items-center gap-3">
                                                    <div className="w-24 shrink-0">
                                                        <div className="text-xs font-bold text-white">{a.key}</div>
                                                        <div className="text-[10px] text-gray-500 leading-none">{a.label}</div>
                                                    </div>
                                                    <input
                                                        type="range" min={0} max={99} value={r.stats[i]}
                                                        onChange={(e) => setStat(r.id, i, e.target.value)}
                                                        className="flex-1 accent-brand-gold"
                                                    />
                                                    <div className="w-9 text-right text-sm font-black" style={{ color: statColor(r.stats[i]) }}>{r.stats[i]}</div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex items-center justify-between pt-1">
                                            <div className="text-xs text-gray-400">
                                                OVR <span className="font-black text-base" style={{ color: statColor(ovr) }}>{ovr}</span>
                                            </div>
                                            <button
                                                onClick={() => saveRow(r.id)}
                                                disabled={!dirty || savingId === r.id}
                                                className="flex items-center gap-1.5 bg-brand-gold text-black text-sm font-bold rounded-lg px-4 py-2 disabled:opacity-40"
                                            >
                                                {savingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer — save all */}
                <div className="border-t border-white/10 p-3 shrink-0">
                    <button
                        onClick={saveAll}
                        disabled={savingAll || dirtyCount === 0}
                        className="w-full flex items-center justify-center gap-2 bg-brand-green text-black font-bold rounded-xl py-3 disabled:opacity-40"
                    >
                        {savingAll ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                        {dirtyCount > 0 ? `Save ${dirtyCount} change${dirtyCount === 1 ? '' : 's'}` : 'All changes saved'}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(overlay, document.body);
};

export default TeamEvalGrid;
