import React, { useState, useEffect, useCallback } from 'react';
import { Users } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../Toast';
import { resolveWritablePlayers, statusLabel } from '../../../utils/rsvp';
import RsvpButtons from './RsvpButtons';

// Per-child RSVP for parents/players, shown inside EventDetailModal.
//
// A guardian linked to more than one player on the same team (e.g. the
// Schroms — Declan #7 + Oliver #26 on Summer Squad) gets ONE button cluster
// PER child, so they can mark one Going and the other Out. Before this, the
// only parent RSVP path was upsertRsvpForMany, which batched a single status
// across EVERY linked kid — that's why every Schrom RSVP row had both boys
// with an identical status + timestamp. Single-child families simply see one
// row ("Your RSVP").
//
// Writes go straight to event_rsvps keyed by (event_id, player_id) so each
// child is independent — mirrors RsvpSummary.setStatusFor. RLS ("Guardians or
// team staff can write RSVPs") still gates the write. Returns null for staff
// (resolveWritablePlayers gives them []) and for unlinked accounts.
const ParentRsvpControls = ({ eventId, teamId }) => {
    const { user, profile } = useAuth();
    const toast = useToast();
    const [players, setPlayers] = useState([]); // [{ id, first_name, last_name, status }]
    const [loading, setLoading] = useState(true);
    const [pendingId, setPendingId] = useState(null);

    const load = useCallback(async () => {
        if (!user?.id || !eventId || !teamId) { setLoading(false); return; }
        const writable = await resolveWritablePlayers(user.id, profile?.role);
        if (writable.length === 0) { setPlayers([]); setLoading(false); return; }

        // Narrow to the kids actually ACTIVE on THIS event's team — a parent
        // with a kid on another club team shouldn't see that kid here (and the
        // write would no-op under RLS anyway).
        const ids = writable.map(p => p.id);
        const [teamRes, rsvpRes] = await Promise.all([
            supabase
                .from('player_teams')
                .select('player_id')
                .eq('team_id', teamId)
                .eq('status', 'active')
                .in('player_id', ids),
            supabase
                .from('event_rsvps')
                .select('player_id, status')
                .eq('event_id', eventId)
                .in('player_id', ids),
        ]);
        const onTeam = new Set((teamRes.data || []).map(r => r.player_id));
        const statusByPlayer = {};
        (rsvpRes.data || []).forEach(r => { statusByPlayer[r.player_id] = r.status; });

        const rows = writable
            .filter(p => onTeam.has(p.id))
            .map(p => ({ ...p, status: statusByPlayer[p.id] || null }));
        setPlayers(rows);
        setLoading(false);
    }, [user?.id, profile?.role, eventId, teamId]);

    useEffect(() => { load(); }, [load]);

    const setStatusFor = async (playerId, status) => {
        const who = players.find(p => p.id === playerId);
        setPendingId(playerId);
        // Optimistic — flip just this child's cluster.
        setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, status } : p));
        const { error } = await supabase
            .from('event_rsvps')
            .upsert(
                { event_id: eventId, player_id: playerId, status, updated_at: new Date().toISOString() },
                { onConflict: 'event_id,player_id' },
            );
        setPendingId(null);
        if (error) {
            console.error('RSVP failed:', error);
            toast?.error(`Couldn't save RSVP: ${error.message}`);
            load(); // revert to server truth
            return;
        }
        toast?.success(`${who?.first_name || 'Player'} marked ${statusLabel(status)}.`);
    };

    if (loading || players.length === 0) return null;

    return (
        <div className="border-t border-white/10 pt-4">
            <h4 className="text-white font-bold flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-brand-green" />
                {players.length > 1 ? 'RSVP each player' : 'Your RSVP'}
            </h4>
            <div className="space-y-2">
                {players.map(p => (
                    <div
                        key={p.id}
                        className={`flex items-center justify-between gap-3 bg-white/5 rounded-lg px-3 py-2 ${pendingId === p.id ? 'opacity-60' : ''}`}
                    >
                        <span className="text-sm text-white font-medium truncate">
                            {p.first_name}{p.last_name ? ` ${p.last_name.charAt(0)}.` : ''}
                            {p.jersey_number != null ? ` #${p.jersey_number}` : ''}
                        </span>
                        <RsvpButtons
                            eventId={eventId}
                            currentStatus={p.status}
                            onRsvp={(_eventId, status) => setStatusFor(p.id, status)}
                            size="sm"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ParentRsvpControls;
