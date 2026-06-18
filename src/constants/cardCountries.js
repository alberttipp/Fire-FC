// Country list for the player-card flag picker. ISO 3166-1 alpha-2 (lowercase),
// plus a few UK home-nation codes (flagcdn supports gb-eng / gb-sct / gb-wls).
// Flags render from flagcdn.com (free, no key) — same remote-image pattern the
// app already uses for avatars. `featured` floats World-Cup nations + the
// heritage countries common in our community to the top of the picker.
export const flagUrl = (code, w = 40) => `https://flagcdn.com/w${w}/${(code || 'us').toLowerCase()}.png`;

export const DEFAULT_CARD_COUNTRY = 'us';

export const CARD_COUNTRIES = [
    // --- Featured: 2026 World Cup hosts + powerhouses + local heritage ---
    { code: 'us', name: 'United States', featured: true },
    { code: 'mx', name: 'Mexico', featured: true },
    { code: 'ca', name: 'Canada', featured: true },
    { code: 'ar', name: 'Argentina', featured: true },
    { code: 'br', name: 'Brazil', featured: true },
    { code: 'pt', name: 'Portugal', featured: true },
    { code: 'es', name: 'Spain', featured: true },
    { code: 'fr', name: 'France', featured: true },
    { code: 'gb-eng', name: 'England', featured: true },
    { code: 'de', name: 'Germany', featured: true },
    { code: 'nl', name: 'Netherlands', featured: true },
    { code: 'it', name: 'Italy', featured: true },
    { code: 'co', name: 'Colombia', featured: true },
    { code: 'hn', name: 'Honduras', featured: true },
    { code: 'gt', name: 'Guatemala', featured: true },
    { code: 'sv', name: 'El Salvador', featured: true },
    { code: 'ec', name: 'Ecuador', featured: true },
    { code: 'pe', name: 'Peru', featured: true },
    { code: 'ng', name: 'Nigeria', featured: true },
    { code: 'pr', name: 'Puerto Rico', featured: true },
    // --- Rest, alphabetical-ish ---
    { code: 'au', name: 'Australia' },
    { code: 'at', name: 'Austria' },
    { code: 'be', name: 'Belgium' },
    { code: 'bo', name: 'Bolivia' },
    { code: 'cl', name: 'Chile' },
    { code: 'cn', name: 'China' },
    { code: 'cr', name: 'Costa Rica' },
    { code: 'hr', name: 'Croatia' },
    { code: 'cu', name: 'Cuba' },
    { code: 'cz', name: 'Czechia' },
    { code: 'dk', name: 'Denmark' },
    { code: 'do', name: 'Dominican Republic' },
    { code: 'eg', name: 'Egypt' },
    { code: 'gh', name: 'Ghana' },
    { code: 'gr', name: 'Greece' },
    { code: 'in', name: 'India' },
    { code: 'ie', name: 'Ireland' },
    { code: 'jm', name: 'Jamaica' },
    { code: 'jp', name: 'Japan' },
    { code: 'ke', name: 'Kenya' },
    { code: 'kr', name: 'South Korea' },
    { code: 'lb', name: 'Lebanon' },
    { code: 'ma', name: 'Morocco' },
    { code: 'ni', name: 'Nicaragua' },
    { code: 'no', name: 'Norway' },
    { code: 'pa', name: 'Panama' },
    { code: 'py', name: 'Paraguay' },
    { code: 'ph', name: 'Philippines' },
    { code: 'pl', name: 'Poland' },
    { code: 'gb-sct', name: 'Scotland' },
    { code: 'rs', name: 'Serbia' },
    { code: 'se', name: 'Sweden' },
    { code: 'ch', name: 'Switzerland' },
    { code: 'tr', name: 'Türkiye' },
    { code: 'ua', name: 'Ukraine' },
    { code: 'uy', name: 'Uruguay' },
    { code: 've', name: 'Venezuela' },
    { code: 'vn', name: 'Vietnam' },
    { code: 'gb-wls', name: 'Wales' },
];

export const countryName = (code) =>
    CARD_COUNTRIES.find(c => c.code === (code || '').toLowerCase())?.name || 'United States';
