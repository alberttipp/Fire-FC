import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useToast } from '../components/Toast';
import { WRITE_RELATIONSHIPS } from '../constants/roles';

const useCalendarEvents = ({ user, profile, dateRange, rsvpPlayerId }) => {
    const toast = useToast();
    const [events, setEvents] = useState([]);
    const [rsvps, setRsvps] = useState({});
    const [rsvpCounts, setRsvpCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [resolvedPlayerId, setResolvedPlayerId] = useState(null);

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
            if (rsvpPlayerId) { if (!cancelled) setResolvedPlayerId(rsvpPlayerId); return; }
            if (!user?.id || !profile?.role) { if (!cancelled) setResolvedPlayerId(null); return; }

            if (profile.role === 'parent') {
                // Only guardian/parent relationships can WRITE RSVPs. 'fan'
                // links are read-only by design (grandparent watching games).
                const { data } = await supabase
                    .from('family_members')
                    .select('player_id')
                    .eq('user_id', user.id)
                    .in('relationship', WRITE_RELATIONSHIPS)
                    .limit(1);
                if (!cancelled) setResolvedPlayerId(data?.[0]?.player_id || null);
            } else if (profile.role === 'player') {
                const { data } = await supabase
                    .from('players')
                    .select('id')
                    .eq('user_id', user.id)
                    .maybeSingle();
                if (!cancelled) setResolvedPlayerId(data?.id || null);
            } else {
                if (!cancelled) setResolvedPlayerId(null);
            }
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

            // Fetch personal RSVPs
            if (playerId && fetchedEvents.length > 0) {
                const eventIds = fetchedEvents.map(e => e.id);
                const { data: rsvpData } = await supabase
                    .from('event_rsvps')
                    .select('event_id, status')
                    .eq('player_id', playerId)
                    .in('event_id', eventIds);

                const myRsvps = {};
                (rsvpData || []).forEach(r => { myRsvps[r.event_id] = r.status; });
                setRsvps(myRsvps);

                // Fetch RSVP counts (all RSVPs for visible events)
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

    const handleRsvp = async (eventId, status) => {
        if (!playerId) {
            if (profile?.role === 'parent') {
                toast?.warning("Can't RSVP — your account isn't linked to a player yet. Enter your guardian code.");
            } else {
                toast?.info("Tap the event to manage attendance for the whole team.");
            }
            return;
        }
        // Optimistic update
        setRsvps(prev => ({ ...prev, [eventId]: status }));
        setRsvpCounts(prev => {
            const updated = { ...prev };
            if (!updated[eventId]) updated[eventId] = { going: 0, maybe: 0, not_going: 0 };
            // Decrement old status
            const oldStatus = rsvps[eventId];
            if (oldStatus && updated[eventId][oldStatus] > 0) updated[eventId][oldStatus]--;
            // Increment new status
            updated[eventId][status]++;
            return updated;
        });

        try {
            const { error } = await supabase
                .from('event_rsvps')
                .upsert({
                    event_id: eventId,
                    player_id: playerId,
                    status,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'event_id, player_id' });

            if (error) throw error;
            const label = status === 'going' ? 'Going' : status === 'not_going' ? 'Out' : status === 'vacation' ? 'Vacation' : status;
            toast?.success(`Marked ${label}.`);
        } catch (err) {
            console.error('RSVP failed:', err);
            toast?.error(`Couldn't save RSVP: ${err.message || err}`);
            fetchEvents(); // Revert on failure
        }
    };

    return { events, rsvps, rsvpCounts, loading, handleRsvp, refetch: fetchEvents };
};

export default useCalendarEvents;
