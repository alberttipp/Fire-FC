import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

// White-label branding. DEFAULT_BRAND = Rockford Fire FC; EVERYTHING falls back
// to it, so the app renders identically to today whenever no org branding is
// resolved (multi-org flag off, offline, unknown club, or a failed fetch).
// White-label = an org's branding row overriding these values — so a NEW club
// is config (a row + a logo), not code.
export const DEFAULT_BRAND = {
    slug: 'rockford-fire-fc',
    program: null,           // set when branding is resolved from a per-coach program (?p=slug)
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
        const parts = url.hostname.split('.');
        if (parts.length > 2 && !['www', 'firefcapp', 'localhost'].includes(parts[0])) return { club: parts[0] };
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
