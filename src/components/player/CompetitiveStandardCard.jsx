import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { useToast } from '../Toast';
import { CheckCircle2, Lock, Loader2, ChevronDown, Dumbbell, ShieldCheck, Hourglass } from 'lucide-react';

// The kid/parent-facing "Competitive Standard" passport. Each of the standard's
// skills is a 3-rung ladder: lower rungs the family self-confirms, the top rung the
// coach verifies. There is NO "denied" state — a coach rung is either achieved or a
// "request a check" ("I'm ready, test me"). Live-1v1 skills aren't solo-trainable, so
// we say "tested at practice" instead of offering a train button.
//
// Props: playerId (required), playerName, onTrainSkill?(skill) — optional; when
// provided, shows a "Train this" action for solo-trainable skills.
const rungUnlocked = (rungs, idx) => idx === 0 || rungs[idx - 1]?.status === 'achieved';
const skillEarned = (s) => s.rungs.every((r) => r.status === 'achieved');

const CompetitiveStandardCard = ({ playerId, playerName, onTrainSkill }) => {
    const toast = useToast();
    const [passport, setPassport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(null);      // expanded skill_key
    const [busy, setBusy] = useState(null);      // rung_id being acted on

    const load = useCallback(async () => {
        if (!playerId) return;
        const { data, error } = await supabase.rpc('get_player_passport', { p_player_id: playerId });
        if (!error && data) setPassport(data);
        setLoading(false);
    }, [playerId]);
    useEffect(() => { load(); }, [load]);

    const act = async (rpc, rung, okMsg) => {
        setBusy(rung.rung_id);
        try {
            const { error } = await supabase.rpc(rpc, { p_player_id: playerId, p_rung_id: rung.rung_id });
            if (error) throw error;
            toast.success(okMsg);
            await load();
        } catch (e) {
            toast.error(e?.message || "Couldn't update — try again.");
        } finally { setBusy(null); }
    };

    // "Train this" — drop skill-matched drills into the training shelf (logs mins/touches there).
    const trainSkill = async (s) => {
        const key = 'train:' + s.skill_key;
        setBusy(key);
        try {
            const { data, error } = await supabase.rpc('build_skill_session', { p_player_id: playerId, p_skill_key: s.skill_key, p_count: 3 });
            if (error) throw error;
            const n = data?.created ?? 0;
            toast.success(n > 0
                ? `Added ${n} ${s.name} drill${n === 1 ? '' : 's'} to your training — go train! ⚽`
                : `You already have ${s.name} drills waiting — check your training.`);
        } catch (e) {
            toast.error(e?.message || "Couldn't add drills — try again.");
        } finally { setBusy(null); }
    };

    if (loading) {
        return (
            <div className="glass-panel p-4 flex items-center gap-2 text-gray-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading the Competitive Standard…
            </div>
        );
    }
    if (!passport?.skills?.length) return null;

    const skills = passport.skills;
    const earned = skills.filter(skillEarned).length;
    const pct = Math.round((earned / skills.length) * 100);
    const done = earned === skills.length;

    return (
        <div className="glass-panel border-l-4 border-l-brand-gold p-4">
            <div className="flex items-center gap-3 mb-3">
                <div className="shrink-0 w-11 h-11 rounded-full bg-brand-gold/15 flex items-center justify-center">
                    {done
                        ? <ShieldCheck className="w-6 h-6 text-brand-gold" />
                        : <span className="text-brand-gold font-display font-bold text-sm">{earned}/{skills.length}</span>}
                </div>
                <div className="min-w-0">
                    <h3 className="font-display uppercase tracking-wider text-white text-sm truncate">
                        {passport.standard?.name || 'Competitive Standard'}
                    </h3>
                    <p className="text-xs text-gray-400">
                        {done
                            ? `${playerName || 'This player'} has achieved the standard! 🏅`
                            : `${earned} of ${skills.length} skills earned — keep climbing.`}
                    </p>
                </div>
            </div>

            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-3">
                <div className="h-full bg-brand-gold transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>

            <ul className="space-y-1.5">
                {skills.map((s) => {
                    const sEarned = skillEarned(s);
                    const doneRungs = s.rungs.filter((r) => r.status === 'achieved').length;
                    const isOpen = open === s.skill_key;
                    return (
                        <li key={s.skill_key} className="rounded-lg bg-white/5 overflow-hidden">
                            <button type="button" onClick={() => setOpen(isOpen ? null : s.skill_key)}
                                className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-white/5">
                                {sEarned
                                    ? <CheckCircle2 className="w-5 h-5 text-brand-gold shrink-0" />
                                    : <div className="w-5 h-5 shrink-0 rounded-full border-2 border-gray-600 flex items-center justify-center text-[9px] text-gray-400 font-bold">{doneRungs}</div>}
                                <div className="flex-1 min-w-0">
                                    <div className={`text-sm font-medium ${sEarned ? 'text-brand-gold' : 'text-white'}`}>{s.name}</div>
                                    <div className="text-[11px] text-gray-500 uppercase tracking-wide">
                                        {doneRungs}/{s.rungs.length} · {s.card_attribute}{!s.trainable_solo ? ' · tested at practice' : ''}
                                    </div>
                                </div>
                                <ChevronDown className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isOpen && (
                                <div className="px-3 pb-3 space-y-2">
                                    {s.rungs.map((r, idx) => {
                                        const unlocked = rungUnlocked(s.rungs, idx);
                                        const achieved = r.status === 'achieved';
                                        const requested = r.status === 'requested';
                                        return (
                                            <div key={r.rung_id}
                                                className={`rounded-md p-2.5 border ${achieved ? 'border-brand-gold/40 bg-brand-gold/5' : unlocked ? 'border-white/10 bg-black/20' : 'border-white/5 opacity-50'}`}>
                                                <div className="flex items-center gap-2">
                                                    {achieved
                                                        ? <CheckCircle2 className="w-4 h-4 text-brand-gold shrink-0" />
                                                        : unlocked
                                                            ? <div className="w-4 h-4 rounded-full border-2 border-gray-500 shrink-0" />
                                                            : <Lock className="w-4 h-4 text-gray-600 shrink-0" />}
                                                    <span className={`text-sm font-medium ${achieved ? 'text-brand-gold' : 'text-white'}`}>{r.label}</span>
                                                    <span className="ml-auto text-[10px] uppercase tracking-wider text-gray-500">
                                                        {r.verifier === 'coach' ? 'coach checks' : 'you can confirm'}
                                                    </span>
                                                </div>
                                                {r.rubric && <p className="text-[11px] text-gray-400 mt-1 ml-6">{r.rubric}</p>}

                                                {/* actions — only on the current unlocked, not-yet-achieved rung */}
                                                {unlocked && !achieved && (
                                                    <div className="ml-6 mt-2 flex flex-wrap items-center gap-2">
                                                        {(r.verifier === 'self' || r.verifier === 'parent') && (
                                                            <button type="button" disabled={busy === r.rung_id}
                                                                onClick={() => act('confirm_skill_rung', r, 'Nice — marked done! 🎉')}
                                                                className="text-xs font-display font-bold uppercase tracking-wider px-3 py-1.5 rounded bg-brand-gold text-brand-dark hover:brightness-110 disabled:opacity-60">
                                                                {busy === r.rung_id ? '…' : 'Mark done'}
                                                            </button>
                                                        )}
                                                        {r.verifier === 'coach' && !requested && (
                                                            <button type="button" disabled={busy === r.rung_id}
                                                                onClick={() => act('request_skill_check', r, "Sent! Your coach will check this at practice.")}
                                                                className="text-xs font-display font-bold uppercase tracking-wider px-3 py-1.5 rounded border border-brand-gold/40 text-brand-gold hover:bg-brand-gold/10 disabled:opacity-60">
                                                                {busy === r.rung_id ? '…' : "I'm ready — ask coach"}
                                                            </button>
                                                        )}
                                                        {r.verifier === 'coach' && requested && (
                                                            <span className="text-xs text-brand-gold/80 flex items-center gap-1">
                                                                <Hourglass className="w-3.5 h-3.5" /> Coach will check at practice
                                                            </span>
                                                        )}
                                                        {s.trainable_solo && (
                                                            <button type="button" disabled={busy === 'train:' + s.skill_key}
                                                                onClick={() => trainSkill(s)}
                                                                className="text-xs text-brand-green hover:text-white flex items-center gap-1 disabled:opacity-60">
                                                                <Dumbbell className="w-3.5 h-3.5" /> {busy === 'train:' + s.skill_key ? 'Adding…' : 'Train this'}
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default CompetitiveStandardCard;
