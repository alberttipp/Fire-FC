import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

// White-label branding. DEFAULT_BRAND = Rock City FC (rebranded from Rockford
// Fire FC, 2026-09); EVERYTHING falls back to it, so the app renders with the
// club identity whenever no other org branding is resolved (offline, unknown
// club, or a failed fetch). White-label = an org's branding row overriding
// these values — so a NEW club is config (a row + a logo), not code.
export const DEFAULT_BRAND = {
    slug: 'rock-city-fc',
    program: null,           // set when branding is resolved from a per-coach program (?p=slug)
    name: 'Rock City FC',
    shortName: 'Rock City',
    logoUrl: '/branding/rockcity-crest.png',
    primaryColor: '#3b82f6', // Tailwind brand-green (interactive/action color)
    accentColor: '#c9a24b',  // Tailwind brand-gold (Rock City gold)
    aiPersona: '',
    tagline: '',
};

const BrandingContext = createContext(DEFAULT_BRAND);
export const useBranding = () => useContext(BrandingContext);

// Per-club resolution is safe by construction: with no club in the URL (Rockford's
// normal domain), resolveSlugFromUrl() returns null and we keep DEFAULT_BRAND
// (Rockford). Only an explicit ?club=slug, /c/slug, or a club subdomain re-brands,
// and an unknown slug also falls back to Rockford — so this never changes Rockford.

