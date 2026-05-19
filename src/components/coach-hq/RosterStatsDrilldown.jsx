import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';

// Per-player roster ranked by either weekly_minutes or weekly_touches.
// `metric` prop picks which column to rank by + display.
const RosterStatsDrilldown = ({ teamId, metric, label, onClose }) => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data: roster } = await supabase
                .from('player_teams')
                .select('player_id, players!inner(id,first_name,last_name,jersey_number)')
                .eq('team_id', teamId).eq('status', 'active');
            if (cancelled) return;
            const ids = (roster || []).map(r => r.player_id);
            if (ids.length === 0) { setRows([]); setLoading(false); return; }
            const { data: stats } = await supabase
                .from('player_stats')
                .select('player_id, weekly_minutes, weekly_touches, training_minutes, career_touches')
                .in('player_id', ids);
            if (cancelled) return;
            const byId = new Map((stats || []).map(s => [s.player_id, s]));
            const list = (roster || []).map(r => {
                const p = r.players;
                const s = byId.get(p.id) || {};
                return {
                    id: p.id,
                    name: `${p.first_name} ${p.last_name?.charAt(0) || ''}.`,
                    jersey: p.jersey_number,
                    weekly_minutes: s.weekly_minutes || 0,
                    weekly_touches: s.weekly_touches || 0,
                    career_minutes: s.training_minutes || 0,
                    career_touches: s.career_touches || 0,
                };
            }).sort((a, b) => (b[metric] || 0) - (a[metric] || 0));
            setRows(list);
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [teamId, metric]);

    const metricLabel = metric === 'weekly_minutes' ? 'min/wk' : 'touches/wk';
    const careerKey = metric === 'weekly_minutes' ? 'career_minutes' : 'career_touches';
    const careerLabel = metric === 'weekly_minutes' ? 'min career' : 'touches career';

    return (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
            <div className="bg-brand-dark border border-white/10 rounded-t-2xl md:rounded-2xl w-full md:max-w-md max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-white font-bold">{label}</h3>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="overflow-y-auto p-3">
                    {loading ? (
                        <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>
                    ) : rows.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-6">No active players.</p>
                    ) : (
                        <ul className="space-y-1">
                            {rows.map(r => (
                                <li key={r.id} className="flex items-center gap-3 p-2 rounded bg-white/5">
                                    <span className="w-7 text-center text-xs font-bold text-gray-400">#{r.jersey ?? '—'}</span>
                                    <span className="flex-1 text-white text-sm">{r.name}</span>
                                    <span className="text-[10px] text-gray-500">{(r[careerKey] || 0).toLocaleString()} {careerLabel}</span>
                                    <span className="text-sm font-bold text-brand-green w-24 text-right">{(r[metric] || 0).toLocaleString()} <span className="text-[10px] text-gray-500">{metricLabel}</span></span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RosterStatsDrilldown;
