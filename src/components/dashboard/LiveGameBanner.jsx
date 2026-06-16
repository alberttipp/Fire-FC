import React, { useState, useEffect } from 'react';
import { Radio, ChevronRight, Trophy } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

// Dashboard-wide game banner — shows for everyone on the team:
//   * GAMEDAY (gold): a game is scheduled TODAY and not finished — kickoff time
//     + countdown, so families know it's gameday and to watch for it going live.
//   * LIVE (red, pulsing): a game is in progress — live score, tap to follow.
// Flips gameday -> live automatically when the scorekeeper starts the game.
// [TEST] games never banner the team. One tap opens Live Scoring.
const LiveGameBanner = ({ onOpen }) => {
    const { user, profile } = useAuth();
    const [teamId, setTeamId] = useState(profile?.team_id || null);
    const [game, setGame] = useState(null);
    const [, setTick] = useState(0); // re-render for the live countdown

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
            const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
            const endToday = new Date(startToday); endToday.setDate(endToday.getDate() + 1);
            const { data } = await supabase
                .from('events')
                .select('id, title, opponent_name, home_score, away_score, game_status, start_time')
                .eq('team_id', teamId).eq('type', 'game').neq('game_status', 'finished')
                .order('start_time', { ascending: true });
            // [TEST] games stay silent for families.
            const cand = (data || []).filter(e => !(e.title || '').toUpperCase().startsWith('[TEST]'));
            const live = cand.find(e => e.game_status === 'live' || e.game_status === 'halftime');
            const todayGame = cand.find(e => { const t = new Date(e.start_time); return t >= startToday && t < endToday; });
            if (!cancelled) setGame(live || todayGame || null);
        };
        refresh();
        const channel = supabase
            .channel(`live-banner:${teamId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `team_id=eq.${teamId}` }, refresh)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events', filter: `team_id=eq.${teamId}` }, refresh)
            .subscribe();
        const tick = setInterval(() => setTick(t => t + 1), 60_000); // refresh countdown
        return () => { cancelled = true; clearInterval(tick); supabase.removeChannel(channel); };
    }, [teamId]);

    if (!game) return null;

    const isLive = game.game_status === 'live' || game.game_status === 'halftime';

    if (isLive) {
        return (
            <button type="button" onClick={onOpen}
                className="w-full mb-4 rounded-xl border border-red-500/40 bg-gradient-to-r from-red-500/20 to-red-500/5 p-3 flex items-center gap-3 hover:from-red-500/30 transition-colors animate-fade-in">
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
    }

    // GAMEDAY (scheduled today, not yet live)
    const kickoff = new Date(game.start_time);
    const mins = Math.round((kickoff - new Date()) / 60000);
    const when = mins <= 0
        ? 'kicking off soon'
        : mins < 60 ? `kicks off in ${mins}m`
        : `kicks off in ${Math.floor(mins / 60)}h ${mins % 60}m`;
    const timeStr = kickoff.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    return (
        <button type="button" onClick={onOpen}
            className="w-full mb-4 rounded-xl border border-brand-gold/40 bg-gradient-to-r from-brand-gold/20 to-brand-gold/5 p-3 flex items-center gap-3 hover:from-brand-gold/30 transition-colors animate-fade-in">
            <Trophy className="w-5 h-5 text-brand-gold shrink-0" />
            <div className="flex-1 min-w-0 text-left">
                <div className="text-white text-sm font-bold truncate">
                    ⚽ GAMEDAY · Fire FC vs {game.opponent_name || 'opponent'}
                </div>
                <div className="text-[11px] text-brand-gold font-bold uppercase tracking-wider">{timeStr} · {when}</div>
            </div>
            <span className="text-[11px] text-brand-gold font-bold uppercase tracking-wider hidden sm:inline">Follow</span>
            <ChevronRight className="w-4 h-4 text-brand-gold shrink-0" />
        </button>
    );
};

export default LiveGameBanner;
