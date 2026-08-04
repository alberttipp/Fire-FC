import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useBranding } from '../../context/BrandingContext';

// Reserved "Powered by" slot for NETWORK sponsors — platform-owner-sold sponsors
// (revenue to 815YouthSports) that appear across clubs. Deliberately SEPARATE from
// SponsorSlot (club Title/Premier/Community tiers) so it never cannibalizes a
// club's own sponsor inventory. Renders NOTHING when there are none, or when the
// club has opted out (get_network_sponsors already filters on that), so dropping
// it anywhere is safe.
const impressed = new Set();
function logImpression(id) {
    if (!id || impressed.has(id)) return;
    impressed.add(id);
    supabase.rpc('log_network_sponsor_impression', { p_id: id }).catch(() => {});
}

const NetworkSponsorSlot = ({ className = '' }) => {
    const brand = useBranding();
    const [rows, setRows] = useState([]);

    useEffect(() => {
        let active = true;
        if (!brand?.slug) return;
        (async () => {
            const { data, error } = await supabase.rpc('get_network_sponsors', { p_slug: brand.slug });
            if (!active) return;
            const list = error ? [] : (data || []);
            setRows(list);
            list.forEach((s) => logImpression(s.id));
        })();
        return () => { active = false; };
    }, [brand?.slug]);

    if (rows.length === 0) return null;

    return (
        <div className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 ${className}`}>
            <span className="uppercase tracking-wider text-[10px] text-gray-500 w-full text-center">Powered by</span>
            {rows.map((s) => (
                <a key={s.id} href={s.link_url || undefined} target="_blank" rel="noreferrer"
                    title={s.name} onClick={() => logImpression(s.id)}
                    className="inline-flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
                    {s.logo_url
                        ? <img src={s.logo_url} alt={s.name} className="h-7 object-contain" />
                        : <span className="text-xs font-semibold text-gray-300">{s.name}</span>}
                </a>
            ))}
        </div>
    );
};

export default NetworkSponsorSlot;
