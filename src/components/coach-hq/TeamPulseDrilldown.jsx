import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Activity, Users, Copy, Check, TrendingUp, Moon } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useToast } from '../Toast';

// Coach/manager "Team Pulse" — engagement at a glance + the nightly report.
// One round-trip to get_team_pulse: live last-24h + last-7d snapshots, an
// 8-week trend, the quiet-7d chase list, and the most recent stored nightly
// report (built by build_daily_coach_report at 8 PM Central + pushed to staff).
const TeamPulseDrilldown = ({ teamId, onClose }) => {
    const toast = useToast();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    const load = useCallback(async () => {
        if (!teamId) return;
        const { data: d, error } = await supabase.rpc('get_team_pulse', { p_team_id: teamId });
        if (error) { console.warn('[pulse] load error', error); toast.error("Couldn't load Team Pulse."); }
        setData(d || null);
        setLoading(false);
    }, [teamId]);
    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    const today   = data?.today || {};
    const week    = data?.last7d || {};
    const trend   = data?.weekly_trend || [];
    const dormant = data?.dormant || [];
    const report  = data?.latest_report || null;

    const roster = today.roster_size ?? 0;
    const maxActive = Math.max(1, ...trend.map(w => w.active_players || 0));

    const reportTime = (() => {
        if (!report?.created_at) return '';
        try {
            return new Date(report.created_at).toLocaleString('en-US', {
                timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
            });
        } catch { return ''; }
    })();

    const copyDormant = async () => {
        try {
            await navigator.clipboard.writeText(dormant.join(', '));
            setCopied(true);
            toast.success('Names copied — paste into a text to re-engage them.');
            setTimeout(() => setCopied(false), 2000);
        } catch { toast.error('Could not copy.'); }
    };

    const Stat = ({ label, value, sub }) => (
        <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
            <div className="text-white font-bold text-lg leading-none">{value}</div>
            {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">{label}</div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-brand-dark border border-white/10 w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
                 style={{ maxHeight: 'min(90vh, 90dvh)' }} onClick={(e) => e.stopPropagation()}>
                <div className="shrink-0 border-b border-white/10 p-4 flex items-center gap-3">
                    <Activity className="w-5 h-5 text-brand-green" />
                    <h3 className="text-white font-bold flex-1">Team Pulse</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5">
                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-green animate-spin" /></div>
                    ) : (
                        <>
                            {/* Nightly report — the headline + insights/pointers */}
                            {report && (
                                <div className="rounded-lg border border-brand-green/30 bg-brand-green/5 p-3">
                                    <div className="text-white font-bold text-sm mb-1">{report.headline}</div>
                                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
                                        Nightly report · {reportTime}
                                    </div>
                                    <pre className="text-gray-300 text-xs whitespace-pre-wrap font-sans leading-relaxed">{report.body}</pre>
                                </div>
                            )}

                            {/* Last 24h */}
                            <div>
                                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Last 24 hours</div>
                                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                                    <Stat label="Active" value={`${today.active_players ?? 0}`} sub={`of ${roster}`} />
                                    <Stat label="RSVPs" value={today.rsvps ?? 0} />
                                    <Stat label="Training" value={today.training_logs ?? 0} sub={`${today.training_players ?? 0} kids`} />
                                    <Stat label="Juggles" value={today.juggles ?? 0} />
                                    <Stat label="Chat" value={today.chat_msgs ?? 0} sub={`${today.chat_people ?? 0} ppl`} />
                                    <Stat label="Logins" value={today.signins ?? 0} />
                                </div>
                            </div>

                            {/* Last 7 days */}
                            <div>
                                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Last 7 days</div>
                                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                                    <Stat label="Active" value={`${week.active_players ?? 0}`} sub={`of ${roster}`} />
                                    <Stat label="RSVPs" value={week.rsvps ?? 0} />
                                    <Stat label="Training" value={week.training_logs ?? 0} sub={`${week.training_players ?? 0} kids`} />
                                    <Stat label="Juggles" value={week.juggles ?? 0} />
                                    <Stat label="Chat" value={week.chat_msgs ?? 0} sub={`${week.chat_people ?? 0} ppl`} />
                                    <Stat label="Signups" value={week.signups ?? 0} />
                                </div>
                            </div>

                            {/* Weekly trend */}
                            {trend.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gray-500 mb-2">
                                        <TrendingUp className="w-3.5 h-3.5" /> Weekly trend — active players
                                    </div>
                                    <div className="space-y-1.5">
                                        {trend.map((w) => (
                                            <div key={w.week_of} className="flex items-center gap-2 text-xs">
                                                <span className="text-gray-400 w-12 shrink-0">{w.week_of}</span>
                                                <div className="flex-1 bg-white/5 rounded-full h-3 overflow-hidden">
                                                    <div className="bg-brand-green h-full rounded-full" style={{ width: `${Math.round((w.active_players / maxActive) * 100)}%` }} />
                                                </div>
                                                <span className="text-gray-300 w-8 text-right shrink-0">{w.active_players}</span>
                                                <span className="text-gray-500 w-20 text-right shrink-0 hidden md:inline">{w.rsvps} rsvp · {w.training_logs} tr</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Quiet 7d chase list */}
                            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <Moon className="w-4 h-4 text-gray-400" />
                                    <h4 className="text-white font-bold text-sm flex-1">Quiet 7+ days — {dormant.length} to nudge</h4>
                                    {dormant.length > 0 && (
                                        <button onClick={copyDormant} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 text-xs text-gray-200 hover:bg-white/20">
                                            {copied ? <Check className="w-3.5 h-3.5 text-brand-green" /> : <Copy className="w-3.5 h-3.5" />} Copy
                                        </button>
                                    )}
                                </div>
                                {dormant.length === 0 ? (
                                    <p className="text-brand-green text-xs">🎉 Every player has been active in the last week.</p>
                                ) : (
                                    <p className="text-gray-300 text-xs leading-relaxed">{dormant.join(', ')}</p>
                                )}
                            </div>

                            <p className="text-[10px] text-gray-600 text-center">
                                Auto-generated nightly at 8 PM Central · pushed to staff. Live numbers refresh each time you open this.
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TeamPulseDrilldown;
