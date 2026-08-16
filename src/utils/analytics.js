// First-party usage analytics. Writes to public.app_events (see
// supabase/migrations/20260816_app_events.sql).
//
// Deliberately tiny and fire-and-forget: analytics must never block a render,
// never throw into the app, and never keep the user waiting. Every failure is
// swallowed — a dropped event is always preferable to a broken screen.
//
// The row's user_id is filled server-side from auth.uid() (column default +
// RLS check), so nothing here can attribute an event to the wrong person.

import { supabase } from '../supabaseClient';

const VISIT_KEY = 'ff_visit_id';

// One visit = one browsing session (sessionStorage clears when the tab closes).
// Groups events so you can ask "how long were they in the app" without going
// near auth.sessions.
export const getVisitId = () => {
    try {
        let id = sessionStorage.getItem(VISIT_KEY);
        if (!id) {
            id = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
            sessionStorage.setItem(VISIT_KEY, id);
        }
        return id;
    } catch {
        return null; // private mode / storage disabled — events still record, just unbucketed
    }
};

// React re-renders (and StrictMode's double-invoke in dev) can fire the same
// effect twice in a tick. Drop an identical event inside a short window so the
// table doesn't fill with duplicates.
let lastKey = null;
let lastAt = 0;
const DEDUPE_MS = 800;

/**
 * Record one event. Never throws, never awaits anything the caller cares about.
 *
 * @param {string} event   e.g. 'screen_view', 'page_view', 'open_overview'
 * @param {object} [props] arbitrary JSON detail (screen name, target, etc.)
 * @param {object} [opts]
 * @param {string|null} [opts.teamId] team context, when known
 * @param {string|null} [opts.path]   route path, when relevant
 */
export const trackEvent = (event, props = {}, { teamId = null, path = null } = {}) => {
    if (!event) return;

    const key = `${event}|${path || ''}|${JSON.stringify(props)}`;
    const now = Date.now();
    if (key === lastKey && now - lastAt < DEDUPE_MS) return;
    lastKey = key;
    lastAt = now;

    // Only signed-in users have a user_id to attribute the event to; anonymous
    // hits would fail the RLS check anyway, so skip them rather than spam the
    // network on /login.
    supabase.auth.getSession().then(({ data }) => {
        if (!data?.session) return;
        return supabase.from('app_events').insert({
            visit_id: getVisitId(),
            team_id: teamId || null,
            event,
            path: path || (typeof window !== 'undefined' ? window.location.pathname : null),
            props,
        });
    }).then(
        () => {},
        () => {} // analytics must never surface an error to the user
    );
};

/**
 * Record an in-app screen change. Most of this app lives under a handful of
 * routes and switches views with local state, so route changes alone say very
 * little — this is the one that tells you which screens someone actually opened.
 */
export const trackScreen = (screen, { teamId = null, role = null } = {}) => {
    if (!screen) return;
    trackEvent('screen_view', role ? { screen, role } : { screen }, { teamId });
};
