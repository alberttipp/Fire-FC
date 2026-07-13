import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

// White-label branding. DEFAULT_BRAND = Rockford Fire FC; EVERYTHING falls back
// to it, so the app renders identically to today whenever no org branding is
// resolved (multi-org flag off, offline, unknown club, or a failed fetch).
// White-label = an org's branding row overriding these values — so a NEW club
// is config (a row + a logo), not code.
export const DEFAULT_BRAND = {
    slug: 'rockford-fire-fc',
    name: 'Rockford Fire FC',
    shortName: 'Fire',
    logoUrl: '/branding/logo.png',
    primaryColor: '#3b82f6', // Tailwind brand-green (channels default in index.css / tailwind.config)
    accentColor: '#d4af37',  // Tailwind brand-gold
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

// Where a club is identified pre-login: ?club=slug, /c/slug, or a subdomain.
function resolveSlugFromUrl() {
    try {
        const url = new URL(window.location.href);
        const q = url.searchParams.get('club');
        if (q) { try { sessionStorage.setItem('ff_club', q); } catch { /* ignore */ } return q; }
        const path = url.pathname.match(/^\/c\/([^/]+)/);
        if (path) { try { sessionStorage.setItem('ff_club', path[1]); } catch { /* ignore */ } return path[1]; }
        const parts = url.hostname.split('.');
        if (parts.length > 2 && !['www', 'firefcapp', 'localhost'].includes(parts[0])) return parts[0];
        // No club in the URL — within this tab session, keep the club the user
        // entered through (survives SPA nav + hard refresh; clears when the tab
        // closes). A fresh tab with no ?club stays Rockford, so this is demo-only.
        try { const s = sessionStorage.getItem('ff_club'); if (s) return s; } catch { /* ignore */ }
    } catch { /* ignore */ }
    return null;
}

export const BrandingProvider = ({ children }) => {
    const [brand, setBrand] = useState(DEFAULT_BRAND);

    // Resolve a club's branding (only when multi-org is enabled AND a non-default
    // club is identified from the URL). Any failure keeps Rockford — never breaks.
    useEffect(() => {
        const slug = resolveSlugFromUrl();
        if (!slug || slug === DEFAULT_BRAND.slug) return;
        let cancelled = false;
        (async () => {
            try {
                const { data, error } = await supabase.rpc('get_org_branding', { p_slug: slug });
                if (cancelled || error || !data) return;
                const row = Array.isArray(data) ? data[0] : data;
                if (!row) return;
                setBrand({
                    slug,
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

    return <BrandingContext.Provider value={brand}>{children}</BrandingContext.Provider>;
};
