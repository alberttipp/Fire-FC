import React, { useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useSponsors } from '../../context/SponsorContext';

// One component for every sponsor placement. Renders the sponsor(s) for a tier;
// renders NOTHING if the club has none — so dropping it anywhere is safe and a
// no-op until a sponsor exists.
//
//   <SponsorSlot tier="title" placement="login" />
//   <SponsorSlot tier="community" placement="footer" />

// Session-level dedupe so we log at most one impression per sponsor+placement per load.
const impressed = new Set();
function logImpression(id, placement = 'unknown') {
    if (!id) return;
    const key = `${id}:${placement}`;
    if (impressed.has(key)) return;
    impressed.add(key);
    supabase.rpc('log_sponsor_impression', { p_sponsor_id: id, p_placement: placement }).catch(() => {});
}

const TIER_LABEL = { premier: 'Premier sponsors', community: 'Proud community sponsors' };

const SponsorSlot = ({ tier = 'title', placement = 'dashboard', className = '' }) => {
    const { byTier } = useSponsors();
    const sponsors = byTier[tier] || [];

    useEffect(() => { sponsors.forEach((s) => logImpression(s.id, placement)); }, [sponsors, placement]);

    if (sponsors.length === 0) return null;

    // Title — prominent "presented by" lockup (login splash, dashboard top strip).
    if (tier === 'title') {
        const s = sponsors[0];
        return (
            <a
                href={s.link_url || undefined}
                target="_blank"
                rel="noreferrer"
                onClick={() => logImpression(s.id, placement)}
                className={`inline-flex items-center gap-2 ${className}`}
            >
                <span className="uppercase tracking-wider text-[10px] text-gray-500 shrink-0">Presented by</span>
                {s.logo_url
                    ? <img src={s.logo_url} alt={s.name} className="h-6 object-contain" />
                    : <span className="font-bold text-gray-200 text-sm">{s.name}</span>}
            </a>
        );
    }

    // Premier / Community — a logo row, larger for premier.
    const h = tier === 'premier' ? 'h-8' : 'h-6';
    return (
        <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`}>
            {placement === 'footer' && (
                <span className="uppercase tracking-wider text-[10px] text-gray-500 w-full">{TIER_LABEL[tier]}</span>
            )}
            {sponsors.map((s) => (
                <a
                    key={s.id}
                    href={s.link_url || undefined}
                    target="_blank"
                    rel="noreferrer"
                    title={s.name}
                    onClick={() => logImpression(s.id, placement)}
                    className="inline-flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity"
                >
                    {s.logo_url
                        ? <img src={s.logo_url} alt={s.name} className={`${h} object-contain`} />
                        : <span className="text-xs font-semibold text-gray-300">{s.name}</span>}
                </a>
            ))}
        </div>
    );
};

export default SponsorSlot;
