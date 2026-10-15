import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useBranding } from '../context/BrandingContext';

// Resolve the CLUB (org) a team belongs to — for share/invite surfaces.
// Invite links must carry the TEAM's club, never the viewer's ambient brand
// or a sticky session value: Albert's home brand is Rock City even while he
// works a Raptors Futsal team, and the org-aware login deliberately clears
// the sticky ff_club — both made buildInviteUrl(code) emit club-less links
// that open as the default brand. Backed by get_team_share_info (staff of
// the team or the platform owner); falls back to the ambient brand until
// the RPC resolves or when no teamId is available.
export function useTeamClubInfo(teamId) {
    const brand = useBranding();
    const [club, setClub] = useState(null);

    useEffect(() => {
        setClub(null);
        if (!teamId) return;
        let cancelled = false;
        supabase.rpc('get_team_share_info', { p_team_id: teamId }).then(({ data, error }) => {
            if (cancelled || error || !data) return;
            setClub({
                slug: data.org_slug,
                name: data.display_name || data.short_name,
                shortName: data.short_name || data.display_name,
                logoUrl: data.logo_url,
            });
        }, () => { /* keep ambient fallback */ });
        return () => { cancelled = true; };
    }, [teamId]);

    return club || { slug: brand.slug, name: brand.name, shortName: brand.shortName, logoUrl: brand.logoUrl };
}
