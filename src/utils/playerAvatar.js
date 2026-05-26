const slugify = (value) => {
    if (!value) return '';
    return String(value)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
};

export const getPlayerAvatarPath = ({ avatarUrl = null, firstName = '', lastName = '', displayName = '' } = {}) => {
    if (avatarUrl) return avatarUrl;

    const first = slugify(firstName);
    const last = slugify(lastName);
    const full = slugify(displayName);
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
