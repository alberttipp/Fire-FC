// Co-parent "invite link" plumbing.
//
// A linked parent (or the coach) shares a deep link like
//   https://firefcapp.com/login?join=ABC123
// The second parent taps it, signs up, and is linked to the player
// automatically — no code to type, no roster to hunt, no wrong-kid risk.
//
// The challenge is carrying the code across signup AND the email-confirm
// round-trip (parent leaves the app to click the confirmation email, then
// returns). We solve that by stashing the code in localStorage at boot and
// consuming it once the family-onboarding flow runs.
const KEY = 'pending_guardian_code';
const CODE_RX = /^[A-Z0-9]{6}$/;

// Run once at app boot, BEFORE routing redirects strip the query string.
// Pulls ?join= (also accepts ?join_code= / ?code=) out of the URL, stashes
// the code, and cleans the address bar so it isn't re-processed or shared.
export const captureInviteFromUrl = () => {
    try {
        const params = new URLSearchParams(window.location.search);
        const raw = params.get('join') || params.get('join_code') || params.get('code');
        if (!raw) return;
        const code = raw.toUpperCase().trim();
        if (!CODE_RX.test(code)) return;

        localStorage.setItem(KEY, code);

        params.delete('join');
        params.delete('join_code');
        params.delete('code');
        const url = new URL(window.location.href);
        url.search = params.toString();
        window.history.replaceState({}, '', url.toString());
    } catch (_) {
        /* non-fatal — fall back to the normal pick-your-child flow */
    }
};

export const getPendingInvite = () => {
    try {
        return localStorage.getItem(KEY) || null;
    } catch (_) {
        return null;
    }
};

export const clearPendingInvite = () => {
    try {
        localStorage.removeItem(KEY);
    } catch (_) {
        /* ignore */
    }
};

// Build the shareable invite URL for a given guardian code.
export const buildInviteUrl = (code) => {
    if (!code) return '';
    const origin = (typeof window !== 'undefined' && window.location?.origin)
        ? window.location.origin
        : 'https://firefcapp.com';
    return `${origin}/login?join=${encodeURIComponent(code)}`;
};
