import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Loader2, Save, Eye } from 'lucide-react';
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { supabase } from '../../../supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../Toast';
import { STAFF_ROLES } from '../../../constants/roles';
import { FORMATIONS } from './formations';
import SoccerPitch from './SoccerPitch';
import AvailablePlayers from './AvailablePlayers';
import FormationPicker from './FormationPicker';

// Full-screen lineup builder modal.
//
// Layout on mobile:
//   [Header — title + close]
//   [Toolbar — formation pills + 2/11 + Save (one row)]
//   [Pitch — fills remaining vertical space]
//   [Bench — sticky 2-row horizontal-scroll strip at the bottom]
//
// The bench is a flex-sibling of the pitch (NOT an overlay) so the field
// is never covered. The pitch uses a ResizeObserver to reflow into the
// space left after the bench is laid out.
//
// Body scroll is locked while the modal is open so a touch-drag on the
// bench can't be hijacked by page scrolling.
const LineupBuilder = ({ event, onClose }) => {
    const { user, profile } = useAuth();
    const toast = useToast();

    const isStaff = STAFF_ROLES.has(profile?.role);
    const readOnly = !isStaff;

    const [formation, setFormation] = useState('4-4-2');
    // assignments shape: { [slotId]: { player_id, name, jersey } | null }
    const [assignments, setAssignments] = useState({});
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    // Lock body scroll while the modal is open. Without this, a touch
    // that starts on a bench chip can scroll the underlying page before
    // dnd-kit's TouchSensor activates — the user sees the page move
    // instead of the chip lifting, and the drag never starts.
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    // delay: 250ms means a quick swipe through the bench scrolls the list
    // (drag won't activate until they hold for 1/4 sec). tolerance: 8px
    // allows tiny finger jitter during the hold without cancelling.
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(TouchSensor,   { activationConstraint: { delay: 250, tolerance: 8 } }),
    );

    // Lookup helper: player id → display object
    const playerById = useMemo(() => {
        const m = new Map();
        players.forEach(p => m.set(p.id, {
            player_id: p.id,
            name: `${p.first_name} ${p.last_name?.charAt(0) || ''}.`,
            jersey: p.jersey_number,
        }));
        return m;
    }, [players]);

    // Load roster + existing lineup
    useEffect(() => {
        if (!event?.id || !event?.team_id) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            const [rosterRes, lineupRes] = await Promise.all([
                supabase
                    .from('player_teams')
                    .select('player_id, players!inner(id,first_name,last_name,jersey_number)')
                    .eq('team_id', event.team_id).eq('status', 'active'),
                supabase
                    .from('event_lineups')
                    .select('formation, lineup')
                    .eq('event_id', event.id)
                    .maybeSingle(),
            ]);
            if (cancelled) return;

            const roster = (rosterRes.data || []).map(r => r.players);
            // Sort by jersey then last name for stable bench order
            roster.sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999) || (a.last_name || '').localeCompare(b.last_name || ''));
            setPlayers(roster);

            const fmt = lineupRes.data?.formation || '4-4-2';
            setFormation(fmt);

            const next = {};
            for (const arr of [lineupRes.data?.lineup || []]) {
                for (const entry of arr) {
                    if (!entry?.slot || !entry?.player_id) continue;
                    const p = roster.find(rp => rp.id === entry.player_id);
                    if (!p) continue;
                    next[entry.slot] = {
                        player_id: p.id,
                        name: `${p.first_name} ${p.last_name?.charAt(0) || ''}.`,
                        jersey: p.jersey_number,
                    };
                }
            }
            setAssignments(next);
            setDirty(false);
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [event?.id, event?.team_id]);

    // Reconcile when formation changes: drop assignments for slot ids
    // that no longer exist; everything else carries over.
    useEffect(() => {
        const validSlots = new Set((FORMATIONS[formation]?.slots || []).map(s => s.id));
        setAssignments(prev => {
            const next = {};
            for (const [slotId, val] of Object.entries(prev)) {
                if (validSlots.has(slotId)) next[slotId] = val;
            }
            return next;
        });
    }, [formation]);

    const handleDragEnd = useCallback((evt) => {
        const { active, over } = evt;
        if (!over) return;
        if (!String(active.id).startsWith('player:')) return;
        if (!String(over.id).startsWith('slot:')) return;
        const playerId = String(active.id).slice('player:'.length);
        const slotId = String(over.id).slice('slot:'.length);
        const player = playerById.get(playerId);
        if (!player) return;

        setAssignments(prev => {
            const next = { ...prev };
            // Remove player from any other slot first (prevents dupes)
            for (const [k, v] of Object.entries(next)) {
                if (v?.player_id === playerId) next[k] = null;
            }
            next[slotId] = player;
            return next;
        });
        setDirty(true);
    }, [playerById]);

    const handleUnassign = useCallback((slotId) => {
        setAssignments(prev => ({ ...prev, [slotId]: null }));
        setDirty(true);
    }, []);

    const handleFormationChange = useCallback((id) => {
        if (id === formation) return;
        setFormation(id);
        setDirty(true);
    }, [formation]);

    const handleSave = async () => {
        if (!isStaff) return;
        setSaving(true);
        try {
            const lineupArr = Object.entries(assignments)
                .filter(([, v]) => v?.player_id)
                .map(([slot, v]) => ({ slot, player_id: v.player_id, backups: [] }));
            const { error } = await supabase
                .from('event_lineups')
                .upsert(
                    {
                        event_id: event.id,
                        formation,
                        lineup: lineupArr,
                        created_by: user?.id,
                    },
                    { onConflict: 'event_id' },
                );
            if (error) throw error;
            toast?.show?.('success', 'Lineup saved.');
            setDirty(false);
        } catch (err) {
            console.error('[LineupBuilder] save error', err);
            toast?.show?.('error', "Couldn't save lineup. Try again.");
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        if (dirty && isStaff && !window.confirm('Discard unsaved lineup changes?')) return;
        onClose?.();
    };

    const slots = FORMATIONS[formation]?.slots || [];
    const filledCount = slots.filter(s => assignments[s.id]).length;
    const allOnField = filledCount === slots.length;

    // Inline `height: 100dvh` (dynamic viewport height) so Chrome's URL
    // bar collapse on scroll doesn't leave a gap at the bottom. `inset-0`
    // + Tailwind `h-full` resolves against the containing block; dvh is
    // always viewport-relative regardless of ancestor positioning.
    return (
        <div
            className="fixed inset-0 z-[100] bg-black/90 flex items-stretch justify-stretch md:items-center md:justify-center md:p-3"
            style={{ height: '100dvh' }}
            onClick={handleClose}
        >
            <div
                className="bg-brand-dark md:rounded-2xl border border-white/10 w-full h-full md:w-[96vw] md:h-[96vh] md:max-w-[1600px] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header — title + close */}
                <div className="px-3 py-1.5 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
                    <div className="min-w-0">
                        <div className="text-[9px] uppercase tracking-widest text-brand-gold font-bold flex items-center gap-1">
                            {readOnly ? <><Eye className="w-3 h-3" /> Lineup</> : 'Lineup Builder'}
                        </div>
                        <h2 className="text-white text-sm md:text-base font-bold truncate">{event?.title || 'Game'}</h2>
                    </div>
                    <button onClick={handleClose} className="p-1.5 text-gray-400 hover:text-white shrink-0">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Compact toolbar — formation pills + count + save in one row */}
                <div className="px-2 py-1.5 border-b border-white/10 flex items-center gap-2 shrink-0">
                    <FormationPicker value={formation} onChange={handleFormationChange} readOnly={readOnly} />
                    <span className={`text-[11px] font-bold shrink-0 tabular-nums px-1.5 py-0.5 rounded
                        ${allOnField ? 'bg-brand-green/20 text-brand-green' : 'text-gray-300'}`}>
                        {filledCount}/{slots.length}
                    </span>
                    {!readOnly && (
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || !dirty}
                            className={`shrink-0 px-3 py-1 rounded-md font-display font-bold uppercase tracking-wider text-xs flex items-center gap-1 transition-all
                                ${dirty && !saving ? 'bg-brand-green text-brand-dark hover:brightness-110' : 'bg-white/5 text-gray-500 cursor-not-allowed'}`}
                        >
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            <span className="hidden xs:inline">{saving ? 'Saving' : dirty ? 'Save' : 'Saved'}</span>
                        </button>
                    )}
                </div>

                {/* Body — pitch on top, bench strip on bottom (flex column).
                    Pitch fills remaining space; SoccerPitch ResizeObserver
                    handles the 2:3 aspect within whatever it gets. */}
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    {loading ? (
                        <div className="flex-1 flex justify-center items-center">
                            <Loader2 className="w-8 h-8 animate-spin text-brand-green" />
                        </div>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <div className="flex-1 min-h-0 p-2 md:p-3 flex items-center justify-center">
                                <SoccerPitch
                                    formation={formation}
                                    assignments={assignments}
                                    players={players}
                                    onUnassign={handleUnassign}
                                    readOnly={readOnly}
                                />
                            </div>
                            <AvailablePlayers players={players} assignments={assignments} readOnly={readOnly} />
                        </DndContext>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LineupBuilder;
