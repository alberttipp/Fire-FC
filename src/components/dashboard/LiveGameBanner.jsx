import React, { useState, useEffect } from 'react';
import { Radio, ChevronRight } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

// Dashboard-wide "🔴 LIVE" banner — shows for everyone on the team whenever a
// game is in progress, with the live score, one tap to jump to Live Scoring.
// Self-resolves the team (works for staff, players, and parents) and listens
// for realtime score/status changes so the banner score ticks live.
const LiveGameBanner = ({ onOpen }) => {
    const { user, profile } = useAuth();
    const [teamId, setTeamId] = useState(profile?.team_id || null);
    const [game, setGame] = useState(null);

    useEffect(() => {
        if (teamId || !user?.id) return;
        let cancelled = false;
        (async () => {
            const { data: m } = await supabase.from('team_memberships').select('team_id').eq('user_id', user.id).limit(1).maybeSingle();
            if (!cancelled && m?.team_id) { setTeamId(m.team_id); return; }
            const { data: fam } = await supabase.from('family_members').select('player_id').eq('user_id', user.id).limit(1).maybeSingle();
            if (fam?.player_id) {
                const { data: p } = await supabase.from('players').select('team_id').eq('id', fam.player_id).maybeSingle();
                if (!cancelled && p?.team_id) setTeamId(p.team_id);
            }
        })();
        return () => { cancelled = true; };
    }, [user?.id, teamId]);

    useEffect(() => {
        if (!teamId) return;
        let cancelled = false;
        const refresh = async () => {
            const { data } = await supabase
                .from('events')
                .select('id, title, opponent_name, home_score, away_score, game_status')
                .eq('team_id', teamId).eq('type', 'game').eq('game_status', 'live')
                .order('start_time', { ascending: false }).limit(1);
            if (!cancelled) setGame((data && data[0]) || null);
        };
        refresh();
        const channel = supabase
            .channel(`live-banner:${teamId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `team_id=eq.${teamId}` }, refresh)
            .subscribe();
        return () => { cancelled = true; supabase.removeChannel(channel); };
    }, [teamId]);

    if (!game) return null;

    return (
        <button
            type="button"
            onClick={onOpen}
            className="w-full mb-4 rounded-xl border border-red-500/40 bg-gradient-to-r from-red-500/20 to-red-500/5 p-3 flex items-center gap-3 hover:from-red-500/30 transition-colors animate-fade-in"
        >
            <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <Radio className="w-4 h-4 text-red-400 shrink-0" />
            <span className="flex-1 text-left text-white text-sm font-bold truncate">
                LIVE · Fire FC {game.home_score || 0}–{game.away_score || 0} vs {game.opponent_name || 'opponent'}
            </span>
            <span className="text-[11px] text-red-300 font-bold uppercase tracking-wider hidden sm:inline">Follow</span>
            <ChevronRight className="w-4 h-4 text-red-300 shrink-0" />
        </button>
    );
};

export default LiveGameBanner;
