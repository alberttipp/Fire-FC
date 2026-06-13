// RSVP helpers shared across handlers.
//
// Multi-kid families: a parent with two siblings on the same team (e.g.
// the Schroms — Declan + Oliver on Summer Squad) needs every RSVP click
// to apply to EVERY linked kid, not just the first. Without this,
// tapping "Going" silently RSVPs one child and the other shows up as
// "No Response" in the coach's attendance view.

import { supabase } from '../supabaseClient';
import { WRITE_RELATIONSHIPS } from '../constants/roles';

// Resolve every players row this user can write RSVPs for.
//   parent → all kids linked via family_members with guardian/parent relationship
//   player → the players row keyed by user_id (one entry, themself)
//   staff  → empty array (they use the coach-override controls instead)
//
// Returns: [{ id, first_name, last_name }, ...] — empty array if nothing
// resolvable. The caller decides what to do with empty (usually toast a
// "link your kid via guardian code" hint).
export async function resolveWritablePlayers(userId, role) {
    if (!userId || !role) return [];
    if (role === 'parent') {
        const { data } = await supabase
            .from('family_members')
            .select('player_id, players:players!inner(id, first_name, last_name, jersey_number)')
            .eq('user_id', userId)
            .in('relationship', WRITE_RELATIONSHIPS);
        return (data || []).map(r => r.players).filter(Boolean);
    }
    if (role === 'player') {
        const { data } = await supabase
            .from('players')
            .select('id, first_name, last_name, jersey_number')
            .eq('user_id', userId)
            .maybeSingle();
        return data ? [data] : [];
    }
    return [];
}

// "Bo & Oliver" / "Bo, Oliver & Declan" / "Bo"
export function namesList(players) {
    const names = players.map(p => p.first_name).filter(Boolean);
    if (names.length === 0) return '';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} & ${names[1]}`;
    return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

export function statusLabel(status) {
    if (status === 'going') return 'Going';
    if (status === 'not_going') return 'Out';
    if (status === 'vacation') return 'Vacation';
    return status;
}

// Upsert one status for many kids on the same event. Returns
// { ok: boolean, errors: [{playerId, error}] }.
export async function upsertRsvpForMany(eventId, playerIds, status) {
    if (!eventId || !playerIds?.length) return { ok: false, errors: [] };
    const rows = playerIds.map(pid => ({
        event_id: eventId,
        player_id: pid,
        status,
        updated_at: new Date().toISOString(),
    }));
    // Single batched upsert. Postgres handles the ON CONFLICT per row.
    const { error } = await supabase
        .from('event_rsvps')
        .upsert(rows, { onConflict: 'event_id,player_id' });
    if (error) return { ok: false, errors: [{ error }] };
    return { ok: true, errors: [] };
}
