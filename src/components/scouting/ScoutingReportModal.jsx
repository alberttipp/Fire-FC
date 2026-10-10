import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabaseClient';
import { X, Loader2, Shield, Swords, Users, History } from 'lucide-react';

// Opponent scouting report, computed from cached league games: current-season standing,
// record, last-5 form, COMMON OPPONENTS (how we each did vs shared teams), and
// head-to-head. Open to coaches AND parents.
const ScoutingReportModal = ({ teamId, opponentName, sourceId = null, onClose }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!teamId || !opponentName) { setLoading(false); return; }
        const { data: d } = await supabase.rpc('get_scouting_report', { p_team_id: teamId, p_opponent: opponentName, p_source_id: sourceId });
        setData(d || { found: false });
        setLoading(false);
    }, [teamId, opponentName, sourceId]);
    useEffect(() => { load(); }, [load]);

    const opp = data?.opponent;
    const us = data?.us;
    const table = data?.table || [];
    const last5 = data?.opp_last5 || [];
    const common = data?.common || [];
    const h2h = data?.h2h || [];
    const season = data?.season;
    const lastSeason = data && data.is_current === false;
    const through = data?.data_through
        ? new Date(data.data_through + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : null;

    const strength = (o) => {
        if (!o || !o.total) return null;
        const pctile = 1 - (o.position - 1) / Math.max(1, o.total - 1);
        if (pctile >= 0.75) return { label: 'Strong — top of the table', cls: 'text-red-400' };
        if (pctile >= 0.45) return { label: 'Mid-table', cls: 'text-brand-gold' };
        return { label: 'Beatable — lower in the table', cls: 'text-brand-green' };
    };
    const s = strength(opp);
    const rec = (o) => o ? `${o.w}-${o.l}-${o.d}` : '—';
    const formChip = (r) => (
        <span className={`inline-flex w-5 h-5 items-center justify-center rounded text-[10px] font-bold ${r === 'W' ? 'bg-brand-green/20 text-brand-green' : r === 'L' ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-gray-400'}`}>{r}</span>
    );
    const stat = (label, value) => (
        <div className="bg-white/[0.03] rounded-lg p-2 text-center">
            <div className="text-white font-bold text-sm">{value}</div>
            <div className="text-[9px] uppercase tracking-wider text-gray-500">{label}</div>
        </div>
    );
    const section = (icon, title, children) => (
        <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1">{icon} {title}</div>
            {children}
        </div>
    );
    // One side's result vs a common opponent: "W (+3)" for one game, "2-0-1 (+5)" for many.
    const sideLabel = (w, l, d, gd) => {
        const gp = (w || 0) + (l || 0) + (d || 0);
        const r = gp === 1 ? (w ? 'W' : l ? 'L' : 'D') : `${w}-${l}-${d}`;
        return { r, g: (gd > 0 ? '+' : '') + gd };
    };
    const edgeOf = (c) => {
        const up = c.us_w * 3 + c.us_d, tp = c.them_w * 3 + c.them_d;
        if (up > tp || (up === tp && c.us_gd > c.them_gd)) return 'you';
        if (tp > up || (tp === up && c.them_gd > c.us_gd)) return 'them';
        return 'even';
    };
    const edgeCount = common.filter((c) => edgeOf(c) === 'you').length;

    const overlay = (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-end md:items-center md:justify-center" onClick={onClose}>
            <div className="bg-gray-900 border border-white/10 w-full md:max-w-lg md:rounded-2xl rounded-t-2xl flex flex-col max-h-[92dvh]"
                onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 p-4 border-b border-white/10 shrink-0">
                    <Swords className="w-5 h-5 text-brand-gold shrink-0" />
                    <div className="flex-1 min-w-0">
                        <h3 className="font-display uppercase tracking-wider text-white text-sm truncate">Scouting Report</h3>
                        <p className="text-[11px] text-gray-400 truncate">{opp?.tname || opponentName}</p>
                    </div>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-white shrink-0"><X className="w-5 h-5" /></button>
                </div>

                {loading ? (
                    <div className="p-8 flex items-center justify-center text-gray-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Scouting…</div>
                ) : !data?.found || !opp ? (
                    <div className="p-8 text-center">
                        <Shield className="w-10 h-10 text-gray-700 mx-auto mb-2" />
                        <p className="text-gray-400 text-sm">No scouting data for "{opponentName}" yet.</p>
                        <p className="text-gray-600 text-xs mt-1">It fills in as the league's results post.</p>
                    </div>
                ) : (
                    <div className="p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-4 overflow-y-auto flex-1 min-h-0">
                        {lastSeason ? (
                            <div className="rounded-lg bg-brand-gold/5 border border-brand-gold/20 p-2.5 text-[11px] text-gray-300">
                                Based on <b className="text-brand-gold">{season}</b> (last season).
                            </div>
                        ) : through && (
                            <div className="rounded-lg bg-white/[0.03] border border-white/10 p-2.5 text-[11px] text-gray-400">
                                Official league results posted through <span className="text-gray-200">{through}</span>. The league enters scores on a delay, so recent games may not show yet — it updates automatically.
                            </div>
                        )}

                        {/* Opponent headline */}
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-white font-bold truncate">{opp.tname}</h4>
                                <span className="text-xs text-gray-400 shrink-0">· #{opp.position} of {opp.total}</span>
                            </div>
                            {s && <p className={`text-xs font-bold ${s.cls} mb-2`}>{s.label}</p>}
                            <div className="grid grid-cols-4 gap-2">
                                {stat('Record', rec(opp))}
                                {stat('For/Against', `${opp.gf}/${opp.ga}`)}
                                {stat('Goal Diff', (opp.gd > 0 ? '+' : '') + opp.gd)}
                                {stat('Games', opp.gp)}
                            </div>
                        </div>

                        {/* Last 5 form */}
                        {last5.length > 0 && section(<History className="w-3 h-3" />, 'Recent form (last 5)', (
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {last5.map((g, i) => (
                                    <span key={i} className="flex items-center gap-1">{formChip(g.r)}<span className="text-[10px] text-gray-500">{g.score}</span></span>
                                ))}
                            </div>
                        ))}

                        {/* You vs Them */}
                        {us && (
                            <div className="rounded-lg bg-white/5 p-3 grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <div className="text-brand-green font-bold">You — #{us.position}</div>
                                    <div className="text-gray-400 text-xs">{rec(us)} · {us.gf}/{us.ga}</div>
                                </div>
                                <div>
                                    <div className="text-white font-bold">Them — #{opp.position}</div>
                                    <div className="text-gray-400 text-xs">{rec(opp)} · {opp.gf}/{opp.ga}</div>
                                </div>
                            </div>
                        )}

                        {/* Head to head */}
                        {h2h.length > 0 && section(<Swords className="w-3 h-3" />, 'Head to head (you vs them)', (
                            <div className="flex flex-wrap gap-2">
                                {h2h.map((g, i) => (
                                    <span key={i} className="flex items-center gap-1 text-xs">{formChip(g.result)}<span className="text-gray-400">{g.score}</span></span>
                                ))}
                            </div>
                        ))}

                        {/* Common opponents — the gold. Shows how you each did vs shared teams. */}
                        {common.length > 0 && section(<Users className="w-3 h-3" />, 'Common opponents', (
                            <>
                                <p className="text-[11px] text-gray-400 mb-2">
                                    Teams you&apos;ve <i>both</i> played. You did <b className="text-brand-green">better vs {edgeCount} of {common.length}</b>.
                                </p>
                                <div className="space-y-1">
                                    {common.map((c, i) => {
                                        const u = sideLabel(c.us_w, c.us_l, c.us_d, c.us_gd);
                                        const t = sideLabel(c.them_w, c.them_l, c.them_d, c.them_gd);
                                        const edge = edgeOf(c);
                                        return (
                                            <div key={i} className="bg-white/[0.03] rounded-lg px-2.5 py-2">
                                                <div className="text-xs text-gray-300 truncate mb-1">{c.opponent}</div>
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className={`flex-1 ${edge === 'you' ? 'text-brand-green font-bold' : 'text-gray-400'}`}>You {u.r} <span className="text-[10px] text-gray-500">({u.g})</span></span>
                                                    <span className={`shrink-0 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${edge === 'you' ? 'bg-brand-green/20 text-brand-green' : edge === 'them' ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-gray-400'}`}>
                                                        {edge === 'you' ? 'Your edge' : edge === 'them' ? 'Their edge' : 'Even'}
                                                    </span>
                                                    <span className={`flex-1 text-right ${edge === 'them' ? 'text-red-400 font-bold' : 'text-gray-400'}`}>Them {t.r} <span className="text-[10px] text-gray-500">({t.g})</span></span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ))}

                        {/* Full table */}
                        {table.length > 0 && section(null, `${season} table`, (
                            <div className="space-y-0.5">
                                {table.map((t) => {
                                    const isOpp = opp && t.name === opp.tname;
                                    const isUs = us && t.name === us.tname;
                                    return (
                                        <div key={t.position + t.name}
                                            className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${isOpp ? 'bg-brand-gold/15' : isUs ? 'bg-brand-green/10' : ''}`}>
                                            <span className="w-5 text-center text-gray-500 font-bold">{t.position}</span>
                                            <span className={`flex-1 truncate ${isOpp ? 'text-brand-gold font-bold' : isUs ? 'text-brand-green font-bold' : 'text-gray-300'}`}>
                                                {t.name}{isUs ? ' (you)' : ''}
                                            </span>
                                            <span className="text-gray-400">{t.w}-{t.l}-{t.d}</span>
                                            <span className="w-8 text-right text-white font-bold">{t.points}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(overlay, document.body);
};

export default ScoutingReportModal;
