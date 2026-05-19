import React from 'react';
import { format } from 'date-fns';
import { COVER_WIDTH, COVER_HEIGHT, findBackground } from './templates';

// CoverPreview ALWAYS renders at exact 1200×630 px (the OG / Twitter
// card size). The caller is responsible for visual scaling — wrap
// this in a parent with `transform: scale(N); transform-origin: top
// left; width: 1200*N; height: 630*N; overflow: hidden`.
//
// ref is forwarded onto the 1200×630 outer div so html-to-image's
// toBlob() captures it at native resolution.
const CoverPreview = React.forwardRef(({ event, choice, crestUrl = '/branding/logo.png' }, ref) => {
    const bg = findBackground(choice?.bg);
    const tpl = choice?.template || 'match_day';

    const eventDate = event?.start_time ? new Date(event.start_time) : null;
    const dateStr = eventDate ? format(eventDate, 'EEE MMM d').toUpperCase() : 'TBD';
    const timeStr = eventDate ? format(eventDate, 'h:mm a') : '';
    const location = event?.location_name || 'TBD';
    const opponent = event?.opponent_name || 'TBA';
    const kit = event?.kit_color || '';
    const kitShorts = event?.kit_shorts_color || '';
    const kitSocks  = event?.kit_socks_color  || '';
    const teamName = event?.team_name || 'ROCKFORD FIRE';

    // Custom uploaded bg overrides the gradient with a cover-fit image.
    const isCustomBg = choice?.bg === 'custom' && choice?.bgImage;
    const bgStyle = isCustomBg
        ? { background: `url(${choice.bgImage}) center/cover no-repeat` }
        : parseCss(bg.css);

    return (
        <div
            ref={ref}
            style={{
                width: COVER_WIDTH,
                height: COVER_HEIGHT,
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 16,
                fontFamily: "'Inter', system-ui, sans-serif",
                ...bgStyle,
            }}
        >
            {/* Darken overlay when bg is a user-uploaded photo so the text stays readable. */}
            {isCustomBg && (
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 100%)' }} />
            )}
            {tpl === 'match_day' && (
                <MatchDay teamName={teamName} opponent={opponent}
                    dateStr={dateStr} timeStr={timeStr} location={location} kit={kit} kitShorts={kitShorts} kitSocks={kitSocks} crestUrl={crestUrl} />
            )}
            {tpl === 'practice' && (
                <Practice teamName={teamName}
                    dateStr={dateStr} timeStr={timeStr} location={location} kit={kit} kitShorts={kitShorts} kitSocks={kitSocks} crestUrl={crestUrl} />
            )}
            {tpl === 'social' && (
                <Social title={event?.title || 'TEAM HANGOUT'}
                    dateStr={dateStr} timeStr={timeStr} location={location} crestUrl={crestUrl} />
            )}
        </div>
    );
});

CoverPreview.displayName = 'CoverPreview';

// Resolve a kit color name (red/white/navy/orange/crimson/black/grey)
// to a CSS color string. Mirrors the table in CreateEventModal.
const KIT_COLOR_MAP = {
    red: '#dc2626', white: '#f8fafc',
    navy: '#1e3a8a', orange: '#f97316', crimson: '#991b1b',
    black: '#0a0a0a', grey: '#6b7280', gray: '#6b7280',
};
function resolveKitCss(name) {
    if (!name) return null;
    return KIT_COLOR_MAP[name.toLowerCase()] || name; // assume CSS color if not in map
}

// Renders either a single shirt swatch OR a 3-piece (shirt/shorts/socks)
// strip depending on whether shorts/socks colors are present.
function KitSwatches({ kit, kitShorts, kitSocks }) {
    const shirt = resolveKitCss(kit);
    const shorts = resolveKitCss(kitShorts);
    const socks = resolveKitCss(kitSocks);
    if (!shirt) return null;
    const pieces = [shirt, shorts || shirt, socks || shirt].filter(Boolean);
    const sameAll = pieces.every(p => p === shirt);
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            👕
            {sameAll ? (
                <span style={{ display: 'inline-block', width: 18, height: 18, background: shirt, borderRadius: 4, border: '2px solid rgba(255,255,255,0.4)' }} />
            ) : (
                <span style={{ display: 'inline-flex', gap: 4 }}>
                    {pieces.map((c, i) => (
                        <span key={i} style={{ display: 'inline-block', width: 18, height: 18, background: c, borderRadius: 4, border: '2px solid rgba(255,255,255,0.4)' }} />
                    ))}
                </span>
            )}
        </span>
    );
}

