import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabaseClient';
import { useToast } from '../Toast';
import { X, Loader2, CheckCircle2, ShieldCheck, ChevronDown } from 'lucide-react';

// Coach batch-verify grid ("Station Day"). Pick a skill, then tap each player who's
// shown it — verifying a rung cascades down (RPC), so "20 juggles" completes 5 & 10.
// Context (practice / game / station day) is recorded on every verification, so the
// coach can verify anytime he sees the skill, not only on a dedicated day.
const CONTEXTS = [
    { k: 'practice', l: 'Practice' },
    { k: 'game', l: 'Game' },
    { k: 'station_day', l: 'Station Day' },
];

const SkillVerifyView = ({ teamId, onClose }) => {
    const toast = useToast();
    const [matrix, setMatrix] = useState(null);
    const [loading, setLoading] = useState(true);
    const [ctx, setCtx] = useState('practice');
    const [skillIdx, setSkillIdx] = useState(0);
    const [busy, setBusy] = useState(null);

    const load = useCallback(async () => {
        if (!teamId) return;
        const { data, error } = await supabase.rpc('get_team_skill_matrix', { p_team_id: teamId });
        if (!error && data) setMatrix(data);
        setLoading(false);
    }, [teamId]);
    useEffect(() => { load(); }, [load]);

    const skills = matrix?.skills || [];
    const players = matrix?.players || [];
    const skill = skills[skillIdx];
    const rungs = skill?.rungs || [];

    const statusOf = (p, rungId) => p.progress?.[rungId]?.status;
    const rungAchieved = (p, rungId) => statusOf(p, rungId) === 'achieved';
    const skillDone = (p) => rungs.length > 0 && rungs.every((r) => rungAchieved(p, r.rung_id));
    const anyRequested = (p) => rungs.some((r) => statusOf(p, r.rung_id) === 'requested');
    const skillHasRequests = (sk) => players.some((p) => sk.rungs?.some((r) => p.progress?.[r.rung_id]?.status === 'requested'));

    const verify = async (p, rung) => {
        if (rungAchieved(p, rung.rung_id)) return;
        setBusy(p.player_id + ':' + rung.rung_id);
        try {
            const { error } = await supabase.rpc('verify_skill_rung', { p_player_id: p.player_id, p_rung_id: rung.rung_id, p_context: ctx });
            if (error) throw error;
            setMatrix((m) => ({
                ...m,
                players: m.players.map((x) => {
                    if (x.player_id !== p.player_id) return x;
                    const progress = { ...x.progress };
                    rungs.filter((r) => r.rung <= rung.rung).forEach((r) => { progress[r.rung_id] = { status: 'achieved', context: ctx }; });
                    return { ...x, progress };
                }),
            }));
            toast.success(`${p.first_name}: ${skill.name} — ${rung.label} ✓`);
        } catch (e) {
            toast.error(e?.message || "Couldn't verify — try again.");
            await load();
        } finally { setBusy(null); }
    };

    const overlay = (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-end md:items-center md:justify-center" onClick={onClose}>
            <div className="bg-gray-900 border border-white/10 w-full md:max-w-2xl md:rounded-2xl rounded-t-2xl flex flex-col max-h-[92dvh]"
                onClick={(e) => e.stopPropagation()}>
                {/* header */}
                <div className="flex items-center gap-3 p-4 border-b border-white/10 shrink-0">
                    <ShieldCheck className="w-5 h-5 text-brand-gold shrink-0" />
                    <div className="flex-1 min-w-0">
                        <h3 className="font-display uppercase tracking-wider text-white text-sm truncate">
                            {matrix?.standard?.name || 'Competitive Standard'} — Verify
                        </h3>
                        <p className="text-[11px] text-gray-400">Tap a player who showed the skill. Verifying the top rung completes the ones below it.</p>
                    </div>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-white shrink-0"><X className="w-5 h-5" /></button>
                </div>

                {loading ? (
                    <div className="p-8 flex items-center justify-center text-gray-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
                ) : !skill ? (
                    <div className="p-8 text-center text-gray-400 text-sm">No standard set for this team yet.</div>
                ) : (
                    <>
                        {/* context pills */}
                        <div className="flex items-center gap-2 px-4 pt-3 shrink-0">
                            <span className="text-[10px] uppercase tracking-wider text-gray-500">Seen in:</span>
                            {CONTEXTS.map((c) => (
                                <button key={c.k} type="button" onClick={() => setCtx(c.k)}
                                    className={`text-xs px-2.5 py-1 rounded-full font-display uppercase tracking-wider ${ctx === c.k ? 'bg-brand-gold text-brand-dark font-bold' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
                                    {c.l}
                                </button>
                            ))}
                        </div>

                        {/* skill selector */}
                        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3 shrink-0">
                            {skills.map((sk, i) => (
                                <button key={sk.skill_key} type="button" onClick={() => setSkillIdx(i)}
                                    className={`relative shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap ${i === skillIdx ? 'bg-brand-green text-brand-dark font-bold' : 'bg-white/5 text-gray-300 hover:text-white'}`}>
                                    {sk.name}
                                    {skillHasRequests(sk) && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-brand-gold border border-gray-900" />}
                                </button>
                            ))}
                        </div>

                        {/* selected-skill hint */}
                        <div className="px-4 pb-2 shrink-0">
                            <p className="text-[11px] text-gray-400">
                                <span className="text-brand-gold uppercase tracking-wider">{skill.card_attribute}</span>
                                {!skill.trainable_solo && <span className="text-gray-500"> · tested live at practice</span>}
                                {rungs[rungs.length - 1]?.rubric && <> · {rungs[rungs.length - 1].rubric}</>}
                            </p>
                        </div>

                        {/* player grid (scrolls) */}
                        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4 space-y-1.5">
                            {players.map((p) => {
                                const done = skillDone(p);
                                const requested = anyRequested(p);
                                return (
                                    <div key={p.player_id}
                                        className={`flex items-center gap-3 rounded-lg p-2.5 ${done ? 'bg-brand-gold/10' : requested ? 'bg-brand-gold/5 ring-1 ring-brand-gold/30' : 'bg-white/5'}`}>
                                        <div className="w-7 h-7 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-[11px] text-gray-300 font-bold">
                                            {p.jersey_number ?? '•'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm text-white font-medium truncate">{p.first_name} {(p.last_name || '').charAt(0)}{p.last_name ? '.' : ''}</div>
                                            {requested && !done && <div className="text-[10px] text-brand-gold uppercase tracking-wider">asked to be checked</div>}
                                        </div>
                                        {/* rung pips */}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {rungs.map((r) => {
                                                const ach = rungAchieved(p, r.rung_id);
                                                const req = statusOf(p, r.rung_id) === 'requested';
                                                const isBusy = busy === p.player_id + ':' + r.rung_id;
                                                return (
                                                    <button key={r.rung_id} type="button" title={r.label}
                                                        disabled={ach || isBusy}
                                                        onClick={() => verify(p, r)}
                                                        className={`w-8 h-8 rounded-md flex items-center justify-center text-[11px] font-bold transition
                                                            ${ach ? 'bg-brand-gold text-brand-dark'
                                                               : req ? 'border-2 border-brand-gold text-brand-gold'
                                                               : 'border border-white/20 text-gray-500 hover:border-brand-gold hover:text-brand-gold'}`}>
                                                        {isBusy ? '·' : ach ? <CheckCircle2 className="w-4 h-4" /> : r.rung}
                                                    </button>
                                                );
                                            })}
                                            {done && <ShieldCheck className="w-4 h-4 text-brand-gold ml-1" />}
                                        </div>
                                    </div>
                                );
                            })}
                            {players.length === 0 && <p className="text-center text-gray-500 text-sm py-8">No players on the roster yet.</p>}
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    return createPortal(overlay, document.body);
};

export default SkillVerifyView;
