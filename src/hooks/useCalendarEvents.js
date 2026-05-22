import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useToast } from '../components/Toast';
import { WRITE_RELATIONSHIPS } from '../constants/roles';
import { resolveWritablePlayers, upsertRsvpForMany, namesList, statusLabel } from '../utils/rsvp';

const useCalendarEvents = ({ user, profile, dateRange, rsvpPlayerId }) => {
    const toast = useToast();
    const [events, setEvents] = useState([]);
    const [rsvps, setRsvps] = useState({});
    const [rsvpCounts, setRsvpCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [resolvedPlayerId, setResolvedPlayerId] = useState(null);
    const [linkedPlayers, setLinkedPlayers] = useState([]); // all kids parent can RSVP for

    // Resolve which player_id this user RSVPs as.
    //   parent → first kid linked via family_members
    //   player → players row keyed by user_id
    //   coach/manager/etc → null (they manage attendance from RsvpSummary,
    //                       they don't personally RSVP since they aren't on the roster)
    // Bug history: this hook used to fall back to `user?.id` if no
    // rsvpPlayerId was passed. For parents that's their auth UUID, NOT a
    // players.id, so every upsert failed event_rsvps_player_id_fkey and
    // the click was silently lost. Martin reported this 2026-05-18.
    useEffect(() => {
        let cancelled = false;
        const resolve = async () => {
            if (rsvpPlayerId) {
                if (!cancelled) { setResolvedPlayerId(rsvpPlayerId); setLinkedPlayers([{ id: rsvpPlayerId }]); }
                return;
            }
            const players = await resolveWritablePlayers(user?.id, profile?.role);
            if (cancelled) return;
            setLinkedPlayers(players);
            // resolvedPlayerId stays as the "first kid" for backward-compat with the
            // personal-RSVP fetch below. handleRsvp uses linkedPlayers (all kids)
            // instead so multi-kid families RSVP everyone in one tap.
            setResolvedPlayerId(players[0]?.id || null);
        };
        resolve();
        return () => { cancelled = true; };
    }, [user?.id, profile?.role, rsvpPlayerId]);

    const playerId = resolvedPlayerId;

    const fetchEvents = useCallback(async () => {
        if (!user) return;
        setLoading(true);

        try {
            // Resolve team IDs based on role
            let teamIds = [];
            const userRole = profile?.role;

            if (userRole === 'parent') {
                // Parent → all teams that any of their linked kids is
                // ACTIVE on (read from player_teams, not the deprecated
                // players.team_id scalar).
                const { data: links } = await supabase
                    .from('family_members')
                    .select('player_id')
                    .eq('user_id', user.id)
                    .in('relationship', ['guardian', 'fan']);
                if (links?.length > 0) {
                    const playerIds = links.map(l => l.player_id);
                    const { data: memberships } = await supabase
                        .from('player_teams')
                        .select('team_id')
                        .in('player_id', playerIds)
                        .eq('status', 'active');
                    if (memberships) {
                        teamIds = [...new Set(memberships.map(m => m.team_id).filter(Boolean))];
                    }
                }
            } else if (userRole === 'manager' || userRole === 'coach') {
                const { data: teams } = await supabase.from('teams').select('id');
                if (teams) teamIds = teams.map(t => t.id);
            } else if (userRole === 'player') {
                // Player → all teams they are ACTIVE on. Even if profile.team_id
                // is set (legacy primary pointer), still merge from player_teams
                // so a kid on a club team + Summer Squad sees both feeds.
                const { data: playerRow } = await supabase
                    .from('players')
                    .select('id')
                    .eq('user_id', user.id)
                    .maybeSingle();
                if (playerRow?.id) {
                    const { data: memberships } = await supabase
                        .from('player_teams')
                        .select('team_id')
                        .eq('player_id', playerRow.id)
                        .eq('status', 'active');
                    if (memberships?.length > 0) {
                        teamIds = memberships.map(m => m.team_id).filter(Boolean);
                    }
                }
                // Hard fallback to profile.team_id only if the lookup found nothing
                if (teamIds.length === 0 && profile?.team_id) teamIds = [profile.team_id];
            } else {
                if (profile?.team_id) {
                    teamIds = [profile.team_id];
                } else if (user) {
                    const { data: memberships } = await supabase
                        .from('team_memberships')
                        .select('team_id')
                        .eq('user_id', user.id);
                    if (memberships?.length > 0) {
                        teamIds = memberships.map(m => m.team_id).filter(Boolean);
                    }
                }
            }

            if (teamIds.length === 0) {
                setEvents([]);
                setLoading(false);
                return;
            }

            // Fetch events with optional date range filter
            let query = supabase
                .from('events')
                .select('*')
                .in('team_id', teamIds)
                .order('start_time', { ascending: true });

            if (dateRange?.start) {
                query = query.gte('start_time', dateRange.start.toISOString());
            }
            if (dateRange?.end) {
                query = query.lte('start_time', dateRange.end.toISOString());
            }

            const { data: eventData, error } = await query;
            if (error) throw error;

            const fetchedEvents = eventData || [];
            setEvents(fetchedEvents);

            // RSVP fetch fans out into two queries:
            //   - personal RSVPs (only for users with a resolved playerId,
            //     i.e. parents and players — staff don't have one)
            //   - all-RSVP counts for every visible event (everyone needs
            //     these, including coaches looking at the month view)
            // Previously both were gated on `playerId`, so coaches saw
            // empty RSVP counts. Fixed 2026-05-22.
            if (fetchedEvents.length > 0) {
                const eventIds = fetchedEvents.map(e => e.id);

                if (playerId) {
                    const { data: rsvpData } = await supabase
                        .from('event_rsvps')
                        .select('event_id, status')
                        .eq('player_id', playerId)
                        .in('event_id', eventIds);
                    const myRsvps = {};
                    (rsvpData || []).forEach(r => { myRsvps[r.event_id] = r.status; });
                    setRsvps(myRsvps);
                } else {
                    setRsvps({});
                }

                const { data: allRsvps } = await supabase
                    .from('event_rsvps')
                    .select('event_id, status')
                    .in('event_id', eventIds);
                const counts = {};
                (allRsvps || []).forEach(r => {
                    if (!counts[r.event_id]) counts[r.event_id] = { going: 0, maybe: 0, not_going: 0 };
                    if (counts[r.event_id][r.status] !== undefined) {
                        counts[r.event_id][r.status]++;
                    }
                });
                setRsvpCounts(counts);
            } else {
                setRsvps({});
                setRsvpCounts({});
            }
        } catch (err) {
            console.error('Error loading calendar events:', err);
        } finally {
            setLoading(false);
        }
    }, [user?.id, profile?.role, dateRange?.start?.getTime(), dateRange?.end?.getTime(), playerId]);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    // Live updates: when anyone RSVPs (or an event itself changes), refresh
    // the view. event_rsvps + events were added to the supabase_realtime
    // publication 2026-05-22 — without this subscription the calendar
    // looked stale until a manual refresh. We dedupe within 500ms so a
    // burst of RSVPs from one tap doesn't fan out into N refetches.
    useEffect(() => {
        if (!user?.id) return;
        let timer = null;
        const scheduleRefetch = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => { fetchEvents(); }, 500);
        };
        const channel = supabase
            .channel(`calendar:${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'event_rsvps' }, scheduleRefetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'events' },      scheduleRefetch)
            .subscribe();
        return () => {
            if (timer) clearTimeout(timer);
            supabase.removeChannel(channel);
        };
    }, [user?.id, fetchEvents]);

    const handleRsvp = async (eventId, status) => {
        // Targets: every kid this user can write for who is on the event's team.
        // Without an event object handy here we use all linkedPlayers — RLS
        // blocks writes for kids not on the team anyway, so worst case is one
        // upsert silently no-ops (and the toast still reports the rest).
        const targets = linkedPlayers;
        if (targets.length === 0) {
            if (profile?.role === 'parent') {
                toast?.warning("Can't RSVP — your account isn't linked to a player yet. Enter your guardian code.");
            } else {
                toast?.info("Tap the event to manage attendance for the whole team.");
            }
            return;
        }

        // Optimistic update (per-event status — for multi-kid this becomes
        // "any kid's status" which is fine for the highlight; the
        // EventDetailModal shows the real per-kid breakdown).
        setRsvps(prev => ({ ...prev, [eventId]: status }));

        const { ok, errors } = await upsertRsvpForMany(eventId, targets.map(t => t.id), status);
        if (!ok) {
            const msg = errors[0]?.error?.message || 'unknown error';
            console.error('RSVP failed:', errors);
            toast?.error(`Couldn't save RSVP: ${msg}`);
            fetchEvents(); // Revert on failure
        } else {
            toast?.success(`${namesList(targets)} marked ${statusLabel(status)}.`);
        }
    };

    return { events, rsvps, rsvpCounts, loading, handleRsvp, refetch: fetchEvents };
};

export default useCalendarEvents;
