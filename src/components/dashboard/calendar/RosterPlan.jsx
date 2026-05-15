import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, Plane, MinusCircle, ChevronDown, Copy, Check, Loader2, Calendar, Grid3X3, LayoutGrid } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../../supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../Toast';

const STAFF_ROLES = new Set(['coach', 'manager', 'head_coach', 'assistant_coach', 'team_manager']);

const STATUS_CELL = {
    going:     { label: 'Going',    bg: 'bg-green-500/80', icon: CheckCircle2, ring: 'ring-green-500/40' },
    not_going: { label: 'Out',      bg: 'bg-red-500/80',   icon: XCircle,      ring: 'ring-red-500/40' },
    vacation:  { label: 'Vacation', bg: 'bg-sky-500/80',   icon: Plane,        ring: 'ring-sky-500/40' },
    none:      { label: 'No reply', bg: 'bg-white/5',      icon: MinusCircle,  ring: 'ring-white/10' },
};

// Coach-only view. Two layouts:
//  - tile (default): one card per upcoming event with per-kid breakdown
//  - matrix: rows=players × cols=events, color-coded cells
// Plus a "Copy as text" export for sharing in a group chat.

const RosterPlan = () => {
    const { user, profile } = useAuth();
    const toast = useToast();
    const [mode, setMode] = useState('tile'); // 'tile' | 'matrix'
    const [loading, setLoading] = useState(true);
    const [teamId, setTeamId] = useState(null);
    const [teamName, setTeamName] = useState('');
    const [events, setEvents] = useState([]);
    const [players, setPlayers] = useState([]);
    const [rsvps, setRsvps] = useState({}); // { eventId: { playerId: status } }
    const [expanded, setExpanded] = useState({}); // tile expansion state
    const [copied, setCopied] = useState(false);

    const isStaff = STAFF_ROLES.has(profile?.role);

    useEffect(() => {
        if (!user?.id || !isStaff) { setLoading(false); return; }
        let cancelled = false;

        (async () => {
            setLoading(true);

            // 1) Find the first team this user is staff on
            const { data: memberships } = await supabase
                .from('team_memberships')
                .select('team_id, role, teams!inner(id, name)')
                .eq('user_id', user.id);
            const staffMembership = (memberships || []).find(m => STAFF_ROLES.has(m.role));
            if (!staffMembership) { if (!cancelled) { setLoading(false); } return; }
            const tid = staffMembership.teams.id;
            if (cancelled) return;
            setTeamId(tid);
            setTeamName(staffMembership.teams.name);

            // 2) Upcoming events for that team (today + 90 days)
            const today = new Date();
            const horizon = new Date();
            horizon.setDate(horizon.getDate() + 90);
            const { data: eventsData } = await supabase
                .from('events')
                .select('id, title, type, start_time, location_name, opponent_name, kit_color')
                .eq('team_id', tid)
                .in('type', ['game', 'practice'])
                .gte('start_time', today.toISOString())
                .lte('start_time', horizon.toISOString())
                .order('start_time', { ascending: true });
            if (cancelled) return;
            setEvents(eventsData || []);

            // 3) Active roster on this team
            const { data: rosterData } = await supabase
                .from('team_active_roster')
                .select('id, first_name, last_name, jersey_number, display_name')
                .eq('team_id', tid)
                .order('jersey_number', { ascending: true });
            if (cancelled) return;
            setPlayers(rosterData || []);

            // 4) RSVPs for those events × players
            const eventIds = (eventsData || []).map(e => e.id);
            if (eventIds.length > 0) {
                const { data: rsvpData } = await supabase
                    .from('event_rsvps')
                    .select('event_id, player_id, status')
                    .in('event_id', eventIds);
                if (cancelled) return;
                const lookup = {};
                (rsvpData || []).forEach(r => {
                    if (!lookup[r.event_id]) lookup[r.event_id] = {};
                    lookup[r.event_id][r.player_id] = r.status;
                });
                setRsvps(lookup);
            }

            setLoading(false);
        })();

        return () => { cancelled = true; };
    }, [user?.id, isStaff]);

    // Counts per event, derived
    const countsByEvent = useMemo(() => {
        const out = {};
        events.forEach(e => {
            const tally = { going: 0, not_going: 0, vacation: 0, none: 0 };
            players.forEach(p => {
                const s = rsvps[e.id]?.[p.id];
                if (s === 'going')     tally.going++;
                else if (s === 'not_going') tally.not_going++;
                else if (s === 'vacation')  tally.vacation++;
                else                    tally.none++;
            });
            out[e.id] = tally;
        });
        return out;
    }, [events, players, rsvps]);

    const formatPlayerLabel = (p) => {
        const last = p.last_name ? ` ${p.last_name.charAt(0)}.` : '';
        const num = p.jersey_number != null ? ` #${p.jersey_number}` : '';
        return `${p.first_name}${last}${num}`;
    };

    const handleCopy = async () => {
        const lines = [];
        lines.push(`Fire FC Roster Plan — ${teamName}`);
        lines.push('─'.repeat(40));
        events.forEach(e => {
            const d = new Date(e.start_time);
            const dateStr = format(d, 'EEE MMM d · h:mm a');
            const headline = e.type === 'game'
                ? `${dateStr} · ${e.title}${e.location_name ? ' · ' + e.location_name : ''}`
                : `${dateStr} · ${e.title}${e.location_name ? ' · ' + e.location_name : ''}`;
            lines.push('');
            lines.push(headline);
            const c = countsByEvent[e.id] || {};
            const buckets = [
                { key: 'going', label: 'Going' },
                { key: 'not_going', label: 'Out' },
                { key: 'vacation', label: 'Vacation' },
                { key: 'none', label: 'No reply' },
            ];
            buckets.forEach(b => {
                const names = players
                    .filter(p => {
                        const s = rsvps[e.id]?.[p.id];
                        if (b.key === 'none') return !s || (s !== 'going' && s !== 'not_going' && s !== 'vacation');
                        return s === b.key;
                    })
                    .map(formatPlayerLabel);
                if (names.length > 0) {
                    lines.push(`  ${b.label} (${names.length}): ${names.join(', ')}`);
                }
            });
        });
        try {
            await navigator.clipboard.writeText(lines.join('\n'));
            setCopied(true);
            toast.success('Roster plan copied — paste it anywhere.');
            setTimeout(() => setCopied(false), 2200);
        } catch {
            toast.error('Copy failed.');
        }
    };

    if (!isStaff) return null; // safety net; CalendarHub also hides the toggle
    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-brand-green" />
            </div>
        );
    }

    if (!teamId) {
        return <div className="text-center text-gray-500 text-sm py-8">No team to plan for yet.</div>;
    }

    if (events.length === 0) {
        return (
            <div className="glass-panel p-8 text-center">
                <Calendar className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No upcoming games or practices in the next 90 days.</p>
                <p className="text-gray-600 text-xs mt-1">Add some on the Calendar — they'll show up here automatically.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Sub-toolbar: layout toggle + copy */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10">
                    <button
                        onClick={() => setMode('tile')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase flex items-center gap-1 transition-all ${mode === 'tile' ? 'bg-brand-gold text-brand-dark' : 'text-gray-400 hover:text-white'}`}
                    >
                        <LayoutGrid className="w-3 h-3" /> Tiles
                    </button>
                    <button
                        onClick={() => setMode('matrix')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase flex items-center gap-1 transition-all ${mode === 'matrix' ? 'bg-brand-gold text-brand-dark' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Grid3X3 className="w-3 h-3" /> Season grid
                    </button>
                </div>

                <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-xs font-bold uppercase hover:bg-white/10"
                >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy as text'}
                </button>
            </div>

            {/* TILE MODE */}
            {mode === 'tile' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {events.map(e => {
                        const c = countsByEvent[e.id] || {};
                        const total = (c.going || 0) + (c.not_going || 0) + (c.vacation || 0) + (c.none || 0);
                        const isExpanded = !!expanded[e.id];
                        return (
                            <div key={e.id} className="glass-panel p-4 border-l-4 border-brand-gold/50">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="text-[10px] uppercase tracking-widest text-brand-gold font-bold">
                                            {format(new Date(e.start_time), 'EEE MMM d · h:mm a')}
                                        </div>
                                        <h4 className="text-white font-bold text-base truncate">{e.title}</h4>
                                        {e.location_name && <p className="text-xs text-gray-500">{e.location_name}</p>}
                                    </div>
                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded shrink-0 ${e.type === 'game' ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400'}`}>
                                        {e.type}
                                    </span>
                                </div>

                                {/* Counts */}
                                <div className="grid grid-cols-4 gap-1.5 mt-3">
                                    {[
                                        { key: 'going',     label: 'Going' },
                                        { key: 'not_going', label: 'Out' },
                                        { key: 'vacation',  label: 'Vac' },
                                        { key: 'none',      label: 'TBD' },
                                    ].map(({ key, label }) => {
                                        const m = STATUS_CELL[key];
                                        const val = c[key] || 0;
                                        return (
                                            <div key={key} className={`p-2 rounded text-center ${m.bg} ring-1 ${m.ring}`}>
                                                <div className="text-lg font-display font-bold leading-none text-white">{val}</div>
                                                <div className="text-[9px] uppercase tracking-wider text-white/80 mt-0.5">{label}</div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={() => setExpanded(prev => ({ ...prev, [e.id]: !isExpanded }))}
                                    className="mt-3 inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-white"
                                >
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    {isExpanded ? 'Hide breakdown' : `Show all ${total} players`}
                                </button>

                                {isExpanded && (
                                    <div className="mt-3 space-y-1 max-h-72 overflow-y-auto">
                                        {players.map(p => {
                                            const s = rsvps[e.id]?.[p.id];
                                            const m = STATUS_CELL[s && STATUS_CELL[s] ? s : 'none'];
                                            const Icon = m.icon;
                                            return (
                                                <div key={p.id} className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-white/[0.03]">
                                                    <span className="text-gray-300 truncate">{formatPlayerLabel(p)}</span>
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${m.bg} text-white text-[10px] uppercase font-bold tracking-wider`}>
                                                        <Icon className="w-3 h-3" /> {m.label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* MATRIX MODE */}
            {mode === 'matrix' && (
                <div className="glass-panel p-3 overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                        <thead>
                            <tr>
                                <th className="sticky left-0 z-10 bg-brand-dark text-left p-2 text-gray-400 uppercase font-bold text-[10px] tracking-wider">Player</th>
                                {events.map(e => (
                                    <th key={e.id} className="p-1.5 text-center text-gray-400 font-bold text-[10px] uppercase tracking-wider min-w-[44px]" title={e.title}>
                                        <div>{format(new Date(e.start_time), 'M/d')}</div>
                                        <div className={`text-[9px] mt-0.5 ${e.type === 'game' ? 'text-red-400' : 'text-green-400'}`}>{e.type === 'game' ? 'G' : 'P'}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {players.map(p => (
                                <tr key={p.id} className="border-t border-white/5">
                                    <td className="sticky left-0 z-10 bg-brand-dark p-2 text-white text-xs whitespace-nowrap">
                                        {formatPlayerLabel(p)}
                                    </td>
                                    {events.map(e => {
                                        const s = rsvps[e.id]?.[p.id];
                                        const key = s && STATUS_CELL[s] ? s : 'none';
                                        const m = STATUS_CELL[key];
                                        const Icon = m.icon;
                                        return (
                                            <td key={e.id} className="p-1 text-center">
                                                <span
                                                    title={m.label}
                                                    className={`inline-flex items-center justify-center w-7 h-7 rounded ${m.bg} ring-1 ${m.ring}`}
                                                >
                                                    <Icon className="w-3.5 h-3.5 text-white" />
                                                </span>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Legend */}
                    <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
                        {Object.entries(STATUS_CELL).map(([key, m]) => {
                            const Icon = m.icon;
                            return (
                                <span key={key} className="inline-flex items-center gap-1.5 text-gray-400">
                                    <span className={`inline-flex items-center justify-center w-4 h-4 rounded ${m.bg} ring-1 ${m.ring}`}>
                                        <Icon className="w-2.5 h-2.5 text-white" />
                                    </span>
                                    {m.label}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RosterPlan;
