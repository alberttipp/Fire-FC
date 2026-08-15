// Two coordinate sets per slot, per formation: where each position sits when WE
// have the ball (spread out, high) vs when THEY have it (compact block, dropped
// and narrow). The Playbook board tweens dots between the two — that animation
// IS the shape lesson. Percentages match the pitch (y=92 own goal, y=8 theirs),
// same system as coach-hq/lineup/formations.js.
//
// Keyed by formation id + slot id so it extends to any formation (white-label).
export const PLAYBOOK_SHAPES = {
    '4-3-1': {
        GK:  { attack: [50, 92], defend: [50, 90] },
        LB:  { attack: [15, 74], defend: [24, 70] },
        LCB: { attack: [38, 78], defend: [40, 74] },
        RCB: { attack: [62, 78], defend: [60, 74] },
        RB:  { attack: [85, 74], defend: [76, 70] },
        LCM: { attack: [28, 50], defend: [34, 58] },
        CM:  { attack: [50, 52], defend: [50, 60] },
        RCM: { attack: [72, 50], defend: [66, 58] },
        ST:  { attack: [50, 24], defend: [50, 44] },
    },
};

// Slot render order (top of the list = drawn first). Purely cosmetic.
export const PLAYBOOK_SLOT_ORDER = {
    '4-3-1': ['GK', 'LB', 'LCB', 'RCB', 'RB', 'LCM', 'CM', 'RCM', 'ST'],
};

// Map a player's broad position (players.position — see PlayerEvaluationModal's
// POSITIONS list) to their most likely slot in a formation, so we can highlight
// "YOU" on the board. Best-effort: unknown/ambiguous returns null (they just
// explore the whole board). Values are lowercased for matching.
const POSITION_TO_SLOT = {
    '4-3-1': {
        'goalkeeper': 'GK',
        'center back': 'LCB',
        'fullback': 'LB',
        'defensive midfielder': 'CM',
        'center midfielder': 'CM',
        'attacking midfielder': 'CM',
        'winger': 'LCM',
        'striker': 'ST',
    },
};

export function slotForPosition(formation, position) {
    if (!position) return null;
    const map = POSITION_TO_SLOT[formation];
    if (!map) return null;
    return map[String(position).trim().toLowerCase()] || null;
}
