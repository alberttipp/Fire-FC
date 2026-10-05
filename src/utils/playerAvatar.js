// Resolve a player's avatar image.
//
// RULE: an uploaded/cutout photo (avatarUrl) ALWAYS wins. We deliberately do NOT
// guess a file by the player's name anymore — that old behavior (a hardcoded
// override map + `/players/<firstname>.png` guessing) cross-assigned one kid's
// face to another kid with the same first name, and even overrode real uploaded
// photos. For a player with no photo yet we return a neutral silhouette so the
// card is clean (and parents get nudged to add a photo).
const DEFAULT_AVATAR = '/players/_default_avatar.png';

export const getPlayerAvatarPath = ({ avatarUrl = null } = {}) => {
    const url = (avatarUrl || '').trim();
    return url || DEFAULT_AVATAR;
};

export default getPlayerAvatarPath;
