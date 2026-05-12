import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Target, ChevronRight, Loader2, Check, Lock } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { SKILL_BY_SLUG } from '../../data/idpSkills';

const PlayerIDPView = lazy(() => import('./PlayerIDPView'));

// "Bo's IDP — Click to lock in!" card.
//
// Slots into the player dashboard right below the "Train like a champion
// today" banner. Also mirrored read-only on the parent dashboard. The
// card itself is read-only — mastery is coach-driven.
//
// Props:
//   playerId       — players.id (UUID)
//   playerName     — display name (for the headline)
//   onStartSoloDrill(drillId) — optional handler; if omitted, the view
//                                falls back to a new-tab /player-dashboard?drillIds=
//                                deep-link.

const PlayerIDPCard = ({ playerId, playerName = 'Player', teamId = null, onStartSoloDrill = null }) => {
    const [idp, setIdp] = useState(null);
    const [skills, setSkills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showView, setShowView] = useState(false);

    useEffect(() => {
        if (!playerId) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const { data: idpRow } = await supabase
                    .from('player_idps')
                    .select('id, title, start_date, end_date, status, current_block, block_duration_days')
                    .eq('player_id', playerId)
                    .in('status', ['active', 'completed'])
                    .order('start_date', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (cancelled) return;

                if (!idpRow) {
                    setIdp(null);
                    setSkills([]);
                    setLoading(false);
                    return;
                }

                const { data: progress } = await supabase
                    .from('idp_skill_progress')
                    .select('id, block_number, skill_slug, status, mastered_at')
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
    }, [playerId]);

    if (loading) {
        return (
            <div className="glass-panel p-5 border-l-4 border-brand-gold flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-brand-gold animate-spin" />
                <span className="text-sm text-gray-400">Loading your plan…</span>
            </div>
        );
    }

    const firstName = (playerName || '').split(' ')[0] || 'Player';

    // No IDP — friendly empty state
    if (!idp) {
        return (
            <div className="glass-panel p-5 border-l-4 border-brand-gold/40 flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-gold/15 flex items-center justify-center shrink-0">
                    <Target className="w-5 h-5 text-brand-gold" />
                </div>
                <div className="min-w-0">
                    <p className="text-white font-bold">{firstName}'s IDP</p>
                    <p className="text-xs text-gray-400 mt-1">No plan yet — ask your coach to start your 90-day development plan.</p>
                </div>
            </div>
        );
    }

    const currentBlock = idp.current_block || 1;
    const blockSkills = skills.filter((s) => s.block_number === currentBlock);
    const mastered = blockSkills.filter((s) => s.status === 'mastered').length;
    const total = blockSkills.length;
    const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
    const isComplete = idp.status === 'completed';

    return (
        <>
            <button
                onClick={() => setShowView(true)}
                className="w-full text-left p-5 rounded-2xl border-2 border-brand-gold/50 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] shadow-lg hover:shadow-brand-gold/20 hover:border-brand-gold transition-all group"
            >
                <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-brand-gold/20 border-2 border-brand-gold/40 flex items-center justify-center shrink-0">
                        <Target className="w-6 h-6 text-brand-gold" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-white font-display font-bold text-lg uppercase tracking-wider">
                                {firstName}'s IDP
                            </p>
                            {isComplete && (
                                <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded bg-brand-green/20 text-brand-green">
                                    Completed
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-brand-gold/80 uppercase tracking-wider mt-1">
                            {isComplete
                                ? '90-Day plan completed'
                                : `Block ${currentBlock} of 3 · mastering ${total || 0} ${total === 1 ? 'move' : 'moves'}`}
                        </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-brand-gold transition-colors" />
                </div>

                {total > 0 && (
                    <>
                        <div className="mt-4 w-full h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-brand-green to-brand-gold rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                        <p className="mt-2 text-[11px] text-gray-400">
                            <span className="text-brand-green font-bold">{mastered}</span> of {total} mastered
                        </p>
                    </>
                )}

                {/* Skill chips */}
                {blockSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                        {blockSkills.map((s) => {
                            const meta = SKILL_BY_SLUG[s.skill_slug];
                            if (!meta) return null;
                            const isMastered = s.status === 'mastered';
                            return (
                                <span
                                    key={s.skill_slug}
                                    className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded border ${
                                        isMastered
                                            ? 'bg-brand-green/15 border-brand-green/30 text-brand-green'
                                            : 'bg-white/5 border-white/10 text-gray-300'
                                    }`}
                                >
                                    {isMastered ? <Check className="w-3 h-3 inline mr-1" /> : null}
                                    {meta.icon} {meta.name}
                                </span>
                            );
                        })}
                    </div>
                )}

                {blockSkills.length === 0 && !isComplete && (
                    <p className="mt-3 text-xs text-gray-500 italic">
                        Coach hasn't picked your skills for this block yet.
                    </p>
                )}

                <div className="mt-4 flex justify-center">
                    <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-brand-green to-green-500 text-brand-dark font-display font-black uppercase tracking-widest text-sm shadow-lg shadow-brand-green/30 group-hover:scale-105 group-hover:shadow-brand-green/50 transition-all">
                        Click to Lock In
                        <ChevronRight className="w-4 h-4" />
                    </span>
                </div>
            </button>

            {showView && (
                <Suspense fallback={null}>
                    <PlayerIDPView
                        idp={idp}
                        skills={skills}
                        playerName={firstName}
                        playerId={playerId}
                        teamId={teamId}
                        onClose={() => setShowView(false)}
                        onStartSoloDrill={onStartSoloDrill}
                    />
                </Suspense>
            )}
        </>
    );
};

export default PlayerIDPCard;
