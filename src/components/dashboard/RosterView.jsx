import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Users } from 'lucide-react';

// Parent/player-facing TEAM ROSTER. Shows every teammate on each team the
// selected player is actively rostered to (a dual-rostered kid shows both).
// RLS already permits a guardian/player to read teammates on their own team
// (guardian_shares_active_team_with_player / user_has_kid_on_team on
// player_teams), so a plain read is safe and scoped.
const initials = (p) => `${(p.first_name || '?')[0] || ''}${(p.last_name || '')[0] || ''}`.toUpperCase();

const RosterView = ({ player }) => {
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        (async () => {
            setLoading(true);
            if (!player?.id) { setTeams([]); setLoading(false); return; }
            // Teams the selected kid is actively on.
            const { data: mine } = await supabase
                .from('player_teams')
                .select('team_id, teams(name)')
                .eq('player_id', player.id)
                .eq('status', 'active');
            const list = [...new Map((mine || []).map((m) => [m.team_id, { id: m.team_id, name: m.teams?.name || 'Team' }])).values()];

            const out = [];
            for (const t of list) {
                const { data: roster } = await supabase
                    .from('player_teams')
                    .select('players(first_name,last_name,jersey_number,avatar_url,display_name)')
                    .eq('team_id', t.id)
                    .eq('status', 'active');
                const players = (roster || []).map((r) => r.players).filter(Boolean)
                    .sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999) || (a.first_name || '').localeCompare(b.first_name || ''));
                out.push({ ...t, players });
            }
            if (alive) { setTeams(out); setLoading(false); }
        })();
        return () => { alive = false; };
    }, [player?.id]);

    return (
        <div className="max-w-3xl mx-auto px-4 md:px-6 pb-24 pt-6 space-y-6">
            <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-green" />
                <div>
                    <h1 className="text-3xl text-white font-display font-bold uppercase tracking-wider">Team Roster</h1>
                    <p className="text-gray-400 text-sm mt-0.5">Everyone on {player?.first_name ? `${player.first_name}'s` : 'your'} team{teams.length > 1 ? 's' : ''}.</p>
                </div>
            </div>

            {loading ? <p className="text-gray-500 text-sm">Loading…</p>
                : teams.length === 0 ? <p className="text-gray-500 text-sm">No team roster to show yet.</p>
                    : teams.map((t) => (
                        <div key={t.id} className="glass-panel p-4 md:p-5">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-white font-bold">{t.name}</h2>
                                <span className="text-gray-500 text-xs uppercase tracking-widest">{t.players.length} players</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {t.players.map((p, i) => (
                                    <div key={i} className="flex items-center gap-2.5 rounded-lg bg-white/[0.03] border border-white/5 p-2">
                                        {p.avatar_url
                                            ? <img src={p.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                                            : <div className="w-9 h-9 rounded-full bg-brand-green/15 text-brand-green flex items-center justify-center text-xs font-bold shrink-0">{initials(p)}</div>}
                                        <div className="min-w-0">
                                            <div className="text-white text-sm truncate">{p.first_name} {p.last_name || ''}</div>
                                            {p.jersey_number != null && <div className="text-gray-500 text-[11px]">#{p.jersey_number}</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
        </div>
    );
};

export default RosterView;
