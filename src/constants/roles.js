// Centralized role + relationship constants.
//
// Why this file exists: as of 2026-05-18 the codebase had 7+ ad-hoc role
// checks like `role === 'coach' || role === 'manager'`, some with 'admin',
// some with 'director', some without head_coach/assistant_coach/team_manager.
// A future Assistant Coach role would silently lose access in many places.
// One source of truth fixes that and future-proofs against new roles being
// added to team_memberships.

// Anyone on a team in a staff capacity. Used to gate: Create Event,
// attendance override controls, hiding personal RSVP buttons, etc.
export const STAFF_ROLES = new Set([
    'coach',
    'manager',
    'head_coach',
    'assistant_coach',
    'team_manager',
    'director',
    'admin',
]);

// Manager-only (financial, tryouts, etc.) is intentionally narrower.
export const MANAGER_ROLES = new Set(['manager', 'team_manager', 'director', 'admin']);

// family_members.relationship values:
//   'guardian' = full write access (RSVPs, edits, etc.)
//   'fan'      = read-only (grandparent watching games, etc.)
//   'parent'   = legacy; treated as guardian for back-compat
//
// WRITE_RELATIONSHIPS gates: can this family link RSVP for the kid?
// READ_RELATIONSHIPS gates: can this family link SEE the kid's events/dashboard?
export const WRITE_RELATIONSHIPS = ['guardian', 'parent'];
export const READ_RELATIONSHIPS = ['guardian', 'parent', 'fan'];

// Canonical RSVP status values matching the event_rsvps_status_check CHECK.
// 'maybe' and 'pending' are legacy and not produced by current UI but kept
// in the CHECK for back-compat. 'attended' reserved for post-event actual
// attendance tracking.
export const RSVP_STATUSES = ['going', 'not_going', 'vacation', 'attended', 'maybe', 'pending'];

// Convenience predicates.
export const isStaff = (role) => STAFF_ROLES.has(role);
export const isManager = (role) => MANAGER_ROLES.has(role);
export const canWriteRsvpAs = (relationship) => WRITE_RELATIONSHIPS.includes(relationship);
