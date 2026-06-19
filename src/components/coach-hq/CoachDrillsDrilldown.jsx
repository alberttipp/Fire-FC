import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Dumbbell, EyeOff, Eye, ArrowUpCircle, Tag } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useToast } from '../Toast';

// Coach oversight of family-created custom drills: recategorize (keeps the
// rating tie-in correct), hide a junk one (drops it from families' pickers),
// or promote a great one into the shared team library. Staff-only — all writes
// go through SECURITY DEFINER RPCs (coach_set_drill / coach_promote_drill).
const CATEGORIES = [
    'Dribbling & 1v1', 'Ball Mastery (Solo)', 'First Touch', 'Passing & Receiving',
    'Finishing & Shooting', 'Speed & Agility', 'Conditioning', 'Defending',
    'Tactical / Game Intelligence', 'Goalkeeper', 'Warm-Up', 'Cool Down',
];

const CoachDrillsDrilldown = ({ teamId, onClose }) => {
    const toast = useToast();
    const [drills, setDrills] = useState(null);
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(async () => {
        if (!teamId) return;
        const { data, error } = await supabase.rpc('get_team_custom_drills', { p_team_id: teamId });
        if (error) { toast.error("Couldn't load player drills."); setDrills([]); return; }
        setDrills(data || []);
    }, [teamId]);
    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    const recategorize = async (d, category) => {
        setBusyId(d.id);
        const { error } = await supabase.rpc('coach_set_drill', { p_drill_id: d.id, p_category: category, p_hidden: null });
        setBusyId(null);
        if (error) { toast.error("Couldn't update."); return; }
        setDrills(prev => prev.map(x => x.id === d.id ? { ...x, category } : x));
        toast.success('Recategorized.');
    };
    const toggleHide = async (d) => {
        setBusyId(d.id);
        const { error } = await supabase.rpc('coach_set_drill', { p_drill_id: d.id, p_category: null, p_hidden: !d.hidden });
        setBusyId(null);
        if (error) { toast.error("Couldn't update."); return; }
        setDrills(prev => prev.map(x => x.id === d.id ? { ...x, hidden: !d.hidden } : x));
    };
    const promote = async (d) => {
        setBusyId(d.id);
        const { error } = await supabase.rpc('coach_promote_drill', { p_drill_id: d.id });
        setBusyId(null);
        if (error) { toast.error("Couldn't promote."); return; }
        setDrills(prev => prev.filter(x => x.id !== d.id)); // now a library drill, not a player custom
        toast.success('Promoted to the team library! 📚');
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-brand-dark border border-white/10 w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                 style={{ maxHeight: 'min(90vh, 90dvh)' }} onClick={(e) => e.stopPropagation()}>
                <div className="shrink-0 border-b border-white/10 p-4 flex items-center gap-3">
                    <Dumbbell className="w-5 h-5 text-brand-green" />
                    <h3 className="text-white font-bold flex-1">Player-created drills</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
                    {!drills ? (
                        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>
                    ) : drills.length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-10">No families have created custom drills yet.</p>
                    ) : drills.map(d => (
                        <div key={d.id} className={`rounded-lg border p-3 ${d.hidden ? 'border-white/10 bg-white/[0.02] opacity-60' : 'border-white/10 bg-white/5'}`}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <p className="text-white text-sm font-bold truncate">
                                        {d.name}
                                        {d.hidden && <span className="ml-2 text-[10px] text-gray-500 uppercase tracking-wider">Hidden</span>}
                                    </p>
                                    <p className="text-xs text-gray-500">by {d.player}{Array.isArray(d.tagged_skills) && d.tagged_skills.length ? ` · builds ${d.tagged_skills.join(', ')}` : ''}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => toggleHide(d)} disabled={busyId === d.id} title={d.hidden ? 'Unhide' : 'Hide from families'} className="p-1.5 rounded hover:bg-white/10 text-gray-400">
                                        {d.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                    </button>
                                    <button onClick={() => promote(d)} disabled={busyId === d.id} title="Promote to team library" className="p-1.5 rounded hover:bg-brand-green/10 text-brand-green">
                                        <ArrowUpCircle className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                                <Tag className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                <select
                                    value={d.category}
                                    onChange={(e) => recategorize(d, e.target.value)}
                                    disabled={busyId === d.id}
                                    className="flex-1 bg-white/5 border border-white/10 rounded p-1.5 text-white text-xs"
                                >
                                    {!CATEGORIES.includes(d.category) && <option value={d.category} className="bg-brand-dark">{d.category}</option>}
                                    {CATEGORIES.map(c => <option key={c} value={c} className="bg-brand-dark">{c}</option>)}
                                </select>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="shrink-0 border-t border-white/10 p-3 text-[10px] text-gray-500 text-center">
                    Recategorize to fix the rating skill · Hide drops it from families' pickers · Promote moves it into the shared team library.
                </div>
            </div>
        </div>
    );
};

export default CoachDrillsDrilldown;
