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
// Props:
//   event       — { id, title, team_id, start_time, type, ... }
//   onClose()
//
// Data model: jsonb 'lineup' on event_lineups is an array of
//   { slot: 'GK', player_id: uuid, backups: [uuid] }
// objects. We keep it as a position->player map in component state for
// O(1) updates, and serialize back to array on save.
//
// Drag IDs:
//   draggables -> "player:{playerId}"
//   droppables -> "slot:{slotId}"
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

    // position:fixed already escapes the EventDetailModal inner container
    // (we're rendered as its sibling, not its child). No portal needed.
    return (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-stretch justify-stretch md:items-center md:justify-center md:p-3" onClick={handleClose}>
            <div className="bg-brand-dark md:rounded-2xl border border-white/10 w-full h-full md:w-[96vw] md:h-[96vh] md:max-w-[1600px] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
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

                {/* Toolbar */}
                <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between gap-2 flex-wrap shrink-0">
                    <FormationPicker value={formation} onChange={handleFormationChange} readOnly={readOnly} />
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">{filledCount}/{slots.length} on field</span>
                        {!readOnly && (
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving || !dirty}
                                className={`px-4 py-1.5 rounded-md font-display font-bold uppercase tracking-wider text-sm flex items-center gap-1.5 transition-all
                                    ${dirty && !saving ? 'bg-brand-green text-brand-dark hover:brightness-110' : 'bg-white/5 text-gray-500 cursor-not-allowed'}`}
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving ? 'Saving' : dirty ? 'Save' : 'Saved'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Body — the pitch ALWAYS takes the full body space (same
                    as the parent view, which already looked right). For staff
                    the bench is layered ON TOP as a floating overlay over the
                    opposition half (no slots there) so it never shrinks the
                    pitch. Mobile: full-width strip at top. Desktop: floating
                    panel pinned to the right edge. */}
                <div className="flex-1 min-h-0 p-2 md:p-3 overflow-hidden relative">
                    {loading ? (
                        <div className="flex-1 flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-brand-green" /></div>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <div className="w-full h-full flex items-center justify-center">
                                <SoccerPitch
                                    formation={formation}
                                    assignments={assignments}
                                    players={players}
                                    onUnassign={handleUnassign}
                                    readOnly={readOnly}
                                />
                            </div>
                            {!readOnly && (
                                <div className="absolute top-3 left-3 right-3 md:left-auto md:w-80 md:top-3 md:bottom-3 z-20">
                                    <AvailablePlayers players={players} assignments={assignments} readOnly={readOnly} />
                                </div>
                            )}
                        </DndContext>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LineupBuilder;
