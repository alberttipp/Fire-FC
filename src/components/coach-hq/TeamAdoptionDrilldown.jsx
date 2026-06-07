import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Bell, BellOff, Copy, Check, Trophy, AlertCircle } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useToast } from '../Toast';

// Coach/manager "Team Adoption" snapshot: who's onboard and who needs a nudge.
// Per-player feature usage (baseline / drills / touches / last active / how many
// guardians have push on) + a copyable list of guardians WITHOUT notifications.
const TeamAdoptionDrilldown = ({ teamId, onClose }) => {
    const toast = useToast();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    const load = useCallback(async () => {
        if (!teamId) return;
        const { data: d, error } = await supabase.rpc('get_team_adoption', { p_team_id: teamId });
        if (error) { console.warn('[adoption] load error', error); toast.error("Couldn't load adoption."); }
        setData(d || null);
        setLoading(false);
    }, [teamId]);
    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    const s = data?.summary || {};
    const players = data?.players || [];
    const off = data?.notifications_off || [];
    const people = data?.people || [];

    const ago = (iso) => {
        if (!iso) return 'never';
        const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
        if (days <= 0) return 'today';
        if (days === 1) return 'yesterday';
        if (days < 7) return `${days}d ago`;
        if (days < 30) return `${Math.floor(days / 7)}w ago`;
        return `${Math.floor(days / 30)}mo ago`;
    };
    const agoColor = (iso) => {
        if (!iso) return 'text-red-400';
        const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
        return days <= 2 ? 'text-brand-green' : days <= 7 ? 'text-gray-300' : 'text-red-400';
    };

    const copyOff = async () => {
        const names = off.map((o) => o.name).join(', ');
        try {
            await navigator.clipboard.writeText(names);
            setCopied(true);
            toast.success('Names copied — paste into a group text.');
            setTimeout(() => setCopied(false), 2000);
        } catch { toast.error('Could not copy.'); }
    };

    const fmtDate = (d) => d ? new Date(d + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
    const needsNudge = (p) => !p.baseline || p.drills === 0;

    return (
        <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-brand-dark border border-white/10 w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
                 style={{ maxHeight: 'min(90vh, 90dvh)' }} onClick={(e) => e.stopPropagation()}>
                <div className="shrink-0 border-b border-white/10 p-4 flex items-center gap-3">
                    <Bell className="w-5 h-5 text-brand-gold" />
                    <h3 className="text-white font-bold flex-1">Team Adoption</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5">
                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-gold animate-spin" /></div>
                    ) : (
                        <>
                            {/* Summary */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {[
                                    ['Players', s.players],
                                    ['Baselines', `${s.baselines_set ?? 0}/${s.players ?? 0}`],
                                    ['Notifications', `${s.guardians_push_on ?? 0}/${s.guardians_total ?? 0}`],
                                    ['No drills yet', s.no_drills ?? 0],
                                ].map(([l, v]) => (
                                    <div key={l} className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                                        <div className="text-white font-bold text-lg">{v}</div>
                                        <div className="text-[10px] uppercase tracking-wider text-gray-500">{l}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Notifications-off chase list */}
                            <div className="rounded-lg border border-brand-gold/30 bg-brand-gold/5 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <BellOff className="w-4 h-4 text-brand-gold" />
                                    <h4 className="text-white font-bold text-sm flex-1">Notifications OFF — {off.length} to chase</h4>
                                    {off.length > 0 && (
                                        <button onClick={copyOff} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 text-xs text-gray-200 hover:bg-white/20">
                                            {copied ? <Check className="w-3.5 h-3.5 text-brand-green" /> : <Copy className="w-3.5 h-3.5" />} Copy names
                                        </button>
                                    )}
                                </div>
                                {off.length === 0 ? (
                                    <p className="text-xs text-brand-green">Everyone has notifications on. 🎉</p>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                        {off.map((o) => (
                                            <span key={o.name + o.kids} className="text-[11px] px-2 py-1 rounded-md bg-white/[0.04] border border-white/10 text-gray-300">
                                                {o.name} <span className="text-gray-500">· {o.kids}</span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <p className="text-[10px] text-gray-500 mt-2">Tip: copy the names and send a quick group text asking them to open the app and tap “Turn on” in the gold banner.</p>
                            </div>

                            {/* People — who's active, who's gone quiet */}
                            <div>
                                <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2 px-1">People · most active first</h4>
                                <div className="space-y-1">
                                    {people.map((u, i) => (
                                        <div key={(u.name || '') + i} className="flex items-center gap-2 px-2 py-2 rounded-lg bg-white/[0.02] border border-white/5">
                                            <span className="flex-1 min-w-0 text-sm text-gray-200 truncate">
                                                {u.name}
                                                {u.role === 'staff' && <span className="ml-1.5 text-[9px] uppercase tracking-wider text-brand-gold">staff</span>}
                                                {u.kids && <span className="text-gray-500 text-[11px]"> · {u.kids}</span>}
                                            </span>
                                            {u.push_on
                                                ? <Bell className="w-3.5 h-3.5 text-brand-green shrink-0" title="Notifications on" />
                                                : <BellOff className="w-3.5 h-3.5 text-gray-600 shrink-0" title="Notifications off" />}
                                            {u.msgs > 0 && <span className="text-[10px] text-gray-500 shrink-0">{u.msgs}💬</span>}
                                            <span className={`text-[11px] font-medium shrink-0 w-16 text-right ${agoColor(u.last_sign_in)}`}>{ago(u.last_sign_in)}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] text-gray-500 mt-2 px-1"><span className="text-brand-green">Green</span> = active (≤2 days), <span className="text-red-400">red</span> = hasn't opened it in over a week.</p>
                            </div>

                            {/* Per-player */}
                            <div>
                                <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2 px-1">Players · sorted by touches</h4>
                                <div className="grid grid-cols-12 gap-2 px-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">
                                    <span className="col-span-4">Player</span>
                                    <span className="col-span-2 text-center">Base</span>
                                    <span className="col-span-2 text-center">Drills</span>
                                    <span className="col-span-2 text-center">Notif</span>
                                    <span className="col-span-2 text-center">Active</span>
                                </div>
                                <div className="space-y-1">
                                    {players.map((p) => (
                                        <div key={p.id} className={`grid grid-cols-12 gap-2 items-center px-2 py-2 rounded-lg border ${needsNudge(p) ? 'bg-red-500/[0.06] border-red-500/20' : 'bg-white/[0.02] border-white/5'}`}>
                                            <span className="col-span-4 text-sm text-gray-200 truncate flex items-center gap-1.5">
                                                {needsNudge(p) && <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                                                {p.first_name} {p.li}.
                                            </span>
                                            <span className="col-span-2 text-center">{p.baseline ? <Check className="w-4 h-4 text-brand-green inline" /> : <X className="w-4 h-4 text-red-400 inline" />}</span>
                                            <span className={`col-span-2 text-center text-sm font-bold ${p.drills === 0 ? 'text-red-400' : 'text-white'}`}>{p.drills}</span>
                                            <span className={`col-span-2 text-center text-xs font-bold ${p.guardians_push === 0 ? 'text-red-400' : 'text-brand-green'}`}>{p.guardians_push}/{p.guardians_total}</span>
                                            <span className="col-span-2 text-center text-[11px] text-gray-400">{fmtDate(p.last_training_date)}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] text-gray-500 mt-2 px-1"><span className="text-red-400">Red</span> = needs a nudge (no baseline or no drills logged). “Notif” = how many of the player’s guardians have notifications on.</p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TeamAdoptionDrilldown;
