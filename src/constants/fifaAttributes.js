// ============================================================================
// FIFA-style player evaluation card — single source of truth.
//
// The evaluation mirrors an EA FC player card so it engages 10–11 yos:
//   • 6 face attributes drive the radar + OVR.
//   • Each attribute expands into authentic FIFA sub-stats.
//   • A face score = average of its ACTIVE sub-stats for the current mode,
//     OR is scored directly when it has no active sub-stats (e.g. youth GK).
//
// Two depth MODES:
//   • 'youth' (default) — trimmed for rec/youth soccer (~10–11). Drops the
//     advanced sub-stats that don't apply at that age (sliding tackle, volleys,
//     curve, FK accuracy, etc.).
//   • 'pro' — the full FIFA sub-stat set.
// Mode is set per-team (teams.eval_mode) and can be overridden per-player
// (players.eval_mode, null = inherit team). Private-training clients are teams
// too, so the same setting covers them.
//
// Two CARD TYPES:
//   • 'outfield' — PAC / SHO / PAS / DRI / DEF / PHY
//   • 'gk'       — DIV / HAN / KIC / REF / SPD / POS (goalkeepers)
//
// `drillCategories` ties each attribute back to the drill library categories
// so a weak score links straight to drills that train it (score → train →
// re-score loop). Keep these strings in sync with the `drills.category` values.
// ============================================================================

export const EVAL_MODES = ['youth', 'pro'];
export const DEFAULT_EVAL_MODE = 'youth';
export const DEFAULT_SUBSTAT = 50; // neutral starting value for an unscored slider

// --- Outfield card -----------------------------------------------------------
// sub: { key, label, youth }  — youth:true keeps the sub-stat in youth mode.
export const OUTFIELD_ATTRIBUTES = [
    {
        key: 'PAC', label: 'Pace', color: '#22d3ee',
        drillCategories: ['Speed & Agility', 'Conditioning'],
        subs: [
            { key: 'acceleration', label: 'Acceleration', youth: true },
            { key: 'sprint_speed', label: 'Sprint Speed', youth: true },
        ],
    },
    {
        key: 'SHO', label: 'Shooting', color: '#f87171',
        drillCategories: ['Finishing & Shooting'],
        subs: [
            { key: 'positioning', label: 'Att. Positioning', youth: true },
            { key: 'finishing', label: 'Finishing', youth: true },
            { key: 'shot_power', label: 'Shot Power', youth: true },
            { key: 'long_shots', label: 'Long Shots', youth: false },
            { key: 'volleys', label: 'Volleys', youth: false },
            { key: 'penalties', label: 'Penalties', youth: true },
        ],
    },
    {
        key: 'PAS', label: 'Passing', color: '#34d399',
        drillCategories: ['Passing & Receiving'],
        subs: [
            { key: 'vision', label: 'Vision', youth: true },
            { key: 'crossing', label: 'Crossing', youth: true },
            { key: 'fk_accuracy', label: 'FK Accuracy', youth: false },
            { key: 'short_passing', label: 'Short Passing', youth: true },
            { key: 'long_passing', label: 'Long Passing', youth: true },
            { key: 'curve', label: 'Curve', youth: false },
        ],
    },
    {
        key: 'DRI', label: 'Dribbling', color: '#60a5fa',
        drillCategories: ['Ball Mastery (Solo)', 'Dribbling & 1v1', 'First Touch'],
        subs: [
            { key: 'agility', label: 'Agility', youth: true },
            { key: 'balance', label: 'Balance', youth: true },
            { key: 'reactions', label: 'Reactions', youth: true },
            { key: 'ball_control', label: 'Ball Control', youth: true },
            { key: 'dribbling', label: 'Dribbling', youth: true },
            { key: 'composure', label: 'Composure', youth: false },
        ],
    },
    {
        key: 'DEF', label: 'Defending', color: '#fbbf24',
        drillCategories: ['Defending', 'Tactical / Game Intelligence'],
        subs: [
            { key: 'interceptions', label: 'Interceptions', youth: true },
            { key: 'heading', label: 'Heading', youth: true },
            { key: 'def_awareness', label: 'Def. Awareness', youth: true },
            { key: 'standing_tackle', label: 'Standing Tackle', youth: true },
            { key: 'sliding_tackle', label: 'Sliding Tackle', youth: false },
        ],
    },
    {
        key: 'PHY', label: 'Physical', color: '#a78bfa',
        drillCategories: ['Conditioning'],
        subs: [
            { key: 'jumping', label: 'Jumping', youth: true },
            { key: 'stamina', label: 'Stamina', youth: true },
            { key: 'strength', label: 'Strength', youth: true },
            { key: 'aggression', label: 'Aggression', youth: false },
        ],
    },
];

