// Kit / "what to wear" presets — Albert's spec 2026-06-29. A flat list of
// single-select options for practices AND games, plus an "Other" free-text.
// The chosen LABEL is stored in events.kit_color (e.g. "Orange Shirt"); display
// components resolve a swatch color via kitSwatchColor() below.

export const KIT_PRESETS = [
    { label: 'Full Red Kit',   color: '#dc2626', stroke: '#7f1d1d' },
    { label: 'Full White Kit', color: '#f8fafc', stroke: '#475569' },
    { label: 'Orange Shirt',   color: '#f97316', stroke: '#9a3412' },
    { label: 'Gray Shirt',     color: '#9ca3af', stroke: '#4b5563' },
    { label: 'Navy Shirt',     color: '#1e3a8a', stroke: '#1e293b' },
];

export const KIT_PRESET_LABELS = KIT_PRESETS.map((k) => k.label);

const LABEL_TO_COLOR = Object.fromEntries(KIT_PRESETS.map((k) => [k.label.toLowerCase(), k.color]));
// Back-compat with older stored values (the previous Red/White + 3-piece kit).
const LEGACY = {
    red: '#dc2626', white: '#f8fafc', navy: '#1e3a8a', orange: '#f97316',
    crimson: '#991b1b', gray: '#9ca3af', grey: '#6b7280', black: '#0a0a0a',
};

// Resolve a stored kit value (preset label, legacy value, or free text) to a
// CSS color for the swatch. Falls back to the raw value so a literal CSS color
// still tints; callers should also handle a null/neutral swatch gracefully.
export function kitSwatchColor(value) {
    if (!value) return null;
    const k = String(value).trim().toLowerCase();
    return LABEL_TO_COLOR[k] || LEGACY[k] || value;
}
