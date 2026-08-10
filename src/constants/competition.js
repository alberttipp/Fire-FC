// Single source of truth for the juggling competition's name + tagline.
// Kept month-agnostic on purpose: the old "June Juggling Competition" / "by
// June 30" copy went stale the moment June ended. The actual start/end/finals
// dates live in the DB competition config (get_juggle_leaderboard → config),
// so the UI shows a live countdown instead of a hard-coded month. Change the
// name here once and it updates everywhere.
export const COMPETITION_NAME = 'The Golden Touch Challenge';

// Juggles-in-a-row target. Evergreen — the goal is the number, not a date.
export const COMPETITION_GOAL = 100;

// Short subtitle. No calendar month; the countdown communicates the deadline.
export const COMPETITION_TAGLINE = `Get to ${COMPETITION_GOAL} juggles in a row!`;