// "#3b82f6" -> "59 130 246" (space-separated RGB channels) so Tailwind's
// rgb(var(--x) / <alpha-value>) keeps opacity utilities (bg-brand-green/10) working.
function hexToRgbChannels(hex) {
    if (!hex) return null;
    const m = String(hex).trim().replace('#', '');
    const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
    if (full.length !== 6) return null;
    const n = parseInt(full, 16);
    if (Number.isNaN(n)) return null;
    return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

// What's identified pre-login, in priority order: a per-coach program (?p=slug),
// then a club (?club=slug, /c/slug, or subdomain). A program re-brands to the
// coach ("Coach Will's Player Lab") while still resolving to its club's slug for
// club-scoped features. Returns {program} | {club} | null.
function resolveContextFromUrl() {
    try {
        const url = new URL(window.location.href);
        const p = url.searchParams.get('p');
        if (p) { try { sessionStorage.setItem('ff_program', p); } catch { /* ignore */ } return { program: p }; }
        const q = url.searchParams.get('club');
        if (q) { try { sessionStorage.setItem('ff_club', q); } catch { /* ignore */ } return { club: q }; }
        const path = url.pathname.match(/^\/c\/([^/]+)/);
        if (path) { try { sessionStorage.setItem('ff_club', path[1]); } catch { /* ignore */ } return { club: path[1] }; }
        // Subdomain = club slug (e.g. raptors.firefcapp.com), but NEVER treat a raw
        // IP host (127.0.0.1, 192.168.x.x) as a subdomain — its first octet would be
        // read as a bogus club slug and suppress org-aware branding on local/IP builds.
        const host = url.hostname;
        const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
        const parts = host.split('.');
        if (!isIp && parts.length > 2 && !['www', 'firefcapp', 'localhost'].includes(parts[0])) return { club: parts[0] };
        // No context in the URL — within this tab session, keep what the user
        // entered through (survives SPA nav + hard refresh; clears when the tab
        // closes). A fresh tab stays Rockford, so this is demo/link-driven only.
        try { const sp = sessionStorage.getItem('ff_program'); if (sp) return { program: sp }; } catch { /* ignore */ }
        try { const s = sessionStorage.getItem('ff_club'); if (s) return { club: s }; } catch { /* ignore */ }
    } catch { /* ignore */ }
    return null;
}

export const BrandingProvider = ({ children }) => {
    const [brand, setBrand] = useState(DEFAULT_BRAND);

    // Resolve a club's branding (only when multi-org is enabled AND a non-default
    // club is identified from the URL). Any failure keeps Rockford — never breaks.
    useEffect(() => {
        const ctx = resolveContextFromUrl();
        if (!ctx) return;                                        // no context -> Rockford default
        if (!ctx.program && ctx.club === DEFAULT_BRAND.slug) return;
        let cancelled = false;
        (async () => {
            try {
                const { data, error } = ctx.program
                    ? await supabase.rpc('get_program_branding', { p_slug: ctx.program })
                    : await supabase.rpc('get_org_branding', { p_slug: ctx.club });
                if (cancelled || error || !data) return;
                const row = Array.isArray(data) ? data[0] : data;
                if (!row) return;
                setBrand({
                    // A program keeps its club's slug for club-scoped features (sponsors, etc.).
                    slug: ctx.program ? (row.org_slug || DEFAULT_BRAND.slug) : ctx.club,
                    program: ctx.program || null,
                    name: row.display_name || DEFAULT_BRAND.name,
                    shortName: row.short_name || DEFAULT_BRAND.shortName,
                    logoUrl: row.logo_url || DEFAULT_BRAND.logoUrl,
                    primaryColor: row.primary_color || DEFAULT_BRAND.primaryColor,
                    accentColor: row.accent_color || DEFAULT_BRAND.accentColor,
                    aiPersona: row.ai_persona || '',
                    tagline: row.tagline || '',
                });
            } catch { /* keep Rockford default */ }
        })();
        return () => { cancelled = true; };
    }, []);

    // Org-aware fallback: with NO club/program in the URL, a logged-in user still
    // gets THEIR club's brand (resolved from their team/org via get_my_club_branding).
    // URL context always wins (demos / white-label links); any failure or a signed-out
    // user keeps DEFAULT_BRAND (Rock City). This is what makes a Raptors family see the
    // Raptors crest after a plain login, without needing a ?club= link.
    useEffect(() => {
        if (resolveContextFromUrl()) return;        // explicit URL context wins — skip
        let cancelled = false;
        const applyFromUser = async () => {
            try {
                const { data, error } = await supabase.rpc('get_my_club_branding');
                if (cancelled || error || !data) return;
                const row = Array.isArray(data) ? data[0] : data;
                if (!row || !row.org_slug) return;
                setBrand({
                    slug: row.org_slug,
                    program: null,
                    name: row.display_name || DEFAULT_BRAND.name,
                    shortName: row.short_name || DEFAULT_BRAND.shortName,
                    logoUrl: row.logo_url || DEFAULT_BRAND.logoUrl,
                    primaryColor: row.primary_color || DEFAULT_BRAND.primaryColor,
                    accentColor: row.accent_color || DEFAULT_BRAND.accentColor,
                    aiPersona: row.ai_persona || '',
                    tagline: row.tagline || '',
                });
            } catch { /* keep default */ }
        };
        // onAuthStateChange emits INITIAL_SESSION on subscribe, so this covers the
        // already-logged-in case too. Use two-arg form (no .catch on thenables).
        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
            if (cancelled) return;
            if (event === 'SIGNED_OUT') { setBrand(DEFAULT_BRAND); return; }
            if (session?.user) applyFromUser();
        });
        return () => { cancelled = true; try { sub?.subscription?.unsubscribe?.(); } catch { /* ignore */ } };
    }, []);

    // Apply the two swappable colors as CSS variables (RGB channels) on :root so
    // every Tailwind brand-green/brand-gold utility — including /opacity variants —
    // re-themes with ZERO component edits. index.css :root holds Rockford defaults.
    useEffect(() => {
        const root = document.documentElement;
        const p = hexToRgbChannels(brand.primaryColor);
        const a = hexToRgbChannels(brand.accentColor);
        if (p) root.style.setProperty('--brand-primary', p);
        if (a) root.style.setProperty('--brand-accent', a);
    }, [brand.primaryColor, brand.accentColor]);

    // Keep the browser tab / PWA title in sync with the resolved club.
    useEffect(() => {
        if (brand.name) { try { document.title = brand.name; } catch { /* ignore */ } }
    }, [brand.name]);

    // Per-club PWA identity: rewrite the manifest + home-screen icons so an
    // installed app wears the resolved club's crest and name (e.g. a Raptors
    // user installs "Raptors" with the Raptors crest, not Rock City). We build
    // the manifest as a Blob at runtime and swap <link rel="manifest">; iOS reads
    // apple-touch-icon directly, so we update that (and the favicon) too. All
    // best-effort — any failure leaves the static manifest/icons in place.
    useEffect(() => {
        try {
            const isDefault = !brand.slug || brand.slug === DEFAULT_BRAND.slug;
            // Default (Rock City) keeps the proven static /manifest.json + index.html
            // icons untouched — only white-label clubs need a runtime override.
            if (isDefault) return;
            const abs = (u) => { try { return new URL(u, window.location.origin).href; } catch { return u; } };
            const icon = abs(brand.logoUrl || DEFAULT_BRAND.logoUrl);
            // A non-default club gets its own installed identity (distinct id +
            // start_url) so it installs as a separate app that opens in-brand.
            const startUrl = abs(isDefault ? '/' : `/?club=${encodeURIComponent(brand.slug)}`);
            const manifest = {
                name: brand.name || DEFAULT_BRAND.name,
                short_name: brand.shortName || brand.name || DEFAULT_BRAND.shortName,
                description: 'Youth-soccer team management, training tracking, and family communication.',
                id: startUrl,
                start_url: startUrl,
                scope: abs('/'),
                display: 'standalone',
                orientation: 'portrait',
                background_color: '#0b1a33',
                theme_color: '#0b1a33',
                icons: [
                    { src: icon, sizes: '192x192', type: 'image/png', purpose: 'any' },
                    { src: icon, sizes: '512x512', type: 'image/png', purpose: 'any' },
                    { src: icon, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
            };
            const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
            const blobUrl = URL.createObjectURL(blob);
            let link = document.querySelector('link[rel="manifest"]');
            if (!link) { link = document.createElement('link'); link.rel = 'manifest'; document.head.appendChild(link); }
            if (link.dataset.ffBlob === '1') { try { URL.revokeObjectURL(link.href); } catch { /* ignore */ } }
            link.href = blobUrl;
            link.dataset.ffBlob = '1';
            // Home-screen / tab icons (iOS uses apple-touch-icon; it ignores the manifest).
            document.querySelectorAll('link[rel="apple-touch-icon"], link[rel="icon"]').forEach((l) => { l.href = icon; });
            const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
            if (appleTitle) appleTitle.content = manifest.short_name;
        } catch { /* keep static manifest/icons */ }
    }, [brand.slug, brand.name, brand.shortName, brand.logoUrl]);

    return <BrandingContext.Provider value={brand}>{children}</BrandingContext.Provider>;
};
