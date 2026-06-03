import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { Trophy, TrendingUp, Clock, Flame, Loader2, PlayCircle, Target, Lock } from 'lucide-react';
import LogJuggleModal from './LogJuggleModal';

const STAMP_LADDER = [20, 30, 40, 50, 60, 70, 80, 90, 100];
const GOAL = 100;

const daysLeft = (dateStr) => {
    if (!dateStr) return null;
    const d = Math.ceil((new Date(dateStr + 'T23:59:59') - new Date()) / 86400000);
    return d >= 0 ? d : 0;
};

// The June Juggling Competition widget — used on the player and parent
// dashboards. Shows the player's baseline → current best → progress to 100
// with the stamp ladder, improvement, totals, a countdown, the team goal, a
// log/baseline button, and the Top-Score + Most-Improved leaderboards.
const JuggleChallengeCard = ({ playerId, teamId, playerName }) => {
    const [board, setBoard] = useState(null);     // { config, rows, baselines_locked }
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);      // 'baseline' | 'session' | null
    const [tab, setTab] = useState('top');         // 'top' | 'improved'

    const load = useCallback(async () => {
        if (!teamId) { setLoading(false); return; }
        const [{ data: lb }, { data: sm }] = await Promise.all([
            supabase.rpc('get_juggle_leaderboard', { p_team_id: teamId }),
            supabase.rpc('get_juggle_competition_summary', { p_team_id: teamId }),
        ]);
        setBoard(lb || null);
        setSummary(sm?.summary || null);
        setLoading(false);
    }, [teamId]);

    useEffect(() => { load(); }, [load]);

    if (loading) {
        return (
            <div className="glass-panel p-5 border-l-4 border-l-brand-gold flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-brand-gold animate-spin" />
            </div>
        );
    }
    if (!board) return null;

    const cfg = board.config || {};
    const rows = board.rows || [];
    const me = rows.find((r) => r.player_id === playerId) || null;
    const locked = board.baselines_locked;
    // Most Improved stays hidden until EVERY kid has entered a baseline, so no
    // one can size up the field before they've all committed a starting number.
    const withBaseline = rows.filter((r) => r.has_baseline).length;
    const improvedUnlocked = rows.length > 0 && withBaseline === rows.length;
    const endDays = daysLeft(cfg.ends_on);
    const finalsDays = daysLeft(cfg.finals_on);

    const best = me?.current_best ?? 0;
    const baseline = me?.has_baseline ? me.baseline : null;
    const improvement = me?.improvement ?? 0;
    const pct = Math.min(100, Math.round((best / GOAL) * 100));

    const topBoard = [...rows].sort((a, b) => b.current_best - a.current_best).slice(0, 8);
    const improvedBoard = [...rows].filter((r) => r.has_baseline)
        .sort((a, b) => b.improvement - a.improvement).slice(0, 8);
    // While locked, the Most-Improved board (and its very name) must stay
    // hidden — otherwise a kid who knows improvement is rewarded could lowball
    // their starting number to game it. Force Top Score until everyone's in.
    const shownBoard = (improvedUnlocked && tab === 'improved') ? improvedBoard : topBoard;

    return (
        <>
        <div className="glass-panel p-5 border-l-4 border-l-brand-gold animate-fade-in-up">
            {/* Header + countdown */}
            <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                    <h3 className="text-white font-display uppercase font-bold text-lg flex items-center gap-2">
                        <span className="text-xl">⚽</span> June Juggling Competition
                    </h3>
                    <p className="text-gray-400 text-xs mt-0.5">Get to {GOAL} juggles in a row by June 30!</p>
                </div>
                {endDays != null && (
                    <div className="text-right shrink-0">
                        <div className="text-brand-gold font-display font-bold text-2xl leading-none">{endDays}</div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500">days left</div>
                    </div>
                )}
            </div>

            {/* Finals banner */}
            {cfg.finals_on && finalsDays != null && finalsDays <= 10 && (
                <div className="mb-3 rounded-lg border border-brand-gold/40 bg-brand-gold/10 p-2.5 text-xs text-brand-gold font-medium flex items-center gap-2">
                    <Trophy className="w-4 h-4 shrink-0" /> 🏆 Juggle-Off at practice {new Date(cfg.finals_on + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — top jugglers compete for the prize!
                </div>
            )}

            {/* No baseline yet → kickoff CTA */}
            {!me?.has_baseline && !locked ? (
                <button onClick={() => setModal('baseline')}
                        className="w-full py-4 rounded-xl bg-brand-green text-brand-dark font-display font-bold uppercase tracking-wider hover:bg-white transition-colors flex items-center justify-center gap-2">
                    <PlayCircle className="w-5 h-5" /> Set your starting score
                </button>
            ) : (
                <>
                    {/* Progress to 100 with stamp ladder */}
                    <div className="mb-1.5 flex items-end justify-between">
                        <span className="text-sm text-gray-300">Your best: <span className="text-2xl font-display font-bold text-white">{best}</span> <span className="text-gray-500">/ {GOAL}</span></span>
                        {baseline != null && (
                            <span className="text-xs text-brand-green font-bold flex items-center gap-1">
                                <TrendingUp className="w-3.5 h-3.5" /> +{improvement} since start ({baseline})
                            </span>
                        )}
                    </div>
                    <div className="relative w-full h-2.5 bg-white/10 rounded-full overflow-hidden mb-1">
                        <div className="h-full bg-gradient-to-r from-brand-green to-brand-gold rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between mb-4 px-0.5">
                        {STAMP_LADDER.map((m) => (
                            <div key={m} className="flex flex-col items-center" style={{ width: '10%' }}>
                                <span className={`text-[13px] leading-none ${best >= m ? '' : 'grayscale opacity-30'}`}>{best >= m ? '⚽' : '·'}</span>
                                <span className={`text-[8px] mt-0.5 ${best >= m ? 'text-brand-gold' : 'text-gray-600'}`}>{m}</span>
                            </div>
                        ))}
                    </div>

                    {/* Totals */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-white/[0.03] rounded-lg p-2 text-center">
                            <Flame className="w-4 h-4 text-brand-gold mx-auto mb-0.5" />
                            <div className="text-white font-bold text-sm">{me?.total_juggles ?? 0}</div>
                            <div className="text-[9px] uppercase tracking-wider text-gray-500">total juggles</div>
                        </div>
                        <div className="bg-white/[0.03] rounded-lg p-2 text-center">
                            <Clock className="w-4 h-4 text-brand-green mx-auto mb-0.5" />
                            <div className="text-white font-bold text-sm">{me?.minutes ?? 0}</div>
                            <div className="text-[9px] uppercase tracking-wider text-gray-500">minutes</div>
                        </div>
                        <div className="bg-white/[0.03] rounded-lg p-2 text-center">
                            <Target className="w-4 h-4 text-blue-400 mx-auto mb-0.5" />
                            <div className="text-white font-bold text-sm">{me?.attempts ?? 0}</div>
                            <div className="text-[9px] uppercase tracking-wider text-gray-500">sessions</div>
                        </div>
                    </div>

                    <button onClick={() => setModal('session')}
                            className="w-full py-3 rounded-lg bg-brand-green text-brand-dark font-display font-bold uppercase tracking-wider hover:bg-white transition-colors flex items-center justify-center gap-2">
                        <PlayCircle className="w-5 h-5" /> Log a juggling session
                    </button>
                </>
            )}

            {/* Team goal */}
            {summary && (
                <div className="mt-4 text-center text-xs text-gray-400">
                    🔥 <span className="text-white font-bold">{summary.can_20}</span> of {summary.total_players} can juggle 20+ ·
                    Team total: <span className="text-white font-bold">{(summary.team_total_juggles || 0).toLocaleString()}</span> juggles
                </div>
            )}

            {/* Leaderboards */}
            <div className="mt-4 pt-4 border-t border-white/10">
                {improvedUnlocked ? (
                    /* Both boards revealed only once EVERY kid has a baseline. */
                    <div className="flex gap-2 mb-2">
                        <button onClick={() => setTab('top')}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${tab === 'top' ? 'bg-brand-gold/20 text-brand-gold' : 'bg-white/5 text-gray-400'}`}>
                            Top Score
                        </button>
                        <button onClick={() => setTab('improved')}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${tab === 'improved' ? 'bg-brand-green/20 text-brand-green' : 'bg-white/5 text-gray-400'}`}>
                            Most Improved
                        </button>
                    </div>
                ) : (
                    /* Locked: show ONLY Top Score. No "Most Improved" wording —
                       a metric-neutral teaser so kids don't learn improvement is
                       rewarded (which would invite sandbagging the baseline). */
                    <div className="flex items-center justify-between mb-2 gap-2">
                        <span className="py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider bg-brand-gold/20 text-brand-gold">
                            Top Score
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400">
                            <Lock className="w-3.5 h-3.5 text-brand-gold" />
                            Bonus prize unlocks at {withBaseline}/{rows.length} started
                        </span>
                    </div>
                )}
                <div className="space-y-1">
                    {shownBoard.length === 0 && <p className="text-center text-xs text-gray-500 py-3">No scores logged yet — be first!</p>}
                    {shownBoard.map((r, i) => (
                        <div key={r.player_id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${r.player_id === playerId ? 'bg-brand-green/10 border border-brand-green/20' : ''}`}>
                            <span className="w-5 text-center text-xs font-bold text-gray-500">{i + 1}</span>
                            <span className="flex-1 text-sm text-gray-200 truncate">{r.first_name} {r.last_initial}.{r.player_id === playerId ? ' (you)' : ''}</span>
                            <span className="text-sm font-bold text-white">
                                {(improvedUnlocked && tab === 'improved') ? `+${r.improvement}` : r.current_best}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

        </div>

        {/* Rendered as a SIBLING of the glass-panel (not a child): the panel's
            backdrop-filter would otherwise become the containing block for this
            fixed modal, squashing it to the card and letting the page scroll
            behind it. See feedback-firefc-glass-panel-trap. */}
        {modal && (
            <LogJuggleModal
                mode={modal}
                playerId={playerId}
                teamId={teamId}
                playerName={playerName}
                currentBest={best}
                onClose={() => setModal(null)}
                onDone={load}
            />
        )}
        </>
    );
};

export default JuggleChallengeCard;
