const slugify = (value) => {
    if (!value) return '';
    return String(value)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
};

const OVERRIDES = {
    declan: 'declan.png',
    isaac: 'isaac.png',
    jameson: 'jameson_mccarthy_cutout.png',
    jaemson: 'jameson_mccarthy_cutout.png',
    jameson_mccarthy: 'jameson_mccarthy_cutout.png',
    jaemson_mccarthy: 'jameson_mccarthy_cutout.png',
    novie: 'novie.png',
    tate: 'tate.png',
    luca: 'luca.png',
    santiago_a: 'santiago_a.png',
};

export const getPlayerAvatarPath = ({ avatarUrl = null, firstName = '', lastName = '', displayName = '' } = {}) => {
    const first = slugify(firstName);
    const last = slugify(lastName);
    const full = slugify(displayName);

    const overrideKeys = [full, first && last ? `${first}_${last}` : '', first].filter(Boolean);
    for (const key of overrideKeys) {
        if (OVERRIDES[key]) {
            return `/players/${OVERRIDES[key]}`;
        }
    }

    if (avatarUrl) return avatarUrl;

    const candidates = [];

    if (first) {
        candidates.push(`/players/${first}.jpg`);
        candidates.push(`/players/${first}.png`);
    }

    if (first && last) {
        candidates.push(`/players/${first}_${last}.jpg`);
        candidates.push(`/players/${first}_${last}.png`);
    }

    if (full && full !== first) {
        candidates.push(`/players/${full}.jpg`);
        candidates.push(`/players/${full}.png`);
    }

    candidates.push('/players/bo_official.png');
    candidates.push('/players/roster/bo_official.png');

    return candidates[0];
};

export default getPlayerAvatarPath;
