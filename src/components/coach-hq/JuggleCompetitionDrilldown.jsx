import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Trophy, Pencil, Check, Crown } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useToast } from '../Toast';

// Coach/manager view of the June Juggling Competition: team standings,
// baseline review (fix obvious sandbags), and the live Juggle-Off recorder.
const JuggleCompetitionDrilldown = ({ teamId, onClose }) => {
    const toast = useToast();
    const [board, setBoard] = useState(null);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('standings'); // 'standings' | 'finals'
    const [editing, setEditing] = useState(null);   // player_id whose BASELINE is being edited
    const [editVal, setEditVal] = useState('');
    const [editingBest, setEditingBest] = useState(null); // player_id whose BEST is being edited
    const [bestVal, setBestVal] = useState('');
    const [showAll, setShowAll] = useState(false);   // standings: top 5 vs full list
    const [finals, setFinals] = useState({});        // player_id -> count string
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        if (!teamId) return;
        const [{ data: lb }, { data: sm }] = await Promise.all([
            supabase.rpc('get_juggle_leaderboard', { p_team_id: teamId }),
            supabase.rpc('get_juggle_competition_summary', { p_team_id: teamId }),
        ]);
        setBoard(lb || null);
        setSummary(sm?.summary || null);
        setLoading(false);
    }, [teamId]);

    useEffect(() => { load(); }, [load]);

    // Lock the page behind the sheet so a touch-drag scrolls the standings/
    // editor instead of moving the dashboard up and down behind it.
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    const rows = board?.rows || [];
    const cfg = board?.config || {};

    const saveBaseline = async (playerId) => {
        const n = parseInt(editVal, 10);
        if (!Number.isFinite(n) || n < 0) { toast.error('Enter a number'); return; }
        setBusy(true);
        try {
            const { error } = await supabase.rpc('set_juggle_baseline', { p_player_id: playerId, p_best_count: n, p_video_url: null });
            if (error) throw error;
            toast.success('Baseline updated.');
            setEditing(null); setEditVal('');
            await load();
        } catch (e) { toast.error(e.message || 'Failed'); } finally { setBusy(false); }
    };

    // Staff correction of a player's current best (e.g. fix a fat-fingered score).
    // Unlike logging, this can LOWER the value — set_juggle_best sets it exactly.
    const saveBest = async (playerId) => {
        const n = parseInt(bestVal, 10);
        if (!Number.isFinite(n) || n < 0) { toast.error('Enter a number'); return; }
        setBusy(true);
        try {
            const { error } = await supabase.rpc('set_juggle_best', { p_player_id: playerId, p_best: n });
            if (error) throw error;
            toast.success('Best updated.');
            setEditingBest(null); setBestVal('');
            await load();
        } catch (e) { toast.error(e.message || 'Failed'); } finally { setBusy(false); }
    };

    const recordFinals = async () => {
        const results = Object.entries(finals)
            .map(([player_id, v]) => ({ player_id, final_count: parseInt(v, 10) }))
            .filter((r) => Number.isFinite(r.final_count));
        if (results.length === 0) { toast.error('Enter at least one finalist score'); return; }
        setBusy(true);
        try {
            const { data, error } = await supabase.rpc('record_juggle_finals', { p_team_id: teamId, p_results: results });
            if (error) throw error;
            toast.success(`Juggle-Off recorded — champion crowned! 🏆 (${data?.recorded || results.length} finalists)`);
            setFinals({});
            await load();
            setView('standings');
        } catch (e) { toast.error(e.message || 'Failed'); } finally { setBusy(false); }
    };

    const standings = [...rows].sort((a, b) => b.current_best - a.current_best);

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-brand-dark border border-white/10 w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="shrink-0 border-b border-white/10 p-4 flex items-center gap-3">
                    <Trophy className="w-5 h-5 text-brand-gold" />
                    <h3 className="text-white font-bold flex-1">June Juggling Competition</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                <div className="overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-gold animate-spin" /></div>
                    ) : (
                        <>
                            {summary && (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                                    {[
                                        ['Have baseline', `${summary.players_with_baseline}/${summary.total_players}`],
                                        ['Can juggle 20+', summary.can_20],
                                        ['Team juggles', (summary.team_total_juggles || 0).toLocaleString()],
                                        ['Total minutes', (summary.team_total_minutes || 0).toLocaleString()],
                                        ['Avg improvement', `+${summary.avg_improvement}`],
                                        ['Sessions · 24h', summary.sessions_24h || 0],
                                    ].map(([l, v]) => (
                                        <div key={l} className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                                            <div className="text-white font-bold text-lg">{v}</div>
                                            <div className="text-[10px] uppercase tracking-wider text-gray-500">{l}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex gap-2 mb-3">
                                <button onClick={() => setView('standings')} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider ${view === 'standings' ? 'bg-brand-gold/20 text-brand-gold' : 'bg-white/5 text-gray-400'}`}>Standings & baselines</button>
                                <button onClick={() => setView('finals')} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider ${view === 'finals' ? 'bg-brand-green/20 text-brand-green' : 'bg-white/5 text-gray-400'}`}>Run the Juggle-Off</button>
                            </div>

                            {view === 'standings' ? (
                                <div className="space-y-1">
                                    <div className="grid grid-cols-12 gap-2 px-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                                        <span className="col-span-5">Player</span>
                                        <span className="col-span-2 text-center">Base</span>
                                        <span className="col-span-2 text-center">Best</span>
                                        <span className="col-span-3 text-center">Improve</span>
                                    </div>
                                    {(showAll ? standings : standings.slice(0, 5)).map((r, i) => (
                                        <div key={r.player_id} className="grid grid-cols-12 gap-2 items-center px-2 py-2 rounded-lg bg-white/[0.02] border border-white/5">
                                            <span className="col-span-5 text-sm text-gray-200 truncate flex items-center gap-1.5">
                                                <span className="text-xs text-gray-500 w-4">{i + 1}</span>
                                                {r.first_name} {r.last_initial}. {r.late_start && <span className="text-[9px] text-brand-gold">late</span>}
                                            </span>
                                            <span className="col-span-2 text-center text-sm">
                                                {editing === r.player_id ? (
                                                    <span className="flex items-center gap-1 justify-center">
                                                        <input type="number" value={editVal} onChange={(e) => setEditVal(e.target.value)}
                                                               className="w-12 bg-black/50 border border-white/20 rounded text-white text-center text-sm py-0.5" autoFocus />
                                                        <button onClick={() => saveBaseline(r.player_id)} disabled={busy} className="text-brand-green"><Check className="w-4 h-4" /></button>
                                                    </span>
                                                ) : (
                                                    <button onClick={() => { setEditing(r.player_id); setEditVal(String(r.has_baseline ? r.baseline : '')); }}
                                                            className="inline-flex items-center gap-1 text-gray-300 hover:text-white">
                                                        {r.has_baseline ? r.baseline : '—'} <Pencil className="w-3 h-3 text-gray-600" />
                                                    </button>
                                                )}
                                            </span>
                                            <span className="col-span-2 text-center text-sm">
                                                {editingBest === r.player_id ? (
                                                    <span className="flex items-center gap-1 justify-center">
                                                        <input type="number" value={bestVal} onChange={(e) => setBestVal(e.target.value)}
                                                               className="w-12 bg-black/50 border border-white/20 rounded text-white text-center text-sm py-0.5" autoFocus />
                                                        <button onClick={() => saveBest(r.player_id)} disabled={busy} className="text-brand-green"><Check className="w-4 h-4" /></button>
                                                    </span>
                                                ) : (
                                                    <button onClick={() => { setEditingBest(r.player_id); setBestVal(String(r.current_best ?? 0)); }}
                                                            className="inline-flex items-center gap-1 font-bold text-white hover:text-brand-gold">
                                                        {r.current_best} <Pencil className="w-3 h-3 text-gray-600" />
                                                    </button>
                                                )}
                                            </span>
                                            <span className="col-span-3 text-center text-sm text-brand-green font-bold">{r.has_baseline ? `+${r.improvement}` : '—'}</span>
                                        </div>
                                    ))}
                                    {standings.length > 5 && (
                                        <button onClick={() => setShowAll((v) => !v)}
                                                className="w-full mt-1 py-2 rounded-lg bg-white/5 text-gray-300 text-xs font-bold uppercase tracking-wider hover:bg-white/10">
                                            {showAll ? 'Show less' : `Show all ${standings.length}`}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <p className="text-xs text-gray-400 mb-3">Enter each finalist's live count at practice. Top score is crowned Champion; everyone entered gets a Finalist stamp.</p>
                                    <div className="space-y-1.5">
                                        {standings.map((r) => (
                                            <div key={r.player_id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.02] border border-white/5">
                                                <span className="flex-1 text-sm text-gray-200 truncate">{r.first_name} {r.last_initial}. <span className="text-gray-500 text-xs">(best {r.current_best})</span></span>
                                                <input type="number" inputMode="numeric" placeholder="—"
                                                       value={finals[r.player_id] || ''} onChange={(e) => setFinals((f) => ({ ...f, [r.player_id]: e.target.value }))}
                                                       className="w-16 bg-black/50 border border-white/15 rounded text-white text-center py-1 text-sm" />
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={recordFinals} disabled={busy}
                                            className="mt-4 w-full py-3 rounded-lg bg-brand-gold text-brand-dark font-display font-bold uppercase tracking-wider hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Crown className="w-5 h-5" />} Record Juggle-Off & crown champion
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default JuggleCompetitionDrilldown;
