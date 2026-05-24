import React, { useEffect, useState, useMemo } from 'react';
import { X, Target, Check, Lock, Dumbbell, Loader2, Award, Square, CheckSquare, ChevronRight } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import { SKILL_BY_SLUG } from '../../data/idpSkills';

// Player-side read-only full view of the personal development plan.
//
// Three blocks stacked, current block highlighted, future blocks locked,
// past blocks marked Done. The current block's drills are multi-select
// with a single bottom CTA:
//
//   • mode='player' (default): "Start with N drill(s)" → solo builder
//     deep-link with all selected drills pre-loaded
//   • mode='parent': "Add to Challenges" → inserts assignment rows
//     tagged source='parent' for the player
//
// The mode is inferred from which dashboard rendered the card: if the
// component receives `onStartSoloDrill`, we're on the player dashboard
// and use Start. Otherwise (parent dashboard), we use Assign.

const PlayerIDPView = ({ idp, skills = [], playerName = 'You', playerId = null, teamId = null, onClose, onStartSoloDrill }) => {
    const { user } = useAuth();
    const toast = useToast();
    const [drillsByBlock, setDrillsByBlock] = useState({});
    const [loadingDrills, setLoadingDrills] = useState(true);
    const [selectedDrills, setSelectedDrills] = useState(new Set());
    const [submitting, setSubmitting] = useState(false);

    const isParentMode = !onStartSoloDrill;

    const skillsByBlock = useMemo(() => {
        const out = { 1: [], 2: [], 3: [] };
        for (const s of skills) {
            if (out[s.block_number]) out[s.block_number].push(s);
        }
        return out;
    }, [skills]);

    const currentBlock = idp?.current_block || 1;

    // Pre-fetch drills for each block that has skills
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoadingDrills(true);
            const map = {};
            for (const n of [1, 2, 3]) {
                const slugs = skillsByBlock[n].map((s) => s.skill_slug);
                if (slugs.length === 0) {
                    map[n] = [];
                    continue;
                }
                const { data } = await supabase
                    .from('drills')
                    .select('id, name, category, duration')
                    .overlaps('tagged_skills', slugs)
                    .eq('is_custom', false)
                    .limit(8);
                if (cancelled) return;
                map[n] = data || [];
            }
            if (!cancelled) {
                setDrillsByBlock(map);
                setLoadingDrills(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [skillsByBlock]);

    const toggleDrill = (drillId) => {
        setSelectedDrills((prev) => {
            const next = new Set(prev);
            if (next.has(drillId)) next.delete(drillId);
            else next.add(drillId);
            return next;
        });
    };

    const selectedCount = selectedDrills.size;
    const currentDrills = drillsByBlock[currentBlock] || [];

    const handleStartSelected = () => {
        if (selectedDrills.size === 0) return;
        if (onStartSoloDrill) {
            // Player mode: deep-link into solo builder with all selected ids
            const ids = Array.from(selectedDrills).join(',');
            onStartSoloDrill(ids);
            onClose();
            return;
        }
    };

    const handleAssignAsHomework = async () => {
        if (selectedDrills.size === 0) return;
        if (!playerId || !user?.id) {
            toast.error("Couldn't assign — missing player info.");
            return;
        }
        setSubmitting(true);
        try {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 7);
            const sessionId = (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const drillList = currentDrills.filter((d) => selectedDrills.has(d.id));
            const rows = drillList.map((d) => ({
                drill_id: d.id,
                player_id: playerId,
                team_id: teamId || null,
                assigned_by: user.id,
                source: 'parent',
                status: 'pending',
                custom_duration: d.duration || 15,
                due_date: dueDate.toISOString(),
                session_id: sessionId,
            }));
            const { error } = await supabase.from('assignments').insert(rows);
            if (error) throw error;
            toast.success(`Assigned ${rows.length} drill${rows.length === 1 ? '' : 's'} to ${playerName}.`);
            setSelectedDrills(new Set());
            onClose();
        } catch (err) {
            console.error('[PlayerIDPView] assign error', err);
            toast.error("Couldn't assign those drills. Try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
            onClick={onClose}
        >
            <div
                className="bg-brand-dark border border-white/10 w-full max-w-2xl h-[95vh] sm:h-auto sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
            >
                <div className="pt-7 sm:pt-5 px-5 pb-4 border-b border-white/10 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-gold/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Target className="w-5 h-5 text-brand-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-white font-display font-bold uppercase tracking-wider text-base truncate leading-snug">
                            {playerName}'s Personal Plan
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {idp.status === 'completed' ? '90-day plan completed' : `Block ${currentBlock} of 3`}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1 -m-1 text-gray-500 hover:text-white shrink-0">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                    {[1, 2, 3].map((n) => {
                        const rows = skillsByBlock[n];
                        const isCurrent = n === currentBlock && idp.status !== 'completed';
                        const isComplete = n < currentBlock || idp.status === 'completed';
                        const isLocked = n > currentBlock && idp.status !== 'completed';
                        const mastered = rows.filter((r) => r.status === 'mastered').length;
                        const blockDrills = drillsByBlock[n] || [];

                        return (
                            <div
                                key={n}
                                className={`rounded-2xl border-2 p-4 ${
                                    isCurrent
                                        ? 'border-brand-gold/50 bg-brand-gold/5'
                                        : isComplete
                                            ? 'border-brand-green/30 bg-brand-green/5'
                                            : 'border-white/10 bg-white/[0.02] opacity-70'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span
                                            className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded ${
                                                isCurrent
                                                    ? 'bg-brand-gold text-brand-dark'
                                                    : isComplete
                                                        ? 'bg-brand-green/20 text-brand-green'
                                                        : 'bg-white/10 text-gray-400'
                                            }`}
                                        >
                                            Block {n}
                                        </span>
                                        {isCurrent && (
                                            <span className="text-[10px] uppercase tracking-widest text-brand-gold/80 font-bold">Current</span>
                                        )}
                                        {isComplete && (
                                            <span className="text-[10px] uppercase tracking-widest text-brand-green/80 font-bold flex items-center gap-1">
                                                <Award className="w-3 h-3" /> Done
                                            </span>
                                        )}
                                        {isLocked && (
                                            <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold flex items-center gap-1">
                                                <Lock className="w-3 h-3" /> Locked
                                            </span>
                                        )}
                                    </div>
                                    {rows.length > 0 && (
                                        <span className="text-xs text-gray-500">
                                            {mastered}/{rows.length} mastered
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    {rows.length === 0 && (
                                        <p className="text-xs text-gray-500 italic">No skills picked for this block yet.</p>
                                    )}
                                    {rows.map((row) => {
                                        const meta = SKILL_BY_SLUG[row.skill_slug];
                                        if (!meta) return null;
                                        const isMastered = row.status === 'mastered';
                                        return (
                                            <div
                                                key={row.id}
                                                className={`flex items-center gap-2 p-2 rounded-lg border ${
                                                    isMastered
                                                        ? 'bg-brand-green/10 border-brand-green/30'
                                                        : 'bg-white/5 border-white/10'
                                                }`}
                                            >
                                                <span className="text-lg">{meta.icon}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-bold ${isMastered ? 'text-brand-green' : 'text-white'}`}>
                                                        {meta.name}
                                                    </p>
                                                    <p className="text-[10px] uppercase tracking-wider text-gray-500">{meta.category}</p>
                                                </div>
                                                {isMastered && (
                                                    <span className="text-[10px] uppercase tracking-wider text-brand-green font-bold flex items-center gap-1">
                                                        <Check className="w-3 h-3" /> Mastered
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Current block drills (multi-select) */}
                                {isCurrent && (
                                    <div className="mt-4 pt-4 border-t border-white/10">
                                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2 flex items-center gap-1.5">
                                            <Dumbbell className="w-3 h-3 text-brand-green" /> Drills for this block - tap to select
                                        </p>
                                        {loadingDrills ? (
                                            <div className="flex items-center justify-center py-4">
                                                <Loader2 className="w-5 h-5 text-brand-green animate-spin" />
                                            </div>
                                        ) : blockDrills.length === 0 ? (
                                            <p className="text-xs text-gray-500 italic py-2">No matching drills in the library yet.</p>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {blockDrills.map((d) => {
                                                    const isSelected = selectedDrills.has(d.id);
                                                    return (
                                                        <button
                                                            key={d.id}
                                                            onClick={() => toggleDrill(d.id)}
                                                            className={`w-full text-left flex items-center gap-2 p-2 rounded border transition-colors ${
                                                                isSelected
                                                                    ? 'bg-brand-green/15 border-brand-green/40'
                                                                    : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10'
                                                            }`}
                                                        >
                                                            {isSelected ? (
                                                                <CheckSquare className="w-4 h-4 text-brand-green shrink-0" />
                                                            ) : (
                                                                <Square className="w-4 h-4 text-gray-500 shrink-0" />
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`text-sm truncate ${isSelected ? 'text-brand-green font-bold' : 'text-white'}`}>{d.name}</p>
                                                                <p className="text-[10px] text-gray-500 truncate">
                                                                    {d.category} · {d.duration || 10} min
                                                                </p>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    <p className="text-[10px] text-gray-600 text-center pt-2">
                        Only your coach can mark skills mastered.
                    </p>
                </div>

                {/* Sticky bottom CTA */}
                {currentDrills.length > 0 && (
                    <div className="border-t border-white/10 p-4 shrink-0 bg-brand-dark">
                        {isParentMode ? (
                            <button
                                onClick={handleAssignAsHomework}
                                disabled={selectedCount === 0 || submitting}
                                className="w-full py-3 rounded-xl font-display font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-blue-500/40"
                            >
                                {submitting ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Assigning…</>
                                ) : (
                                    <>Add {selectedCount > 0 ? `${selectedCount} ` : ''}to Challenges <ChevronRight className="w-4 h-4" /></>
                                )}
                            </button>
                        ) : (
                            <button
                                onClick={handleStartSelected}
                                disabled={selectedCount === 0}
                                className="w-full py-3 rounded-xl font-display font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-brand-green to-green-500 text-brand-dark shadow-lg shadow-brand-green/30 hover:shadow-brand-green/50 hover:scale-[1.02]"
                            >
                                Start {selectedCount > 0 ? `${selectedCount} ` : ''}Drill{selectedCount === 1 ? '' : 's'}
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        )}
                        <p className="text-[10px] text-gray-500 text-center mt-2">
                            {isParentMode
                                ? 'Drills land in the coach challenge list — kid sees them on their dashboard.'
                                : 'Selected drills will load into your solo training session.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlayerIDPView;
