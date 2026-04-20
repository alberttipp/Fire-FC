import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { supabase } from '../../../supabaseClient';

const RsvpSummary = ({ eventId }) => {
    const [attendees, setAttendees] = useState({ going: [], maybe: [], not_going: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            const { data } = await supabase
                .from('event_rsvps')
                .select('status, player_id')
                .eq('event_id', eventId);

            if (!data || data.length === 0) { setLoading(false); return; }

            const playerIds = data.map(r => r.player_id);
            const { data: players } = await supabase
                .from('players')
                .select('id, first_name, last_name, jersey_number')
                .in('id', playerIds);

            // Also check profiles for non-player users (coaches)
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', playerIds);

            const nameMap = {};
            (players || []).forEach(p => { nameMap[p.id] = `${p.first_name} ${p.last_name?.charAt(0)}.  #${p.jersey_number || ''}`; });
            (profiles || []).forEach(p => { if (!nameMap[p.id] && p.full_name) nameMap[p.id] = p.full_name; });

            const grouped = { going: [], maybe: [], not_going: [] };
            data.forEach(r => {
                const name = nameMap[r.player_id] || 'Unknown';
                if (grouped[r.status]) grouped[r.status].push(name);
            });

            setAttendees(grouped);
            setLoading(false);
        };
        fetch();
    }, [eventId]);

    if (loading) return <div className="text-gray-500 text-xs">Loading attendance...</div>;

    const total = attendees.going.length + attendees.maybe.length + attendees.not_going.length;
    if (total === 0) return <div className="text-gray-500 text-xs">No RSVPs yet</div>;

    const sections = [
        { key: 'going', label: 'Going', items: attendees.going, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
        { key: 'maybe', label: 'Maybe', items: attendees.maybe, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
        { key: 'not_going', label: "Can't Go", items: attendees.not_going, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    ];

    return (
        <div className="border-t border-white/10 pt-4 mt-4">
            <h4 className="text-white font-bold flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-brand-green" />
                Attendance ({total})
            </h4>
            <div className="grid grid-cols-3 gap-2">
                {sections.map(({ key, label, items, color, bg, border }) => (
                    <div key={key} className={`${bg} border ${border} rounded-lg p-3`}>
                        <div className={`text-xs font-bold uppercase ${color} mb-2`}>{label} ({items.length})</div>
                        <div className="space-y-1">
                            {items.map((name, i) => (
                                <div key={i} className="text-xs text-gray-300 truncate">{name}</div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RsvpSummary;
