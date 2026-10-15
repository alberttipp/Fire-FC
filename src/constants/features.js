// ============================================================================
// White-label feature modules — the sellable switches of the platform.
//
// CORE (never flagged, every club always has it): Club & Team management,
// Calendar + RSVP, Chat, notifications, Team Adoption / invites, rules,
// and the basic parent/player shells. Sponsorships and Registrations are
// also always on — the platform earns a % of money flowing through them,
// so they are deliberately not sold as modules.
//
// Storage: organizations.features jsonb, shape
//   { "preset": "basic", "modules": { "development": false, ... } }
// Semantics (see FeatureContext): a module is ON unless its key is
// EXPLICITLY false. Empty/missing features = everything on, which is what
// grandfathers every pre-flag club (Rock City, Raptors, Frank) untouched.
// ============================================================================

export const FEATURE_MODULES = [
    { key: 'development',     label: 'Development Suite',  desc: 'Training assignments, drill library, custom drills, weekly challenges, minutes/touches stats, badges, player card' },
    { key: 'evaluations',     label: 'Evaluations & IDP',  desc: 'FIFA-style eval cards, squad eval grid, individual development plans' },
    { key: 'skills_passport', label: 'Skills Passport',    desc: 'Competitive Standard rung ladders + coach verification' },
    { key: 'playbook',        label: 'The Playbook',       desc: 'AI-built per-position lessons for the team formation' },
    { key: 'live_scoring',    label: 'Live Match Day',     desc: 'Live game scoring, kickoff/final pushes, broadcasts' },
    { key: 'gallery',         label: 'Media Gallery',      desc: 'Team photo & video library' },
    { key: 'engagement',      label: 'Engagement Pack',    desc: 'Juggling competition, Golden Touch, leaderboards, Team Pulse, team goals & celebrations' },
    { key: 'scouting',        label: 'Scouting',           desc: 'League tables + opponent deep-dives' },
];

export const MODULE_KEYS = FEATURE_MODULES.map((m) => m.key);

// Named presets Albert can apply from Platform Admin. 'all' clears the module
// map (= everything on); 'basic' turns every current module off, leaving the
// core: calendar, chat, team management, RSVP, team adoption.
export const FEATURE_PRESETS = {
    all:   { label: 'All features', modules: {} },
    basic: { label: 'Basic (calendar · chat · teams · RSVP · adoption)', modules: Object.fromEntries(MODULE_KEYS.map((k) => [k, false])) },
};

// A module is enabled unless explicitly false (missing key = ON).
export const moduleEnabled = (features, key) => features?.modules?.[key] !== false;
