import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabaseClient';
import { X, Loader2, Swords, ChevronRight } from 'lucide-react';
import ScoutingReportModal from './ScoutingReportModal';

// League scouting hub: a division table (computed from cached games) with a U11/U12
// (or season) toggle. Tap any team to open its full scouting report. Coach + parents.
const ScoutingHub = ({ teamId, onClose }) => {
    const [sources, setSources] = useState(null);
    const [sourceId, setSourceId] = useState(null);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [scoutTeam, setScoutTeam] = useState(null);

    // Load the available divisions (toggle) once.
    useEffect(() => {
        if (!teamId) return;
        let cancelled = false;
        (async () => {
            const { data: list } = await supabase.rpc('get_team_scouting_sources', { p_team_id: teamId });
            if (cancelled) return;
            const arr = Array.isArray(list) ? list : [];
            setSources(arr);
            setSourceId(arr[0]?.source_id || null);
        })();
        return () => { cancelled = true; };
    }, [teamId]);

    const load = useCallback(async () => {
        if (!teamId || sourceId === null) return;
        setLoading(true);
        const { data: d } = await supabase.rpc('get_league_table', { p_team_id: teamId, p_source_id: sourceId });
        setData(d || { found: false });
        setLoading(false);
    }, [teamId, sourceId]);
    useEffect(() => { if (sourceId !== null) load(); }, [load, sourceId]);

    const table = data?.table || [];
    const ourName = data?.our_name;
    const through = data?.data_through
        ? new Date(data.data_through + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : null;

    const overlay = (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-end md:items-center md:justify-center" onClick={onClose}>
            <div className="bg-gray-900 border border-white/10 w-full md:max-w-lg md:rounded-2xl rounded-t-2xl flex flex-col max-h-[92dvh]"
                onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 p-4 border-b border-white/10 shrink-0">
                    <Swords className="w-5 h-5 text-brand-gold shrink-0" />
                    <div className="flex-1 min-w-0">
                        <h3 className="font-display uppercase tracking-wider text-white text-sm truncate">Scouting Reports</h3>
                        <p className="text-[11px] text-gray-400">{data?.season ? `${data.season} — tap a team to scout them` : 'Tap a team to scout them'}</p>
                    </div>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-white shrink-0"><X className="w-5 h-5" /></button>
                </div>

                {/* Division toggle (U11 / U12 / Last season) */}
                {sources && sources.length > 1 && (
                    <div className="flex gap-2 px-4 pt-3 shrink-0">
                        {sources.map((s) => (
                            <button key={s.source_id} type="button" onClick={() => setSourceId(s.source_id)}
                                className={`text-xs px-3 py-1.5 rounded-lg font-display uppercase tracking-wider ${sourceId === s.source_id ? 'bg-brand-green text-brand-dark font-bold' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
                                {s.division}
                            </button>
                        ))}
                    </div>
                )}

                {loading || sources === null ? (
                    <div className="p-8 flex items-center justify-center text-gray-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
                ) : !data?.found || table.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">No league data yet — it fills in as the season's results post.</div>
                ) : (
                    <div className="p-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] overflow-y-auto flex-1 min-h-0">
                        {through && (
                            <p className="px-2 pb-2 text-[10px] text-gray-500">
                                Official league results posted through <span className="text-gray-300">{through}</span>. Updates automatically as the league reports scores.
                            </p>
                        )}
                        <div className="flex items-center gap-2 px-2 py-1 text-[9px] uppercase tracking-wider text-gray-500">
                            <span className="w-5 text-center">#</span>
                            <span className="flex-1">Team</span>
                            <span className="w-14 text-center">W-L-D</span>
                            <span className="w-8 text-right">Pts</span>
                            <span className="w-4" />
                        </div>
                        <div className="space-y-0.5">
                            {table.map((t) => {
                                const isUs = ourName && t.name === ourName;
                                return (
                                    <button key={t.position + t.name} type="button"
                                        onClick={() => setScoutTeam(t.name)}
                                        className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-left hover:bg-white/5 ${isUs ? 'bg-brand-green/10' : ''}`}>
                                        <span className="w-5 text-center text-gray-500 font-bold">{t.position}</span>
                                        <span className={`flex-1 truncate ${isUs ? 'text-brand-green font-bold' : 'text-white'}`}>{t.name}{isUs ? ' (you)' : ''}</span>
                                        <span className="w-14 text-center text-gray-400">{t.w}-{t.l}-{t.d}</span>
                                        <span className="w-8 text-right text-white font-bold">{t.points}</span>
                                        <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {scoutTeam && (
                <ScoutingReportModal teamId={teamId} opponentName={scoutTeam} sourceId={sourceId} onClose={() => setScoutTeam(null)} />
            )}
        </div>
    );

    return createPortal(overlay, document.body);
};

export default ScoutingHub;
