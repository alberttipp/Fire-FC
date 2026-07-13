import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useBranding } from './BrandingContext';

// Loads the current club's active sponsors (by branding slug, so it works
// pre-login too) grouped by tier. Empty for any club without sponsors — so it's
// a no-op for Rockford today until a sponsor row exists.
const EMPTY = { title: [], premier: [], community: [] };
const SponsorContext = createContext({ byTier: EMPTY, all: [], loading: true, reload: () => {} });
export const useSponsors = () => useContext(SponsorContext);

export const SponsorProvider = ({ children }) => {
    const { slug } = useBranding();
    const [all, setAll] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!slug) { setAll([]); setLoading(false); return; }
        try {
            const { data, error } = await supabase.rpc('get_org_sponsors', { p_slug: slug });
            if (!error && Array.isArray(data)) setAll(data);
        } catch { /* keep empty */ }
        finally { setLoading(false); }
    }, [slug]);

    useEffect(() => { load(); }, [load]);

    const byTier = useMemo(() => {
        const g = { title: [], premier: [], community: [] };
        for (const s of all) if (g[s.tier]) g[s.tier].push(s);
        return g;
    }, [all]);

    return (
        <SponsorContext.Provider value={{ byTier, all, loading, reload: load }}>
            {children}
        </SponsorContext.Provider>
    );
};
