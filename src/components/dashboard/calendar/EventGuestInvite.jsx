import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { useToast } from '../../Toast';
import { UserPlus, X, Search } from 'lucide-react';

// Per-game guest call-ups (coach-only). Invite a player from a SISTER team in the
// same club to play in THIS game. Nothing persists across games — re-pick weekly.
// League cap: the event team's roster + guests must stay <= 16 (enforced server-side
// in invite_event_guest; mirrored here for the UI). Guests show with a GUEST badge
// and never touch the other team's roster, card, stats, or fees.
const CAP = 16;
const initials = (f, l) => `${(f || '?')[0] || ''}${(l || '')[0] || ''}`.toUpperCase();
const rsvpLabel = { going: 'Going', not_going: 'Out', maybe: 'Maybe', vacation: 'Vacation' };

const EventGuestInvite = ({ eventId, teamId }) => {
    const toast = useToast();
    const [guests, setGuests] = useState([]);
    const [rosterCount, setRosterCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [picking, setPicking] = useState(false);
    const [invitable, setInvitable] = useState([]);
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const [guestRes, countRes] = await Promise.all([
            supabase.rpc('list_event_guests', { p_event_id: eventId }),
            supabase.from('player_teams').select('id', { count: 'exact', head: true })
                .eq('team_id', teamId).eq('status', 'active'),
        ]);
        setGuests(guestRes.data || []);
        setRosterCount(countRes.count || 0);
        setLoading(false);
    }, [eventId, teamId]);

    useEffect(() => { load(); }, [load]);

    const total = rosterCount + guests.length;
    const canInvite = total < CAP;

    const openPicker = async () => {
        const { data, error } = await supabase.rpc('list_invitable_players', { p_event_id: eventId });
        if (error) { toast?.error('Could not load players to invite.'); return; }
        setInvitable(data || []);
        setQuery('');
        setPicking(true);
    };

    const invite = async (p) => {
        setBusy(true);
        const { error } = await supabase.rpc('invite_event_guest', { p_event_id: eventId, p_player_id: p.player_id });
        setBusy(false);
        if (error) {
            const full = (error.message || '').toLowerCase().includes('full');
            toast?.error(full ? 'Roster is full — 16 max for this game.' : `Couldn't invite: ${error.message}`);
            return;
        }
        toast?.success(`${p.first_name} invited as a guest.`);
        setPicking(false);
        load();
    };

    const remove = async (g) => {
        const { error } = await supabase.rpc('remove_event_guest', { p_event_id: eventId, p_player_id: g.player_id });
        if (error) { toast?.error(`Couldn't remove: ${error.message}`); return; }
        toast?.success(`${g.first_name} removed.`);
        load();
    };

    const filtered = invitable.filter((p) =>
        `${p.first_name} ${p.last_name || ''}`.toLowerCase().includes(query.trim().toLowerCase()));

    return (
        <div className="border-t border-white/10 pt-4">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-white font-bold flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-brand-gold" /> Guest Players
                </h4>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${total >= CAP ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-gray-300'}`}>
                    {total} / {CAP} on roster
                </span>
            </div>

            {loading ? (
                <p className="text-gray-500 text-sm">Loading…</p>
            ) : (
                <>
                    {guests.length > 0 && (
                        <div className="space-y-2 mb-3">
                            {guests.map((g) => (
                                <div key={g.player_id} className="flex items-center gap-3 rounded-lg bg-white/[0.03] border border-white/5 p-2">
                                    <div className="w-9 h-9 rounded-full bg-brand-gold/15 text-brand-gold flex items-center justify-center text-xs font-bold shrink-0">
                                        {initials(g.first_name, g.last_name)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-white text-sm truncate">{g.first_name} {g.last_name || ''}</span>
                                            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-brand-gold/20 text-brand-gold tracking-wider">Guest</span>
                                        </div>
                                        <div className="text-gray-500 text-[11px]">
                                            {g.home_team || 'Sister team'}
                                            {g.rsvp_status && <span className="ml-2 text-gray-400">· {rsvpLabel[g.rsvp_status] || g.rsvp_status}</span>}
                                        </div>
                                    </div>
                                    <button onClick={() => remove(g)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded" title="Remove guest">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {!picking ? (
                        <button
                            onClick={openPicker}
                            disabled={!canInvite}
                            className="w-full py-2.5 rounded-lg border border-dashed border-brand-gold/40 text-brand-gold text-sm font-bold flex items-center justify-center gap-2 hover:bg-brand-gold/10 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <UserPlus className="w-4 h-4" /> {canInvite ? 'Invite a player from the other team' : 'Roster full (16)'}
                        </button>
                    ) : (
                        <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">Pick a player to invite</span>
                                <button onClick={() => setPicking(false)} className="text-gray-400 hover:text-white p-1"><X className="w-4 h-4" /></button>
                            </div>
                            <div className="flex items-center gap-2 bg-white/5 rounded-lg px-2 mb-2">
                                <Search className="w-4 h-4 text-gray-500" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search players…"
                                    className="bg-transparent text-white text-sm py-2 w-full outline-none placeholder-gray-600"
                                />
                            </div>
                            <div className="max-h-56 overflow-y-auto space-y-1">
                                {filtered.length === 0 ? (
                                    <p className="text-gray-500 text-sm p-3 text-center">No players available to invite.</p>
                                ) : filtered.map((p) => (
                                    <button
                                        key={p.player_id}
                                        onClick={() => invite(p)}
                                        disabled={busy}
                                        className="w-full flex items-center gap-3 rounded-lg p-2 hover:bg-white/5 text-left disabled:opacity-50"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-white/10 text-gray-300 flex items-center justify-center text-xs font-bold shrink-0">
                                            {initials(p.first_name, p.last_name)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-white text-sm truncate">{p.first_name} {p.last_name || ''}</div>
                                            <div className="text-gray-500 text-[11px] truncate">{p.team_name}</div>
                                        </div>
                                        <UserPlus className="w-4 h-4 text-brand-gold shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <p className="text-gray-600 text-[11px] mt-2">Guests play in this game only and don't change their home team. Re-invite each week as needed.</p>
                </>
            )}
        </div>
    );
};

export default EventGuestInvite;
