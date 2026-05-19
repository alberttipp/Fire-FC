// Event cover templates + backgrounds (Phase A, no AI).
//
// Each template renders a 1200×630 landscape cover (standard OG image
// + Twitter card size — perfect for chat previews). Backgrounds are
// pure CSS gradients so we don't ship any bitmap assets and the
// renders look crisp at any pixel ratio.
//
// Phase C will add an "AI background" template that uses Gemini Imagen
// to generate a unique bitmap, with the same text/crest overlay
// layered on top via the same template engine.

export const COVER_WIDTH = 1200;
export const COVER_HEIGHT = 630;

export const TEMPLATES = [
    {
        id: 'match_day',
        label: 'Match Day',
        eventTypes: ['game'],
        description: 'Big VS layout with opponent + game details',
    },
    {
        id: 'practice',
        label: 'Team Practice',
        eventTypes: ['practice'],
        description: 'Clean training-day card with date + kit',
    },
    {
        id: 'social',
        label: 'Team Hangout',
        eventTypes: ['social', 'meeting'],
        description: 'Casual style for social events + meetings',
    },
];

export const BACKGROUNDS = [
    {
        id: 'navy_lights',
        label: 'Stadium Lights',
        // Navy with bright spotlights — classic match-day vibe
        css: `
            background:
                radial-gradient(ellipse 600px 400px at 15% 0%, rgba(59,130,246,0.55), transparent 65%),
                radial-gradient(ellipse 600px 400px at 85% 0%, rgba(255,255,255,0.45), transparent 60%),
                radial-gradient(circle 250px at 50% 100%, rgba(59,130,246,0.35), transparent),
                linear-gradient(180deg, #0a1a3a 0%, #050a1f 70%, #000 100%);
        `,
    },
    {
        id: 'fire_red',
        label: 'Fire Red',
        // Brand-aligned red-to-black with light streaks
        css: `
            background:
                radial-gradient(ellipse 500px 350px at 20% 20%, rgba(255,90,90,0.5), transparent 60%),
                radial-gradient(ellipse 700px 500px at 80% 80%, rgba(220,38,38,0.45), transparent 65%),
                linear-gradient(135deg, #1a0606 0%, #3d0a0a 40%, #0d0303 100%);
        `,
    },
    {
        id: 'sunset',
        label: 'Sunset',
        // Warm gradient for social events
        css: `
            background:
                radial-gradient(ellipse 700px 500px at 30% 100%, rgba(251,146,60,0.55), transparent 70%),
                radial-gradient(ellipse 500px 400px at 80% 20%, rgba(139,92,246,0.5), transparent 65%),
                linear-gradient(180deg, #1a103a 0%, #4a1f5e 50%, #8b3a2e 100%);
        `,
    },
];

// Returns sensible defaults for an event so the designer auto-fills
// when first opened.
export function defaultTemplateForEvent(eventType) {
    if (eventType === 'game') return { template: 'match_day', bg: 'fire_red', version: 1 };
    if (eventType === 'practice') return { template: 'practice', bg: 'navy_lights', version: 1 };
    return { template: 'social', bg: 'sunset', version: 1 };
}

export function findTemplate(id) {
    return TEMPLATES.find(t => t.id === id) || TEMPLATES[0];
}
export function findBackground(id) {
    return BACKGROUNDS.find(b => b.id === id) || BACKGROUNDS[0];
}
