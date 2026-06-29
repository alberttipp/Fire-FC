import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Eye, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../supabaseClient';

// Coach HQ — "Eval Card Views": which families have actually opened their
// player's evaluation card (parent/player read-only opens; coach edits don't
// count). Data starts collecting from when this shipped — past opens are not
// recoverable. Reads via the staff-gated get_evaluation_views RPC.

const timeAgo = (iso) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const d = Math.floor(diff / 86400000);
    if (d > 0) return `${d}d ago`;
    const h = Math.floor(diff / 3600000);
    if (h > 0) return `${h}h ago`;
    const m = Math.floor(diff / 60000);
    return m > 0 ? `${m}m ago` : 'just now';
};

const EvalViewsDrilldown = ({ teamId, onClose }) => {
    const [rows, setRows] = useState(null);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        if (!teamId) return;
        const { data, error: err } = await supabase.rpc('get_evaluation_views', { p_team_id: teamId });
        if (err) { console.warn('[EvalViews] error', err); setError(err.message || 'Could not load.'); setRows([]); return; }
        setRows(data || []);
    }, [teamId]);

    useEffect(() => { load(); }, [load]);

    const evaluated = (rows || []).filter(r => r.has_eval);
    const seen = evaluated.filter(r => r.viewer_count > 0);

    const overlay = (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-stretch sm:items-center sm:justify-center sm:p-4">
            <div className="w-full sm:max-w-2xl bg-[#0f0f12] sm:rounded-2xl border border-white/10 flex flex-col h-[100dvh] sm:h-[85dvh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
                    <Eye className="w-5 h-5 text-brand-gold shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="text-white font-bold text-base leading-tight">Eval Card Views</div>
                        <div className="text-[11px] text-gray-400">
                            {rows == null ? 'Loading…' : `${seen.length}/${evaluated.length} evaluated cards opened by a family`}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-white" aria-label="Close"><X className="w-5 h-5" /></button>
                </div>

                {/* Body */}
                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
                    {rows == null ? (
                        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
                    ) : error ? (
                        <div className="text-center text-red-400 py-16 text-sm">{error}</div>
                    ) : rows.length === 0 ? (
                        <div className="text-center text-gray-400 py-16 text-sm">No players yet.</div>
                    ) : (
                        <>
                            <p className="text-[11px] text-gray-500 px-1 pb-1">
                                Tracking started when this shipped — opens before then aren't counted.
                            </p>
                            {rows.map(r => (
                                <div key={r.player_id} className={`rounded-xl border p-3 ${
                                    !r.has_eval ? 'border-white/5 bg-white/[0.02] opacity-70'
                                    : r.viewer_count > 0 ? 'border-brand-green/30 bg-brand-green/5'
                                    : 'border-brand-gold/40 bg-brand-gold/5'}`}>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-white text-sm font-semibold truncate">{r.player_name}</div>
                                            {!r.has_eval ? (
                                                <div className="text-[11px] text-gray-500">No evaluation yet</div>
                                            ) : r.viewer_count > 0 ? (
                                                <div className="text-[11px] text-brand-green flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" /> Opened by {r.viewer_count} {r.viewer_count === 1 ? 'family member' : 'family members'} · {timeAgo(r.last_viewed_at)}
                                                </div>
                                            ) : (
                                                <div className="text-[11px] text-brand-gold flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3" /> Card built — not opened yet
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {/* viewer detail */}
                                    {r.has_eval && Array.isArray(r.viewers) && r.viewers.length > 0 && (
                                        <div className="mt-2 pl-1 space-y-1 border-t border-white/5 pt-2">
                                            {r.viewers.map((v, i) => (
                                                <div key={i} className="flex items-center justify-between text-[11px]">
                                                    <span className="text-gray-300 truncate">{v.name}</span>
                                                    <span className="text-gray-500 shrink-0 ml-2">{timeAgo(v.last)}{v.count > 1 ? ` · ${v.count}×` : ''}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(overlay, document.body);
};

export default EvalViewsDrilldown;
