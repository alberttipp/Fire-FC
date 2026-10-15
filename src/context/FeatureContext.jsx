import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useBranding } from './BrandingContext';
import { moduleEnabled } from '../constants/features';

// Per-club feature flags (white-label modules). Rides the SAME resolution the
// branding layer already does: whatever club the BrandingContext resolved
// (explicit ?club URL, or the logged-in user's own org) is the club whose
// features apply. Fails OPEN — any fetch problem, unknown slug, or empty
// features jsonb means ALL features on, so a transient error can never strip
// a paying club's app, and every pre-flag club behaves exactly as today.
//
// Known gap (accepted): PIN-based virtual players on a plain URL resolve
// default branding, so they see all features. Their data is still scoped to
// their own team; this is cosmetic until player links carry ?club=.

const FeatureContext = createContext({ features: null, loaded: false });

export const useFeatures = () => useContext(FeatureContext);

// Primary gate used across the app: useFeature('development') -> boolean.
// Missing key or no features row = enabled (fail open / grandfathered).
export const useFeature = (key) => {
    const { features } = useContext(FeatureContext);
    return moduleEnabled(features, key);
};

export const FeatureProvider = ({ children }) => {
    const brand = useBranding();
    const [state, setState] = useState({ features: null, loaded: false });

    useEffect(() => {
        if (!brand?.slug) return;
        let cancelled = false;
        (async () => {
            try {
                const { data, error } = await supabase.rpc('get_org_features', { p_slug: brand.slug });
                if (cancelled) return;
                if (error || data == null) { setState({ features: null, loaded: true }); return; }
                const row = Array.isArray(data) ? data[0] : data;
                // RPC returns the jsonb directly or a row { features }.
                const features = row && typeof row === 'object' && 'features' in row ? row.features : row;
                setState({ features: features || null, loaded: true });
            } catch {
                if (!cancelled) setState({ features: null, loaded: true }); // fail open
            }
        })();
        return () => { cancelled = true; };
    }, [brand?.slug]);

    return <FeatureContext.Provider value={state}>{children}</FeatureContext.Provider>;
};
