import React, { useState, useEffect, useCallback } from 'react';
import { Dumbbell, Play, Pencil, Trash2, X, ChevronUp, ListChecks } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useToast } from '../Toast';

// Standalone "My Training" shelf on the dashboard: the player's saved Routines
// (start one in a tap, rename, remove drills, delete) + their custom Drills
// (remove). Reads via RLS; routine edits are direct table ops (FOR ALL policy),
// custom-drill removal goes through hide_my_custom_drill (drills has no delete).
const MyTrainingShelf = ({ playerId, onStartRoutine }) => {
    const toast = useToast();
    const [routines, setRoutines] = useState(null);
    const [customs, setCustoms] = useState([]);
    const [editId, setEditId] = useState(null);
    const [renameVal, setRenameVal] = useState('');
    const [busy, setBusy] = useState(false);

    const fetchAll = useCallback(async () => {
        if (!playerId) return;
        const [{ data: r }, { data: c }] = await Promise.all([
            supabase.from('drill_routines')
                .select('id, name, drill_routine_items(id, position, custom_duration, drills(id, name, category, duration, description))')
                .eq('player_id', playerId).order('created_at', { ascending: false }),
            supabase.from('drills').select('id, name, category, duration')
                .eq('is_custom', true).eq('owner_player_id', playerId).eq('hidden', false)
                .order('created_at', { ascending: false }),
        ]);
        setRoutines(r || []);
        setCustoms(c || []);
    }, [playerId]);
    useEffect(() => { fetchAll(); }, [fetchAll]);

    const itemsOf = (r) => (r.drill_routine_items || []).filter(it => it.drills).sort((a, b) => (a.position || 0) - (b.position || 0));
    const minsOf = (r) => itemsOf(r).reduce((s, it) => s + (it.custom_duration || it.drills?.duration || 0), 0);

    const saveRename = async (r) => {
        const name = renameVal.trim();
        if (!name || name === r.name) return;
        const { error } = await supabase.from('drill_routines').update({ name }).eq('id', r.id);
        if (error) { toast.error("Couldn't rename."); return; }
        setRoutines(prev => prev.map(x => x.id === r.id ? { ...x, name } : x));
    };
    const removeItem = async (r, itemId) => {
        const { error } = await supabase.from('drill_routine_items').delete().eq('id', itemId);
        if (error) { toast.error("Couldn't remove drill."); return; }
        setRoutines(prev => prev.map(x => x.id === r.id ? { ...x, drill_routine_items: (x.drill_routine_items || []).filter(it => it.id !== itemId) } : x));
    };
    const deleteRoutine = async (r) => {
        if (!window.confirm(`Delete routine "${r.name}"?`)) return;
        setBusy(true);
        const { error } = await supabase.from('drill_routines').delete().eq('id', r.id);
        setBusy(false);
        if (error) { toast.error("Couldn't delete."); return; }
        setRoutines(prev => prev.filter(x => x.id !== r.id));
        setEditId(null);
        toast.success('Routine deleted.');
    };
    const removeCustom = async (d) => {
        if (!window.confirm(`Remove "${d.name}" from your drills?`)) return;
        const { error } = await supabase.rpc('hide_my_custom_drill', { p_drill_id: d.id, p_hidden: true });
        if (error) { toast.error("Couldn't remove."); return; }
        setCustoms(prev => prev.filter(x => x.id !== d.id));
        toast.success('Removed.');
    };

    // Nothing to show yet → keep the dashboard clean (don't render an empty card).
    if (routines === null) return null;
    if (routines.length === 0 && customs.length === 0) return null;

    return (
        <div className="glass-panel p-4">
            <h3 className="text-white font-bold flex items-center gap-2 mb-3">
                <Dumbbell className="w-5 h-5 text-brand-green" /> My Training
            </h3>

            {routines.length > 0 && (
                <div className="mb-4">
                    <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2 flex items-center gap-1"><ListChecks className="w-3 h-3" /> Routines</div>
                    <div className="space-y-2">
                        {routines.map(r => {
                            const items = itemsOf(r);
                            const editing = editId === r.id;
                            return (
                                <div key={r.id} className="bg-white/5 border border-white/10 rounded-lg p-2.5">
                                    <div className="flex items-center gap-2">
                                        {editing ? (
                                            <input
                                                value={renameVal} autoFocus
                                                onChange={(e) => setRenameVal(e.target.value)}
                                                onBlur={() => saveRename(r)}
                                                onKeyDown={(e) => e.key === 'Enter' && saveRename(r)}
                                                className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded p-1.5 text-white text-sm"
                                            />
                                        ) : (
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white text-sm font-bold truncate">{r.name}</p>
                                                <p className="text-xs text-gray-500">{items.length} drill{items.length === 1 ? '' : 's'} · {minsOf(r)} min</p>
                                            </div>
                                        )}
                                        {!editing && (
                                            <button onClick={() => onStartRoutine?.(r)} className="px-2.5 py-1.5 rounded bg-brand-green/15 text-brand-green text-xs font-bold flex items-center gap-1 hover:bg-brand-green/25 shrink-0">
                                                <Play className="w-3.5 h-3.5" /> Start
                                            </button>
                                        )}
                                        <button onClick={() => { if (editing) { setEditId(null); } else { setEditId(r.id); setRenameVal(r.name); } }} className="p-1.5 rounded hover:bg-white/10 text-gray-400 shrink-0">
                                            {editing ? <ChevronUp className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    {editing && (
                                        <div className="mt-2 space-y-1">
                                            {items.map(it => (
                                                <div key={it.id} className="flex items-center justify-between bg-white/5 rounded px-2 py-1.5">
                                                    <span className="text-xs text-gray-300 truncate">{it.drills.name}</span>
                                                    <button onClick={() => removeItem(r, it.id)} className="p-1 text-gray-500 hover:text-red-400 shrink-0"><X className="w-3.5 h-3.5" /></button>
                                                </div>
                                            ))}
                                            {items.length === 0 && <p className="text-[11px] text-gray-500">No drills left — delete this routine.</p>}
                                            <button onClick={() => deleteRoutine(r)} disabled={busy} className="mt-1 text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 disabled:opacity-50">
                                                <Trash2 className="w-3 h-3" /> Delete routine
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {customs.length > 0 && (
                <div>
                    <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">My Drills</div>
                    <div className="space-y-1.5">
                        {customs.map(d => (
                            <div key={d.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-2.5 py-2">
                                <div className="min-w-0">
                                    <p className="text-white text-sm font-medium truncate">{d.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{d.category}</p>
                                </div>
                                <button onClick={() => removeCustom(d)} title="Remove" className="p-1.5 text-gray-500 hover:text-red-400 shrink-0"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyTrainingShelf;
