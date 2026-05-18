import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { supabase } from '../../../supabaseClient';

// Attendance panel — Byga-style. Always shows the full active roster so
// parents can see at a glance who's coming, who's out, who's on vacation,
// and who hasn't replied yet ("No Response" is usually the largest group
// for a youth team).
const RsvpSummary = ({ eventId, teamId }) => {
    const [groups, setGroups] = useState({ going: [], not_going: [], vacation: [], no_response: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!eventId || !teamId) { setLoading(false); return; }
        const fetch = async () => {
            const [rosterRes, rsvpRes] = await Promise.all([
                supabase
                    .from('player_teams')
                    .select('player_id, players!inner(id, first_name, last_name, jersey_number)')
                    .eq('team_id', teamId)
                    .eq('status', 'active'),
                supabase
                    .from('event_rsvps')
                    .select('status, player_id')
                    .eq('event_id', eventId),
            ]);

            const roster = (rosterRes.data || []).map(r => r.players).filter(Boolean);
            const rsvpByPlayer = {};
            (rsvpRes.data || []).forEach(r => { rsvpByPlayer[r.player_id] = r.status; });

            const displayName = (p) => {
                const last = p.last_name ? `${p.last_name.charAt(0)}.` : '';
                const num = p.jersey_number != null ? `  #${p.jersey_number}` : '';
                return `${p.first_name} ${last}${num}`.trim();
            };

            const grouped = { going: [], not_going: [], vacation: [], no_response: [] };
            roster.forEach(p => {
                const status = rsvpByPlayer[p.id];
                const name = displayName(p);
                if (status === 'going')          grouped.going.push(name);
                else if (status === 'not_going') grouped.not_going.push(name);
                else if (status === 'vacation')  grouped.vacation.push(name);
                else                              grouped.no_response.push(name);
                // Legacy 'maybe' rows fall into no_response — they didn't give a usable answer.
            });

            // Stable sort each group alphabetically so the list doesn't reshuffle on re-render.
            Object.keys(grouped).forEach(k => grouped[k].sort((a, b) => a.localeCompare(b)));

            setGroups(grouped);
            setLoading(false);
        };
        fetch();
    }, [eventId, teamId]);

    if (loading) return <div className="text-gray-500 text-xs">Loading attendance...</div>;

    const total = groups.going.length + groups.not_going.length + groups.vacation.length + groups.no_response.length;
    if (total === 0) {
        return (
            <div className="border-t border-white/10 pt-4 mt-4 text-gray-500 text-xs">
                No roster yet for this team.
            </div>
        );
    }

    const sections = [
        { key: 'going',       label: 'Going',       items: groups.going,       color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
        { key: 'not_going',   label: 'Out',         items: groups.not_going,   color: 'text-red-400',   bg: 'bg-red-500/10',   border: 'border-red-500/20' },
        { key: 'vacation',    label: 'Vacation',    items: groups.vacation,    color: 'text-sky-400',   bg: 'bg-sky-500/10',   border: 'border-sky-500/20' },
        { key: 'no_response', label: 'No Response', items: groups.no_response, color: 'text-gray-300',  bg: 'bg-white/5',      border: 'border-white/10' },
    ];

    return (
        <div className="border-t border-white/10 pt-4 mt-4">
            <h4 className="text-white font-bold flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-brand-green" />
                Attendance — {groups.going.length} going / {total} roster
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {sections.map(({ key, label, items, color, bg, border }) => (
                    <div key={key} className={`${bg} border ${border} rounded-lg p-3`}>
                        <div className={`text-xs font-bold uppercase ${color} mb-2`}>{label} ({items.length})</div>
                        <div className="space-y-1">
                            {items.length === 0 ? (
                                <div className="text-[11px] text-gray-500 italic">—</div>
                            ) : (
                                items.map((name, i) => (
                                    <div key={i} className="text-xs text-gray-300 truncate">{name}</div>
                                ))
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RsvpSummary;
