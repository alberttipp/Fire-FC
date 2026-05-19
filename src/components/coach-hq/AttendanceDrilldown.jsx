import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';

// Per-player attendance breakdown for a given event type ('practice' or 'game')
// over the past 30 days. Sorted by attendance% descending.
const AttendanceDrilldown = ({ teamId, eventType, label, onClose }) => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            // Past 30-day events of this type on this team
            const { data: events } = await supabase
                .from('events')
                .select('id, start_time')
                .eq('team_id', teamId)
                .eq('type', eventType)
                .gte('start_time', new Date(Date.now() - 30 * 86400000).toISOString())
                .lte('start_time', new Date().toISOString());
            if (cancelled) return;
            const eventIds = (events || []).map(e => e.id);
            if (eventIds.length === 0) { setRows([]); setLoading(false); return; }

            // Roster + RSVPs in parallel
            const [{ data: roster }, { data: rsvps }] = await Promise.all([
                supabase.from('player_teams').select('player_id, players!inner(id,first_name,last_name,jersey_number)').eq('team_id', teamId).eq('status', 'active'),
                supabase.from('event_rsvps').select('event_id, player_id, status').in('event_id', eventIds),
            ]);
            if (cancelled) return;

            const wentByPlayer = new Map();
            (rsvps || []).forEach(r => {
                if (['going', 'attended'].includes(r.status)) {
                    wentByPlayer.set(r.player_id, (wentByPlayer.get(r.player_id) || 0) + 1);
                }
            });
            const total = eventIds.length;
            const computed = (roster || []).map(r => {
                const p = r.players;
                const went = wentByPlayer.get(p.id) || 0;
                return {
                    id: p.id,
                    name: `${p.first_name} ${p.last_name?.charAt(0) || ''}.`,
                    jersey: p.jersey_number,
                    went, total,
                    pct: total > 0 ? Math.round(100 * went / total) : 0,
                };
            }).sort((a, b) => b.pct - a.pct);
            setRows(computed);
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [teamId, eventType]);

    return (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
            <div className="bg-brand-dark border border-white/10 rounded-t-2xl md:rounded-2xl w-full md:max-w-md max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-white font-bold">{label} · past 30 days</h3>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="overflow-y-auto p-3">
                    {loading ? (
                        <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>
                    ) : rows.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-6">No past {eventType}s in the last 30 days.</p>
                    ) : (
                        <ul className="space-y-1">
                            {rows.map(r => (
                                <li key={r.id} className="flex items-center gap-3 p-2 rounded bg-white/5">
                                    <span className="w-7 text-center text-xs font-bold text-gray-400">#{r.jersey ?? '—'}</span>
                                    <span className="flex-1 text-white text-sm">{r.name}</span>
                                    <span className="text-xs text-gray-400">{r.went}/{r.total}</span>
                                    <span className={`text-sm font-bold ${r.pct >= 75 ? 'text-brand-green' : r.pct >= 50 ? 'text-brand-gold' : 'text-red-400'}`}>{r.pct}%</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AttendanceDrilldown;
