import React, { useState, useEffect } from 'react';
import { Target, CheckCircle, Circle, Award, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { SKILL_BY_SLUG } from '../../data/idpSkills';

// Legacy IDPBuilder — now a read-only summary mounted inside the IDP tab
// of PlayerEvaluationModal. The full build/edit experience lives in the
// new IDP Hub (Coach Dashboard → IDP tab → tap a player).
//
// Reads the active IDP for this player + skill progress, renders a
// condensed status block: current block, progress bar, mastered skills.
// Has a single CTA "Open in IDP Hub →" that closes the eval modal and
// switches the dashboard to the IDP tab.

const IDPBuilder = ({ player, readOnly = false, onJumpToHub = null }) => {
    const [idp, setIdp] = useState(null);
    const [skills, setSkills] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!player?.id) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const { data: idpRow } = await supabase
                    .from('player_idps')
                    .select('id, title, start_date, end_date, status, current_block, block_duration_days')
                    .eq('player_id', player.id)
                    .in('status', ['active', 'completed'])
                    .order('start_date', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (cancelled) return;
                if (!idpRow) {
                    setIdp(null);
                    setSkills([]);
                    return;
                }

                const { data: progress } = await supabase
                    .from('idp_skill_progress')
                    .select('id, block_number, skill_slug, status')
                    .eq('idp_id', idpRow.id);
                if (cancelled) return;

                setIdp(idpRow);
                setSkills(progress || []);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [player?.id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 text-brand-gold animate-spin" />
            </div>
        );
    }

    if (!idp) {
        return (
            <div className="text-center py-8 space-y-3">
                <div className="w-12 h-12 rounded-full bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center mx-auto">
                    <Target className="w-6 h-6 text-brand-gold" />
                </div>
                <p className="text-white font-bold">No active IDP yet</p>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    Start a 90-day Individual Development Plan for this player from the IDP tab on the coach dashboard.
                </p>
                {onJumpToHub && (
                    <button
                        onClick={onJumpToHub}
                        className="mt-3 px-4 py-2 bg-brand-gold/20 border border-brand-gold/40 hover:bg-brand-gold/30 rounded text-brand-gold text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5"
                    >
                        Open IDP Hub <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        );
    }

    const currentBlock = idp.current_block || 1;
    const blockSkills = skills.filter((s) => s.block_number === currentBlock);
    const mastered = blockSkills.filter((s) => s.status === 'mastered').length;
    const total = blockSkills.length;
    const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
    const allMastered = skills.filter((s) => s.status === 'mastered').length;

    return (
        <div className="space-y-4">
            <div className="rounded-2xl border-2 border-brand-gold/40 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] p-4 sm:p-5">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-brand-gold/20 flex items-center justify-center shrink-0">
                        <Target className="w-5 h-5 text-brand-gold" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-white font-bold truncate">{idp.title || 'Development Plan'}</p>
                        <p className="text-xs text-gray-400">
                            {idp.status === 'completed' ? 'Completed' : `Block ${currentBlock} of 3 · ${total} ${total === 1 ? 'skill' : 'skills'}`}
                        </p>
                    </div>
                    {idp.status === 'completed' && (
                        <Award className="w-6 h-6 text-brand-gold shrink-0" />
                    )}
                </div>

                {total > 0 && (
                    <>
                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                            <div
                                className="h-full bg-gradient-to-r from-brand-green to-brand-gold rounded-full"
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                        <p className="text-xs text-gray-400 mb-3">
                            <span className="text-brand-green font-bold">{mastered}</span> of {total} mastered in this block · <span className="text-brand-gold font-bold">{allMastered}</span> badges earned overall
                        </p>
                    </>
                )}

                <div className="flex flex-wrap gap-1.5">
                    {blockSkills.map((row) => {
                        const meta = SKILL_BY_SLUG[row.skill_slug];
                        if (!meta) return null;
                        const isMastered = row.status === 'mastered';
                        return (
                            <span
                                key={row.id}
                                className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded border flex items-center gap-1 ${
                                    isMastered
                                        ? 'bg-brand-green/15 border-brand-green/30 text-brand-green'
                                        : 'bg-white/5 border-white/10 text-gray-300'
                                }`}
                            >
                                {isMastered ? <CheckCircle className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                                {meta.icon} {meta.name}
                            </span>
                        );
                    })}
                    {blockSkills.length === 0 && (
                        <span className="text-xs text-gray-500 italic">No skills picked for the current block yet.</span>
                    )}
                </div>
            </div>

            {onJumpToHub && !readOnly && (
                <button
                    onClick={onJumpToHub}
                    className="w-full py-3 bg-brand-gold/15 hover:bg-brand-gold/25 border border-brand-gold/30 hover:border-brand-gold/50 rounded-xl text-brand-gold text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                >
                    Manage in IDP Hub <ChevronRight className="w-4 h-4" />
                </button>
            )}
        </div>
    );
};

export default IDPBuilder;
