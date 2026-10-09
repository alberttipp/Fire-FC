import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabaseClient';
import { X, Loader2, Swords, ChevronRight } from 'lucide-react';
import ScoutingReportModal from './ScoutingReportModal';

// League scouting hub: the division table (computed from cached games). Tap any team
// to open its full scouting report. Opened from Coach HQ + available to parents.
const ScoutingHub = ({ teamId, onClose }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [scoutTeam, setScoutTeam] = useState(null);

    const load = useCallback(async () => {
        if (!teamId) { setLoading(false); return; }
        const { data: d } = await supabase.rpc('get_league_table', { p_team_id: teamId });
        setData(d || { found: false });
        setLoading(false);
    }, [teamId]);
    useEffect(() => { load(); }, [load]);

    const table = data?.table || [];
    const ourName = data?.our_name;

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

                {loading ? (
                    <div className="p-8 flex items-center justify-center text-gray-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
                ) : !data?.found || table.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">
                        No league data yet — it fills in as the season's results post.
                    </div>
                ) : (
                    <div className="p-3 overflow-y-auto">
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
                <ScoutingReportModal teamId={teamId} opponentName={scoutTeam} onClose={() => setScoutTeam(null)} />
            )}
        </div>
    );

    return createPortal(overlay, document.body);
};

export default ScoutingHub;
