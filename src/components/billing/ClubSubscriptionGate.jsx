import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { isStaff as isStaffRole } from '../../constants/roles';
import { useClubSubscription } from '../../hooks/useClubSubscription';
import SubscribeGate from './SubscribeGate';

// Wraps the manager app. Staff of a club with no active platform subscription see
// the SubscribeGate; everyone else passes through untouched. Non-staff (parents/
// players who deep-link here) are NOT gated — Dashboard redirects them itself.
export default function ClubSubscriptionGate({ children }) {
    const { profile } = useAuth();
    const isStaff = isStaffRole(profile?.role);
    const { loading, active, orgId, reload } = useClubSubscription(profile);

    // After returning from Stripe (?billing=success) the webhook is async — poll a
    // few times so the app unlocks on its own without a manual refresh.
    const polls = useRef(0);
    useEffect(() => {
        const success = new URLSearchParams(window.location.search).get('billing') === 'success';
        if (!success || loading || active || polls.current >= 5) return;
        const t = setTimeout(() => { polls.current += 1; reload(); }, 2000);
        return () => clearTimeout(t);
    }, [loading, active, reload]);

    if (!isStaff) return children;
    if (loading) {
        return <div className="min-h-screen bg-brand-dark flex items-center justify-center text-gray-400">Loading…</div>;
    }
    if (!active) return <SubscribeGate orgId={orgId} onRefresh={reload} />;
    return children;
}
