// Translate Supabase auth + RPC error messages into copy a real user
// can act on. Supabase's defaults are accurate but cryptic ("Invalid login
// credentials" is technically right but reads like a system error).
//
// We match on the message string and a few common error codes. If nothing
// matches, the original message passes through (capitalized) so we never
// hide useful information.

const PATTERNS = [
    // --- sign-in failures ---
    {
        match: /invalid login credentials|invalid_credentials/i,
        text: 'Wrong email or password.',
    },
    {
        match: /email not confirmed/i,
        text: 'Check your email to confirm your account first, then try again.',
    },
    {
        match: /user not found/i,
        text: "We couldn't find an account with that email.",
    },

    // --- sign-up failures ---
    {
        match: /user already registered|already been registered/i,
        text: 'An account with that email already exists. Try logging in instead.',
    },
    {
        match: /password should be at least|password is too short/i,
        text: 'Password must be at least 6 characters.',
    },
    {
        match: /signups not allowed|signup is disabled/i,
        text: "New signups aren't open right now. Contact your club admin.",
    },

    // --- rate limits ---
    {
        match: /rate limit|too many requests/i,
        text: 'Too many attempts in a row. Wait a minute and try again.',
    },

    // --- network ---
    {
        match: /network|fetch failed|failed to fetch|networkerror/i,
        text: "Couldn't reach the server. Check your connection and try again.",
    },

    // --- recovery / reset link ---
    {
        match: /token expired|expired/i,
        text: 'That reset link has expired. Request a new one.',
    },
    {
        match: /invalid token|invalid_token/i,
        text: 'That reset link is no longer valid. Request a new one.',
    },

    // --- team join code ---
    {
        match: /team not found|invalid code|join code/i,
        text: 'That team code is invalid. Double-check with your coach.',
    },
];

export function friendlyAuthError(err) {
    if (!err) return 'Something went wrong. Try again.';
    const message = typeof err === 'string' ? err : (err.message || '');
    if (!message) return 'Something went wrong. Try again.';

    for (const { match, text } of PATTERNS) {
        if (match.test(message)) return text;
    }

    // Fall back to the raw message but make sure it starts with a capital
    // and ends in punctuation so it reads cleanly inside a toast.
    const trimmed = message.trim().replace(/[.!?]+$/, '');
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1) + '.';
}