// --- Goalkeeper card ---------------------------------------------------------
// Youth keepers score the 6 faces directly (no active sub-stats); pro keepers
// expand each into two sub-stats. So every GK sub is youth:false by design.
export const GK_ATTRIBUTES = [
    {
        key: 'DIV', label: 'Diving', color: '#22d3ee',
        drillCategories: ['Goalkeeper'],
        subs: [
            { key: 'aerial_reach', label: 'Aerial Reach', youth: false },
            { key: 'low_dive', label: 'Low Dive', youth: false },
        ],
    },
    {
        key: 'HAN', label: 'Handling', color: '#34d399',
        drillCategories: ['Goalkeeper'],
        subs: [
            { key: 'catching', label: 'Catching', youth: false },
            { key: 'punching', label: 'Punching', youth: false },
        ],
    },
    {
        key: 'KIC', label: 'Kicking', color: '#fbbf24',
        drillCategories: ['Goalkeeper', 'Passing & Receiving'],
        subs: [
            { key: 'goal_kicks', label: 'Goal Kicks', youth: false },
            { key: 'distribution', label: 'Distribution', youth: false },
        ],
    },
    {
        key: 'REF', label: 'Reflexes', color: '#f87171',
        drillCategories: ['Goalkeeper'],
        subs: [
            { key: 'shot_stopping', label: 'Shot Stopping', youth: false },
            { key: 'reaction_saves', label: 'Reaction Saves', youth: false },
        ],
    },
    {
        key: 'SPD', label: 'Speed', color: '#60a5fa',
        drillCategories: ['Speed & Agility'],
        subs: [
            { key: 'gk_acceleration', label: 'Acceleration', youth: false },
            { key: 'gk_sprint_speed', label: 'Sprint Speed', youth: false },
        ],
    },
    {
        key: 'POS', label: 'Positioning', color: '#a78bfa',
        drillCategories: ['Goalkeeper'],
        subs: [
            { key: 'angles', label: 'Angles', youth: false },
            { key: 'command_of_area', label: 'Command of Area', youth: false },
        ],
    },
];

export const GK_POSITION = 'Goalkeeper';

// --- Helpers -----------------------------------------------------------------

export function getCard(cardType) {
    return cardType === 'gk' ? GK_ATTRIBUTES : OUTFIELD_ATTRIBUTES;
}

export function isGkCard(cardType) {
    return cardType === 'gk';
}

// Sub-stats visible for an attribute in the given mode. In youth mode only
// `youth:true` subs are active; in pro mode all are.
export function activeSubs(attr, mode) {
    return mode === 'pro' ? attr.subs : attr.subs.filter((s) => s.youth);
}

// True when the attribute has no active sub-stats for this mode and therefore
// must be scored directly (e.g. youth goalkeeper faces).
export function isFaceScoredDirectly(attr, mode) {
    return activeSubs(attr, mode).length === 0;
}

// Compute an attribute's face value from its sub-stat values for the mode.
// Returns null when the face is scored directly (caller reads the face value).
export function attributeFace(attr, mode, subValues = {}) {
    const subs = activeSubs(attr, mode);
    if (subs.length === 0) return null;
    const total = subs.reduce((sum, s) => sum + (Number(subValues[s.key]) || DEFAULT_SUBSTAT), 0);
    return Math.round(total / subs.length);
}

// Overall rating = average of the 6 face values. Mirrors the existing OVR.
export function overallRating(faceValues = []) {
    const vals = faceValues.filter((v) => Number.isFinite(v));
    if (vals.length === 0) return DEFAULT_SUBSTAT;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// Resolve the effective mode for a player: player override wins, else team
// default, else the global default.
export function resolveEvalMode(playerMode, teamMode) {
    if (EVAL_MODES.includes(playerMode)) return playerMode;
    if (EVAL_MODES.includes(teamMode)) return teamMode;
    return DEFAULT_EVAL_MODE;
}
