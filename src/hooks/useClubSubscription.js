import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

// Resolves the current staff user's club (org) and whether its platform
// subscription is active (Flow A). Used to gate the manager app behind a
// Subscribe screen for clubs that haven't subscribed.
//
// Fails OPEN: if we can't resolve the org or the check errors, we treat the club
// as active so a transient hiccup never locks an existing club out of their app.
// Comped clubs (Rockford, the Raptors demo) always resolve active.
export function useClubSubscription(profile) {
    const [state, setState] = useState({ loading: true, orgId: null, active: true });

    const check = useCallback(async () => {
        const teamId = profile?.team_id;
        if (!teamId) { setState({ loading: false, orgId: null, active: true }); return; }
        try {
            const { data: team } = await supabase.from('teams').select('org_id').eq('id', teamId).single();
            const orgId = team?.org_id;
            if (!orgId) { setState({ loading: false, orgId: null, active: true }); return; }
            const { data: active, error } = await supabase.rpc('org_is_active', { p_org_id: orgId });
            setState({ loading: false, orgId, active: error ? true : !!active });
        } catch {
            setState({ loading: false, orgId: null, active: true }); // fail open
        }
    }, [profile?.team_id]);

    useEffect(() => { let alive = true; check().catch(() => { if (alive) setState({ loading: false, orgId: null, active: true }); }); return () => { alive = false; }; }, [check]);

    return { ...state, reload: check };
}
