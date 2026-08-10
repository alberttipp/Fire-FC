import React, { useEffect, useState } from 'react';
import { Trophy, CalendarRange, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';

// "League Central" — deep-links to the team's OFFICIAL league schedule + standings
// (e.g. the ECNL/TGS pages). Deep-links only, no data ingest. Renders NOTHING until
// a link is set for the team's program, so it's safe to drop anywhere.
export default function LeagueCentral({ className = '' }) {
    const { profile } = useAuth();
    const [links, setLinks] = useState(null);

    useEffect(() => {
        let active = true;
        if (!profile?.team_id) { setLinks(undefined); return; }
        supabase.rpc('get_team_league_links', { p_team_id: profile.team_id })
            .then(({ data }) => { if (active) setLinks((Array.isArray(data) ? data[0] : data) || undefined); });
        return () => { active = false; };
    }, [profile?.team_id]);

    if (!links) return null; // loading or no league links set
    const { league_name, schedule_url, standings_url } = links;

    return (
        <div className={`rounded-2xl border border-brand-gold/30 bg-gradient-to-br from-brand-gold/10 to-white/[0.02] p-4 ${className}`}>
            <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-4 h-4 text-brand-gold" />
                <span className="text-xs font-display uppercase tracking-wider text-brand-gold">League Central</span>
            </div>
            {league_name && <div className="text-white font-bold text-sm mb-3">{league_name}</div>}
            <div className="flex flex-wrap gap-2">
                {schedule_url && (
                    <a href={schedule_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm font-bold bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2">
                        <CalendarRange className="w-4 h-4" /> Official schedule <ExternalLink className="w-3 h-3 opacity-60" />
                    </a>
                )}
                {standings_url && (
                    <a href={standings_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm font-bold bg-brand-gold/15 hover:bg-brand-gold/25 text-brand-gold rounded-lg px-3 py-2">
                        <Trophy className="w-4 h-4" /> Standings <ExternalLink className="w-3 h-3 opacity-60" />
                    </a>
                )}
            </div>
        </div>
    );
}
