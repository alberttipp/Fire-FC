import React, { useEffect, useState } from 'react';
import { X, Loader2, Trophy } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import PlayerCard from './PlayerCard';
import { getPlayerAvatarPath } from '../../utils/playerAvatar';
import { DEFAULT_CARD_COUNTRY } from '../../constants/cardCountries';

// Side-by-side comparison of a kid's cards ACROSS the teams they play on.
// The card FACE (photo, flag, hero mode, number) is global to the kid; only the
// RATINGS differ per team (each team rates independently — see evaluations
// .team_id). Family/player surface only — coaches never see another team's
// ratings. Renders nothing unless the kid is on 2+ teams, so it's invisible for
// the common single-team case.
const CardCompareModal = ({ player, onClose }) => {
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!player?.id) { setLoading(false); return; }

            // Teams the kid is actively on.
            const { data: pt } = await supabase
                .from('player_teams')
                .select('team_id, jersey_number, position, teams:team_id (name, age_group)')
                .eq('player_id', player.id)
                .eq('status', 'active');
            const teams = (pt || []).filter((r) => r.team_id);

            // Global bits for the card face.
            const { data: statsRow } = await supabase
                .from('player_stats')
                .select('messi_mode_unlocked')
                .eq('player_id', player.id)
                .maybeSingle();

            const image = getPlayerAvatarPath({
                avatarUrl: player.avatar_url || null,
                firstName: player.first_name || '',
                lastName: player.last_name || '',
                displayName: `${player.first_name || ''} ${player.last_name || ''}`.trim(),
            });

            // Latest eval per team → build a card prop set per team.
            const built = await Promise.all(teams.map(async (t) => {
                const { data: ev } = await supabase
                    .from('evaluations')
                    .select('pace, shooting, passing, dribbling, defending, physical')
                    .eq('player_id', player.id)
                    .eq('team_id', t.team_id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                const rated = !!ev;
                const overall = rated
                    ? Math.round((ev.pace + ev.shooting + ev.passing + ev.dribbling + ev.defending + ev.physical) / 6)
                    : null;
                return {
                    teamId: t.team_id,
                    teamName: t.teams?.name || 'Team',
                    ageGroup: t.teams?.age_group || '',
                    rated,
                    card: {
                        id: player.id,
                        user_id: player.user_id,
                        name: `${player.first_name} ${player.last_name}`,
                        number: (t.jersey_number ?? player.jersey_number)?.toString() || '0',
                        position: t.position || player.position || 'MF',
                        rating: overall || 50,
                        pace: ev?.pace || 50,
                        shooting: ev?.shooting || 50,
                        passing: ev?.passing || 50,
                        dribbling: ev?.dribbling || 50,
                        defending: ev?.defending || 50,
                        physical: ev?.physical || 50,
                        messiMode: statsRow?.messi_mode_unlocked || false,
                        heroMode: player.hero_mode || null,
                        country: player.card_country || DEFAULT_CARD_COUNTRY,
                        image,
                    },
                };
            }));

            if (!cancelled) { setCards(built); setLoading(false); }
        })();
        return () => { cancelled = true; };
    }, [player?.id]);

    return (
        <div className="fixed inset-0 z-[120] flex items-start md:items-center justify-center p-0 md:p-4 bg-black/85 backdrop-blur-sm animate-fade-in overflow-y-auto" onClick={onClose}>
            <div
                className="bg-brand-dark border border-white/10 w-full md:max-w-4xl rounded-t-2xl md:rounded-2xl shadow-2xl my-auto"
                style={{ minHeight: 'min(100%, 100dvh)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 z-10 flex items-center gap-3 p-4 border-b border-white/10 bg-brand-dark/95 backdrop-blur">
                    <Trophy className="w-5 h-5 text-brand-gold" />
                    <div className="min-w-0">
                        <h3 className="text-white font-display uppercase font-bold tracking-wider truncate">
                            {player?.first_name}'s cards — by team
                        </h3>
                        <p className="text-gray-400 text-xs">Same player, rated independently by each team</p>
                    </div>
                    <button onClick={onClose} className="ml-auto text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-brand-gold animate-spin" /></div>
                ) : (
                    <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-8 justify-items-center">
                        {cards.map((c) => (
                            <div key={c.teamId} className="w-full flex flex-col items-center">
                                <div className="mb-3 text-center">
                                    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-green/10 text-brand-green border border-brand-green/30">
                                        {c.teamName}{c.ageGroup ? ` · ${c.ageGroup}` : ''}
                                    </span>
                                    {!c.rated && (
                                        <p className="text-[11px] text-gray-500 mt-1.5">Not yet rated by this team</p>
                                    )}
                                </div>
                                <PlayerCard player={c.card} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CardCompareModal;
