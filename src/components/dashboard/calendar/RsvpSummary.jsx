import React, { useState, useEffect, useCallback } from 'react';
import { Users, CheckCircle, XCircle, Plane, RotateCcw } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { useAuth } from '../../../context/AuthContext';

// Attendance panel — Byga-style. Always shows the full active roster so
// parents can see at a glance who's coming, who's out, who's on vacation,
// and who hasn't replied yet ("No Response" is usually the largest group
// for a youth team).
//
// Coach/manager users also get inline mini-buttons next to each player to
// override the RSVP on their behalf (write-through enforced by the
// event_rsvps RLS policy installed 2026-05-18).
const RsvpSummary = ({ eventId, teamId }) => {
    const { profile } = useAuth();
    const isStaff = profile?.role === 'coach' || profile?.role === 'manager' ||
                    profile?.role === 'head_coach' || profile?.role === 'assistant_coach' ||
                    profile?.role === 'team_manager';

    const [roster, setRoster] = useState([]); // [{ id, first_name, last_name, jersey_number, status }]
    const [loading, setLoading] = useState(true);
    const [pendingId, setPendingId] = useState(null);

    const load = useCallback(async () => {
        if (!eventId || !teamId) { setLoading(false); return; }
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
        const rsvpByPlayer = {};
        (rsvpRes.data || []).forEach(r => { rsvpByPlayer[r.player_id] = r.status; });
        const merged = (rosterRes.data || [])
            .map(r => r.players)
            .filter(Boolean)
            .map(p => ({
                ...p,
                status: ['going', 'not_going', 'vacation'].includes(rsvpByPlayer[p.id])
                    ? rsvpByPlayer[p.id]
                    : 'no_response',
            }));
        setRoster(merged);
        setLoading(false);
    }, [eventId, teamId]);

    useEffect(() => { load(); }, [load]);

    const setStatusFor = async (playerId, newStatus) => {
        setPendingId(playerId);
        // Optimistic update
        setRoster(prev => prev.map(p => p.id === playerId ? { ...p, status: newStatus } : p));
        if (newStatus === 'no_response') {
            // Clear the RSVP entirely
            const { error } = await supabase
                .from('event_rsvps')
                .delete()
                .eq('event_id', eventId)
                .eq('player_id', playerId);
            if (error) { console.error('Clear RSVP failed:', error); await load(); }
        } else {
            const { error } = await supabase
                .from('event_rsvps')
                .upsert({ event_id: eventId, player_id: playerId, status: newStatus },
                        { onConflict: 'event_id,player_id' });
            if (error) { console.error('Set RSVP failed:', error); await load(); }
        }
        setPendingId(null);
    };

    if (loading) return <div className="text-gray-500 text-xs">Loading attendance...</div>;
    if (roster.length === 0) {
        return (
            <div className="border-t border-white/10 pt-4 mt-4 text-gray-500 text-xs">
                No roster yet for this team.
            </div>
        );
    }

    const counts = {
        going:       roster.filter(p => p.status === 'going').length,
        not_going:   roster.filter(p => p.status === 'not_going').length,
        vacation:    roster.filter(p => p.status === 'vacation').length,
        no_response: roster.filter(p => p.status === 'no_response').length,
    };
    const total = roster.length;

    const sections = [
        { key: 'going',       label: 'Going',       color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
        { key: 'not_going',   label: 'Out',         color: 'text-red-400',   bg: 'bg-red-500/10',   border: 'border-red-500/20' },
        { key: 'vacation',    label: 'Vacation',    color: 'text-sky-400',   bg: 'bg-sky-500/10',   border: 'border-sky-500/20' },
        { key: 'no_response', label: 'No Response', color: 'text-gray-300',  bg: 'bg-white/5',      border: 'border-white/10' },
    ];

    const displayName = (p) => {
        const last = p.last_name ? `${p.last_name.charAt(0)}.` : '';
        const num = p.jersey_number != null ? ` #${p.jersey_number}` : '';
        return `${p.first_name} ${last}${num}`.trim();
    };

    const sortedSection = (key) =>
        roster.filter(p => p.status === key)
              .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));

    return (
        <div className="border-t border-white/10 pt-4 mt-4">
            <h4 className="text-white font-bold flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-brand-green" />
                Attendance — {counts.going} going / {total} roster
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {sections.map(({ key, label, color, bg, border }) => {
                    const items = sortedSection(key);
                    return (
                        <div key={key} className={`${bg} border ${border} rounded-lg p-3`}>
                            <div className={`text-xs font-bold uppercase ${color} mb-2`}>{label} ({items.length})</div>
                            <div className="space-y-1.5">
                                {items.length === 0 ? (
                                    <div className="text-[11px] text-gray-500 italic">—</div>
                                ) : (
                                    items.map(p => (
                                        <div key={p.id} className="text-xs text-gray-300">
                                            <div className="truncate">{displayName(p)}</div>
                                            {isStaff && (
                                                <StaffControls
                                                    current={p.status}
                                                    disabled={pendingId === p.id}
                                                    onPick={(s) => setStatusFor(p.id, s)}
                                                />
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            {isStaff && (
                <p className="text-[10px] text-gray-500 mt-2">
                    Tip: as {profile?.role}, you can tap the icons under any player to override their RSVP.
                </p>
            )}
        </div>
    );
};

// Tiny 4-icon row: Going / Out / Vacation / Clear. Shown only to staff.
const StaffControls = ({ current, disabled, onPick }) => {
    const btns = [
        { s: 'going',       Icon: CheckCircle, active: 'bg-green-500 text-white', title: 'Mark Going' },
        { s: 'not_going',   Icon: XCircle,     active: 'bg-red-500 text-white',   title: 'Mark Out' },
        { s: 'vacation',    Icon: Plane,       active: 'bg-sky-500 text-white',   title: 'Mark Vacation' },
        { s: 'no_response', Icon: RotateCcw,   active: 'bg-white/20 text-white',  title: 'Clear RSVP' },
    ];
    return (
        <div className="flex items-center gap-0.5 mt-1">
            {btns.map(({ s, Icon, active, title }) => (
                <button
                    key={s}
                    onClick={(e) => { e.stopPropagation(); onPick(s); }}
                    disabled={disabled}
                    title={title}
                    aria-label={title}
                    className={`p-1 rounded transition-colors ${current === s ? active : 'text-gray-500 hover:text-white hover:bg-white/10'} ${disabled ? 'opacity-50' : ''}`}
                >
                    <Icon className="w-3 h-3" />
                </button>
            ))}
        </div>
    );
};

export default RsvpSummary;
