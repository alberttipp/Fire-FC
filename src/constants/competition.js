// Single source of truth for the juggling competition's name + tagline.
// Kept month-agnostic on purpose: the old "June Juggling Competition" / "by
// June 30" copy went stale the moment June ended. The actual start/end/finals
// dates live in the DB competition config (get_juggle_leaderboard → config),
// so the UI shows a live countdown instead of a hard-coded month. Change the
// name here once and it updates everywhere.
export const COMPETITION_NAME = 'The Golden Touch Challenge';

// Juggles-in-a-row target. Evergreen — the goal is the number, not a date.
export const COMPETITION_GOAL = 100;

// Medal tiers on the road to 100-in-a-row. Highest earned tier wins the badge.
export const COMPETITION_TIERS = [
    { name: 'Bronze', value: 50, emoji: '🥉' },
    { name: 'Silver', value: 75, emoji: '🥈' },
    { name: 'Gold', value: 100, emoji: '🥇' },
];

// Highest medal tier a juggle count has reached (or null below Bronze).
export const tierForCount = (count = 0) =>
    [...COMPETITION_TIERS].reverse().find((t) => count >= t.value) || null;

// Short subtitle. No calendar month; the countdown communicates the deadline.
export const COMPETITION_TAGLINE = `🥉 50 · 🥈 75 · 🥇 100 juggles in a row!`;
