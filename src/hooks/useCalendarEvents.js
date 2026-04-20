import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const useCalendarEvents = ({ user, profile, dateRange, rsvpPlayerId }) => {
    const [events, setEvents] = useState([]);
    const [rsvps, setRsvps] = useState({});
    const [rsvpCounts, setRsvpCounts] = useState({});
    const [loading, setLoading] = useState(true);

    const playerId = rsvpPlayerId || user?.id;

    const fetchEvents = useCallback(async () => {
        if (!user) return;
        setLoading(true);

        try {
            // Resolve team IDs based on role
            let teamIds = [];
            const userRole = profile?.role;

            if (userRole === 'parent') {
                const { data: links } = await supabase
                    .from('family_members')
                    .select('player_id')
                    .eq('user_id', user.id)
                    .in('relationship', ['guardian', 'fan']);
                if (links?.length > 0) {
                    const playerIds = links.map(l => l.player_id);
                    const { data: players } = await supabase.from('players').select('team_id').in('id', playerIds);
                    if (players) teamIds = [...new Set(players.map(p => p.team_id).filter(Boolean))];
                }
            } else if (userRole === 'manager' || userRole === 'coach') {
                const { data: teams } = await supabase.from('teams').select('id');
                if (teams) teamIds = teams.map(t => t.id);
            } else {
                if (profile?.team_id) {
                    teamIds = [profile.team_id];
                } else if (user) {
                    const { data: team } = await supabase.from('teams').select('id').eq('coach_id', user.id).single();
                    if (team) teamIds = [team.id];
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
        } catch (err) {
            console.error('RSVP failed:', err);
            fetchEvents(); // Revert on failure
        }
    };

    return { events, rsvps, rsvpCounts, loading, handleRsvp, refetch: fetchEvents };
};

export default useCalendarEvents;
