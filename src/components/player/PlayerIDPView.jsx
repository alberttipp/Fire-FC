import React, { useEffect, useState, useMemo } from 'react';
import { X, Target, Check, Lock, Dumbbell, Loader2, Award } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { SKILL_BY_SLUG } from '../../data/idpSkills';

// Player-side read-only full view of the IDP. Three blocks stacked,
// current block highlighted, drills surfaced with "Start solo" buttons
// that deep-link into ParentSessionBuilder (handled by parent component
// via onStartSoloDrill, or via new-tab URL if absent).

const PlayerIDPView = ({ idp, skills = [], playerName = 'You', onClose, onStartSoloDrill }) => {
    const [drillsByBlock, setDrillsByBlock] = useState({});

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
            if (!cancelled) setDrillsByBlock(map);
        })();
        return () => {
            cancelled = true;
        };
    }, [skillsByBlock]);

    const handleSolo = (drillId) => {
        if (onStartSoloDrill) {
            onStartSoloDrill(drillId);
            return;
        }
        // Fallback: open a new tab on the player dashboard with the drill
        // pre-selected (for the case where coach is previewing).
        const params = new URLSearchParams({ drillIds: drillId, from: 'idp' });
        window.open(`/player-dashboard?${params.toString()}`, '_blank');
    };

    return (
        <div
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
            onClick={onClose}
        >
            <div
                className="bg-brand-dark border border-white/10 w-full max-w-2xl h-[95vh] sm:h-auto sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-5 border-b border-white/10 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-gold/20 flex items-center justify-center">
                        <Target className="w-5 h-5 text-brand-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-white font-display font-bold uppercase tracking-wider">{playerName}'s IDP</h3>
                        <p className="text-xs text-gray-400">
                            {idp.status === 'completed'
                                ? '90-day plan completed 🏆'
                                : `Block ${currentBlock} of 3`}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1 -m-1 text-gray-500 hover:text-white">
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
                                    <div className="flex items-center gap-2">
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
                                            <span className="text-[10px] uppercase tracking-widest text-brand-gold/80 font-bold">
                                                Current
                                            </span>
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

                                {/* Current block drills */}
                                {isCurrent && (drillsByBlock[n]?.length || 0) > 0 && (
                                    <div className="mt-4 pt-4 border-t border-white/10">
                                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2 flex items-center gap-1.5">
                                            <Dumbbell className="w-3 h-3 text-brand-green" /> Drills for this block
                                        </p>
                                        <div className="space-y-1.5">
                                            {drillsByBlock[n].slice(0, 6).map((d) => (
                                                <div
                                                    key={d.id}
                                                    className="flex items-center gap-2 p-2 rounded bg-white/[0.02] border border-white/5"
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-white truncate">{d.name}</p>
                                                        <p className="text-[10px] text-gray-500 truncate">
                                                            {d.category} · {d.duration || 10} min
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleSolo(d.id)}
                                                        className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-brand-green/15 border border-brand-green/30 text-brand-green hover:bg-brand-green/25"
                                                    >
                                                        Solo
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    <p className="text-[10px] text-gray-600 text-center pt-2">
                        Only your coach can mark skills mastered.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PlayerIDPView;
