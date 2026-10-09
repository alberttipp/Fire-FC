import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabaseClient';
import { useToast } from '../Toast';
import { X, Trophy, Loader2, Send } from 'lucide-react';
import { COMPETITION_NAME } from '../../constants/competition';

// Coach setup screen for the Golden Touch Challenge: set the start/baseline-lock/
// end (+ optional Juggle-Off) dates, then send it to the team. Writes the team's
// own config via upsert_juggle_config (per-team; never touches other clubs).
const GoldenTouchSetup = ({ teamId, onClose, onSaved }) => {
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [startsOn, setStartsOn] = useState('');
    const [baselineLock, setBaselineLock] = useState('');
    const [endsOn, setEndsOn] = useState('');
    const [finalsOn, setFinalsOn] = useState('');

    // Prefill from the team's current (or inherited) config if one exists.
    const load = useCallback(async () => {
        if (!teamId) { setLoading(false); return; }
        const { data } = await supabase.rpc('get_juggle_leaderboard', { p_team_id: teamId });
        const cfg = data?.config || {};
        if (cfg.starts_on) setStartsOn(cfg.starts_on);
        if (cfg.baseline_locks_at) setBaselineLock(String(cfg.baseline_locks_at).slice(0, 10));
        if (cfg.ends_on) setEndsOn(cfg.ends_on);
        if (cfg.finals_on) setFinalsOn(cfg.finals_on);
        setLoading(false);
    }, [teamId]);
    useEffect(() => { load(); }, [load]);

    // Default the baseline lock to 1 week after the start (the "baseline week").
    useEffect(() => {
        if (startsOn && !baselineLock) {
            const d = new Date(startsOn + 'T00:00:00');
            d.setDate(d.getDate() + 7);
            setBaselineLock(d.toISOString().slice(0, 10));
        }
    }, [startsOn, baselineLock]);

    const save = async () => {
        if (!startsOn || !endsOn) { toast.error('Pick a start and end date.'); return; }
        if (endsOn < startsOn) { toast.error('End date must be after the start.'); return; }
        setSaving(true);
        try {
            const { error } = await supabase.rpc('upsert_juggle_config', {
                p_team_id: teamId,
                p_starts_on: startsOn,
                p_ends_on: endsOn,
                p_baseline_locks_at: baselineLock ? baselineLock + 'T23:59:59' : null,
                p_finals_on: finalsOn || null,
                p_team_goal: null,
            });
            if (error) throw error;
            toast.success('Challenge is live — your players will see it on their dashboard! 🏆');
            onSaved?.();
            onClose?.();
        } catch (e) {
            toast.error(e?.message || "Couldn't save — try again.");
        } finally { setSaving(false); }
    };

    const field = (label, value, onChange, hint) => (
        <label className="block">
            <span className="text-xs uppercase tracking-wider text-gray-400 font-bold">{label}</span>
            <input type="date" value={value} onChange={(e) => onChange(e.target.value)}
                className="mt-1 w-full bg-black/30 border border-white/15 rounded-lg p-2.5 text-white text-sm" />
            {hint && <span className="text-[11px] text-gray-500 mt-0.5 block">{hint}</span>}
        </label>
    );

    const overlay = (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-end md:items-center md:justify-center" onClick={onClose}>
            <div className="bg-gray-900 border border-white/10 w-full md:max-w-md md:rounded-2xl rounded-t-2xl flex flex-col max-h-[92dvh]"
                onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 p-4 border-b border-white/10 shrink-0">
                    <Trophy className="w-5 h-5 text-brand-gold shrink-0" />
                    <div className="flex-1 min-w-0">
                        <h3 className="font-display uppercase tracking-wider text-white text-sm truncate">{COMPETITION_NAME} — Set Up</h3>
                        <p className="text-[11px] text-gray-400">Set the dates, then send it to your team.</p>
                    </div>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-white shrink-0"><X className="w-5 h-5" /></button>
                </div>

                {loading ? (
                    <div className="p-8 flex items-center justify-center text-gray-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
                ) : (
                    <div className="p-4 space-y-3 overflow-y-auto">
                        <div className="rounded-lg bg-brand-gold/5 border border-brand-gold/20 p-3 text-[12px] text-gray-300">
                            <b className="text-brand-gold">How it runs:</b> the first week is the <b>baseline week</b> — everyone juggles and logs
                            their starting best. After baselines lock, the competition is live until the end date (and an optional Juggle-Off at the end).
                        </div>
                        {field('Start date', startsOn, setStartsOn, 'Baseline week begins.')}
                        {field('Baselines lock', baselineLock, setBaselineLock, 'Defaults to 1 week after start — competition begins.')}
                        {field('End date', endsOn, setEndsOn, 'Last day to log scores (e.g. your last fall game).')}
                        {field('Juggle-Off (optional)', finalsOn, setFinalsOn, 'A fun finals at practice — leave blank to skip.')}
                    </div>
                )}

                {!loading && (
                    <div className="p-4 border-t border-white/10 shrink-0">
                        <button type="button" onClick={save} disabled={saving}
                            className="w-full py-3 rounded-lg bg-brand-gold text-brand-dark font-display font-bold uppercase tracking-wider hover:brightness-110 disabled:opacity-60 flex items-center justify-center gap-2">
                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            {saving ? 'Sending…' : 'Save & send to team'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(overlay, document.body);
};

export default GoldenTouchSetup;