function parseCss(cssString) {
    const result = {};
    cssString.trim().split(';').forEach(part => {
        const colon = part.indexOf(':');
        if (colon < 0) return;
        const k = part.slice(0, colon).trim();
        const v = part.slice(colon + 1).trim();
        if (k && v) {
            const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            result[camel] = v;
        }
    });
    return result;
}

function MatchDay({ teamName, opponent, dateStr, timeStr, location, kit, kitShorts, kitSocks, crestUrl }) {
    return (
        <div style={{ position: 'absolute', inset: 0, padding: 50, color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ letterSpacing: 8, fontSize: 18, opacity: 0.7, fontWeight: 700, marginBottom: 6 }}>OFFICIAL MATCH</div>
                <div style={{ fontSize: 68, fontWeight: 900, lineHeight: 1, letterSpacing: -1, textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>MATCH DAY</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 50 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, flex: 1 }}>
                    <img src={crestUrl} alt="" crossOrigin="anonymous" style={{ width: 140, height: 140, objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }} />
                    <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 2, textAlign: 'center', maxWidth: 280 }}>{teamName}</div>
                </div>
                <div style={{ fontSize: 90, fontWeight: 900, color: '#fff', textShadow: '0 4px 16px rgba(0,0,0,0.7)', opacity: 0.95 }}>VS</div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, flex: 1 }}>
                    <div style={{ width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '4px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, fontWeight: 900, color: 'rgba(255,255,255,0.9)' }}>
                        {opponent.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 2, textAlign: 'center', maxWidth: 280, textTransform: 'uppercase' }}>{opponent}</div>
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid rgba(255,255,255,0.25)', paddingTop: 18, fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>
                <span>📅 {dateStr} · {timeStr}</span>
                <span>📍 {location}</span>
                <KitSwatches kit={kit} kitShorts={kitShorts} kitSocks={kitSocks} />
            </div>
        </div>
    );
}

function Practice({ teamName, dateStr, timeStr, location, kit, kitShorts, kitSocks, crestUrl }) {
    return (
        <div style={{ position: 'absolute', inset: 0, padding: 60, color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <img src={crestUrl} alt="" crossOrigin="anonymous" style={{ width: 110, height: 110, objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }} />
                <div>
                    <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 3, opacity: 0.85 }}>{teamName}</div>
                    <div style={{ fontSize: 16, letterSpacing: 8, opacity: 0.6, marginTop: 4 }}>TEAM TRAINING</div>
                </div>
            </div>
            <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 130, fontWeight: 900, lineHeight: 1, letterSpacing: -3, textShadow: '0 4px 16px rgba(0,0,0,0.6)' }}>PRACTICE</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid rgba(255,255,255,0.25)', paddingTop: 18, fontSize: 24, fontWeight: 700, letterSpacing: 1 }}>
                <span>📅 {dateStr} · {timeStr}</span>
                <span>📍 {location}</span>
                <KitSwatches kit={kit} kitShorts={kitShorts} kitSocks={kitSocks} />
            </div>
        </div>
    );
}

function Social({ title, dateStr, timeStr, location, crestUrl }) {
    return (
        <div style={{ position: 'absolute', inset: 0, padding: 60, color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 28 }}>
            <img src={crestUrl} alt="" crossOrigin="anonymous" style={{ width: 90, height: 90, objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }} />
            <div style={{ fontSize: 18, letterSpacing: 10, opacity: 0.8, fontWeight: 700 }}>FIRE FC</div>
            <div style={{ fontSize: 88, fontWeight: 900, lineHeight: 1, textAlign: 'center', textShadow: '0 4px 16px rgba(0,0,0,0.5)', textTransform: 'uppercase', maxWidth: 1000 }}>{title}</div>
            <div style={{ display: 'flex', gap: 30, fontSize: 22, fontWeight: 700, opacity: 0.95, marginTop: 12 }}>
                <span>📅 {dateStr} · {timeStr}</span>
                <span>📍 {location}</span>
            </div>
        </div>
    );
}

export default CoverPreview;
