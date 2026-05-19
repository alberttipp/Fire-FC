// Categories + channels for the notifications system. Single source of
// truth across UI + DB. Categories enqueued by triggers must match
// rows here; new categories added on either side without updating the
// other will show up as "Unknown" in the settings UI.
//
// Mirrors the pattern in src/constants/roles.js.

export const NOTIFICATION_CATEGORIES = [
    { id: 'chat_team',       label: 'Team Chat',           description: 'New messages in the team channel' },
    { id: 'chat_dm',         label: 'Direct Messages',     description: 'New messages in private chats' },
    { id: 'event_created',   label: 'New Events',          description: 'Practices, games, social events added to the schedule' },
    { id: 'rsvp_changed',    label: 'RSVP Changes',        description: 'Coach/manager only — pings when a parent RSVPs' },
    { id: 'idp_assigned',    label: 'IDP & Homework',      description: 'Drills, IDP blocks, weekly homework' },
    { id: 'badge_earned',    label: 'Badges',              description: 'When a kid unlocks a badge or milestone' },
    { id: 'practice_credit', label: 'Practice Credit',     description: 'Auto-credited team practice attendance' },
];

export const NOTIFICATION_CHANNELS = [
    { id: 'in_app', label: 'In-App',     description: 'Bell badge inside Fire FC' },
    { id: 'push',   label: 'Phone Push', description: 'Phone banner when app is closed' },
    // 'email' reserved for v2
];

export const SNOOZE_OPTIONS = [
    { label: '30 min', minutes: 30 },
    { label: '1 hour', minutes: 60 },
    { label: '4 hours', minutes: 240 },
    { label: '24 hours', minutes: 60 * 24 },
];

// Sensible default — in_app always on, push on by default for chat &
// events, off for low-urgency categories. UI shows missing rows as ON
// (matches DB sparse-table behaviour), so this is mostly aspirational
// for future "reset to defaults" actions.
export const DEFAULT_PREFS = {};
