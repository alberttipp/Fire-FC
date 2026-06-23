import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { Swords, Plus, Loader2, Crown } from 'lucide-react';
import LogFamilyJuggleModal from './LogFamilyJuggleModal';

// The "Family Juggle-Off" — a fun, SEPARATE final-stretch event where parents
// & siblings post a best run to challenge the players. Reads the isolated
// juggle_family_attempts table via get_family_juggle_board; never mixes with
// the kids' leaderboard, team goal, or prizes.
//
// Two parts:
//   1. Head-to-head for THIS player — "Bo 74 🆚 Dad 12" (the real hook)
//   2. A team-wide grown-ups & siblings leaderboard (bragging rights)
const KIND_EMOJI = { parent: '👤', sibling: '🧒' };

const FamilyJuggleOff = ({ playerId, teamId, playerName, playerBest = 0 }) => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);

    const load = useCallback(async () => {
        if (!teamId) { setLoading(false); return; }
        const { data } = await supabase.rpc('get_family_juggle_board', { p_team_id: teamId });
        setRows(data?.rows || []);
        setLoading(false);
    }, [teamId]);

    useEffect(() => { load(); }, [load]);

    // This player's challengers (for the head-to-head), best first.
    const mine = rows.filter(r => r.player_id === playerId).sort((a, b) => b.best_count - a.best_count);
    // Team-wide board, top 6.
    const board = [...rows].sort((a, b) => b.best_count - a.best_count).slice(0, 6);
    const topBeat = mine.find(r => r.best_count >= playerBest && playerBest > 0);

    return (
        <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                    <h4 className="text-white font-display uppercase font-bold text-base flex items-center gap-2">
                        <Swords className="w-4 h-4 text-brand-gold" /> Family Juggle-Off
                    </h4>
                    <p className="text-gray-400 text-xs mt-0.5">Can a grown-up or big sib out-juggle our players? 😏 Just for fun — doesn't affect the competition.</p>
                </div>
            </div>

            {/* Head-to-head for this player */}
            {playerName && (
                <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3 mb-3">
                    {mine.length === 0 ? (
                        <p className="text-center text-xs text-gray-400 py-1">
                            No challengers yet. Think a parent or sibling can beat <span className="text-white font-bold">{playerName}</span>'s {playerBest}? Add them! 👇
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {mine.map(r => {
                                const playerWinning = playerBest >= r.best_count;
                                return (
                                    <div key={r.id} className="flex items-center gap-2 text-sm">
                                        <span className="font-bold text-white shrink-0">{playerName}</span>
                                        <span className="font-mono font-bold text-brand-green">{playerBest}</span>
                                        <span className="text-gray-500 text-xs px-1">🆚</span>
                                        <span className="text-gray-200 truncate">{KIND_EMOJI[r.participant_kind]} {r.participant_label}</span>
                                        <span className="font-mono font-bold text-white">{r.best_count}</span>
                                        <span className={`ml-auto text-[11px] font-bold shrink-0 ${playerWinning ? 'text-brand-green' : 'text-brand-gold'}`}>
                                            {playerWinning ? `${playerName} leads 💪` : `${r.participant_label} leads 😮`}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            <button onClick={() => setOpen(true)}
                    className="w-full py-2.5 rounded-lg bg-brand-gold/15 text-brand-gold font-display font-bold uppercase tracking-wider text-sm hover:bg-brand-gold/25 transition-colors flex items-center justify-center gap-2 mb-3">
                <Plus className="w-4 h-4" /> Add a grown-up or sibling
            </button>

            {/* Team-wide family board */}
            {loading ? (
                <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 text-brand-gold animate-spin" /></div>
            ) : board.length > 0 && (
                <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1.5 flex items-center gap-1">
                        <Crown className="w-3 h-3 text-brand-gold" /> Top challengers (whole team)
                    </p>
                    <div className="space-y-1">
                        {board.map((r, i) => (
                            <div key={r.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.02]">
                                <span className="w-5 text-center text-xs font-bold text-gray-500">{i + 1}</span>
                                <span className="flex-1 text-sm text-gray-200 truncate">
                                    {KIND_EMOJI[r.participant_kind]} {r.participant_label}
                                    <span className="text-gray-500 text-xs"> · {r.player_first}'s family</span>
                                </span>
                                <span className="text-sm font-bold text-white">{r.best_count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {open && (
                <LogFamilyJuggleModal
                    playerId={playerId}
                    playerName={playerName}
                    onClose={() => setOpen(false)}
                    onDone={load}
                />
            )}
        </div>
    );
};

export default FamilyJuggleOff;
