import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Plus, Minus, Play, Video, Loader2, Clock, Hand, UserCheck } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import { STAFF_ROLES } from '../../constants/roles';

const STATUS_CONFIG = {
    scheduled: { label: 'Upcoming', color: 'bg-gray-500/20 text-gray-400', dot: '' },
    live:      { label: 'LIVE',      color: 'bg-green-500/20 text-green-400', dot: 'animate-pulse' },
    halftime:  { label: 'Half Time', color: 'bg-yellow-500/20 text-yellow-400', dot: '' },
    finished:  { label: 'Final',     color: 'bg-red-500/20 text-red-400', dot: '' },
};

// scheduled → live → halftime → live → finished
const NEXT_STATUS = { scheduled: 'live', live: 'halftime', halftime: 'live', finished: 'finished' };
const NEXT_LABEL  = { scheduled: 'Start', live: 'Halftime', halftime: 'Resume', finished: 'Final' };

const LiveScoringView = () => {
    const { user, profile } = useAuth();
    const toast = useToast();
    const [games, setGames] = useState([]);
    const [skNames, setSkNames] = useState({}); // user_id -> display name
    const [loading, setLoading] = useState(true);
    const [teamId, setTeamId] = useState(null);
    const [currentRole, setCurrentRole] = useState(profile?.role || user?.role || 'player');
    const [busyId, setBusyId] = useState(null);

    const isStaff = STAFF_ROLES.has(currentRole);
    const canScore = (g) => isStaff || (!!user?.id && g.scorekeeper_user_id === user.id);

    useEffect(() => { if (user?.id) getTeamId(); }, [user]);

    useEffect(() => {
        if (!teamId) return;
        fetchGames();
        const channel = supabase
            .channel('live-scores')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `team_id=eq.${teamId}` },
                (payload) => setGames(prev => prev.map(g => g.id === payload.new.id ? { ...g, ...payload.new } : g)))
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, [teamId]);

    const getTeamId = async () => {
        if (profile?.team_id) { setTeamId(profile.team_id); return; }
        const { data: m } = await supabase.from('team_memberships').select('team_id, role').eq('user_id', user.id).limit(1).single();
        if (m?.team_id) { if (m.role) setCurrentRole(m.role); setTeamId(m.team_id); return; }
        const { data: fam } = await supabase.from('family_members').select('player_id').eq('user_id', user.id).limit(1).single();
        if (fam?.player_id) {
            const { data: p } = await supabase.from('players').select('team_id').eq('id', fam.player_id).single();
            if (p?.team_id) { setCurrentRole('parent'); setTeamId(p.team_id); return; }
        }
        setLoading(false);
    };

    const loadNames = useCallback(async (rows) => {
        const ids = [...new Set(rows.map(g => g.scorekeeper_user_id).filter(Boolean))];
        if (ids.length === 0) return;
        const { data } = await supabase.from('profiles').select('id, full_name').in('id', ids);
        const map = {};
        (data || []).forEach(p => { map[p.id] = p.full_name; });
        setSkNames(prev => ({ ...prev, ...map }));
    }, []);

    const fetchGames = async () => {
        setLoading(true);
        try {
            const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
            const { data, error } = await supabase
                .from('events').select('*')
                .eq('team_id', teamId).eq('type', 'game')
                .gte('start_time', sevenDaysAgo)
                .order('start_time', { ascending: true });
            if (error) throw error;
            setGames(data || []);
            loadNames(data || []);
        } catch (err) {
            console.error('Error fetching games:', err);
        } finally {
            setLoading(false);
        }
    };

    const updateScore = async (game, side /* 'home'|'away' */, delta) => {
        const field = side === 'home' ? 'home_score' : 'away_score';
        const prevVal = game[field] || 0;
        const optimistic = Math.max(0, prevVal + delta);
        setGames(prev => prev.map(g => g.id === game.id ? { ...g, [field]: optimistic } : g));
        const { data, error } = await supabase.rpc('bump_game_score', { p_event_id: game.id, p_side: side, p_delta: delta });
        if (error) {
            setGames(prev => prev.map(g => g.id === game.id ? { ...g, [field]: prevVal } : g));
            toast.error('Could not update the score.');
        } else if (data) {
            setGames(prev => prev.map(g => g.id === game.id ? { ...g, home_score: data.home_score, away_score: data.away_score } : g));
        }
    };

    const advanceStatus = async (game) => {
        const next = NEXT_STATUS[game.game_status || 'scheduled'];
        const prevStatus = game.game_status || 'scheduled';
        setGames(prev => prev.map(g => g.id === game.id ? { ...g, game_status: next } : g));
        const { error } = await supabase.rpc('set_game_status', { p_event_id: game.id, p_status: next });
        if (error) {
            setGames(prev => prev.map(g => g.id === game.id ? { ...g, game_status: prevStatus } : g));
            toast.error('Could not update game status.');
        } else if (next === 'live' && prevStatus === 'scheduled') {
            toast.success('Game is live — the team just got a kickoff alert. ⚽');
        } else if (next === 'finished') {
            toast.success('Final whistle — score sent to the team. 🏁');
        }
    };

    const claim = async (game) => {
        setBusyId(game.id);
        const { error } = await supabase.rpc('claim_game_scorekeeper', { p_event_id: game.id });
        setBusyId(null);
        if (error) {
            toast.error(/already/i.test(error.message) ? 'Someone’s already keeping score.' : "Couldn't claim scoring.");
            fetchGames();
            return;
        }
        setGames(prev => prev.map(g => g.id === game.id ? { ...g, scorekeeper_user_id: user.id } : g));
        setSkNames(prev => ({ ...prev, [user.id]: profile?.full_name || 'You' }));
        toast.success("You're keeping score! Tap + when Fire scores. ⚽");
    };

    const release = async (game) => {
        setBusyId(game.id);
        const { error } = await supabase.rpc('release_game_scorekeeper', { p_event_id: game.id });
        setBusyId(null);
        if (error) { toast.error("Couldn't release scoring."); return; }
        setGames(prev => prev.map(g => g.id === game.id ? { ...g, scorekeeper_user_id: null } : g));
    };

    const updateOpponent = async (gameId, name) => {
        await supabase.from('events').update({ opponent_name: name }).eq('id', gameId);
    };

    if (loading) {
        return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-green" /></div>;
    }

    const liveCount = games.filter(g => g.game_status === 'live').length;

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div>
                <h2 className="text-2xl md:text-3xl text-white font-display uppercase font-bold tracking-wider flex items-center gap-3">
                    <Trophy className="w-7 h-7 text-brand-gold" /> Live Scoring
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                    {liveCount > 0 ? `${liveCount} game${liveCount > 1 ? 's' : ''} in progress` : `${games.length} game${games.length !== 1 ? 's' : ''} this week`}
                </p>
            </div>

            {games.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-xl">
                    <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 font-bold mb-1">No games scheduled</p>
                    <p className="text-gray-500 text-sm">Create a game event from the Schedule tab.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {games.map(game => {
                        const date = new Date(game.start_time);
                        const status = game.game_status || 'scheduled';
                        const statusCfg = STATUS_CONFIG[status];
                        const isLive = status === 'live' || status === 'halftime';
                        const iCanScore = canScore(game);
                        const skName = game.scorekeeper_user_id ? (skNames[game.scorekeeper_user_id] || 'A parent') : null;
                        const skIsMe = game.scorekeeper_user_id && game.scorekeeper_user_id === user?.id;
                        const busy = busyId === game.id;

                        return (
                            <div key={game.id} className={`glass-panel p-5 border-l-4 ${isLive ? 'border-l-green-500' : status === 'finished' ? 'border-l-red-500' : 'border-l-brand-gold'}`}>
                                {/* Date + Status */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-brand-gold/10 rounded-lg flex flex-col items-center justify-center">
                                            <span className="text-brand-gold text-xs font-bold uppercase">{date.toLocaleDateString('en-US', { month: 'short' })}</span>
                                            <span className="text-white text-lg font-bold leading-none">{date.getDate()}</span>
                                        </div>
                                        <div>
                                            <p className="text-white font-bold">{game.title}</p>
                                            <p className="text-gray-500 text-xs flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                                {game.location_name && ` · ${game.location_name}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isLive && <span className={`w-2 h-2 rounded-full bg-green-500 ${statusCfg.dot}`} />}
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${statusCfg.color}`}>{statusCfg.label}</span>
                                        {iCanScore && status !== 'finished' && (
                                            <button onClick={() => advanceStatus(game)} className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-gray-300 hover:text-white text-xs font-bold uppercase flex items-center gap-1 transition-colors" title="Advance game status">
                                                <Play className="w-3.5 h-3.5" /> {NEXT_LABEL[status]}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Scoreboard */}
                                <div className="flex items-center justify-center gap-4 sm:gap-8 py-4 bg-white/5 rounded-xl">
                                    <div className="text-center">
                                        <p className="text-xs text-gray-400 uppercase font-bold mb-1">Fire FC</p>
                                        <div className="flex items-center gap-2">
                                            {iCanScore && (
                                                <button onClick={() => updateScore(game, 'home', -1)} className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors"><Minus className="w-4 h-4" /></button>
                                            )}
                                            <span className="text-4xl sm:text-5xl font-mono font-bold text-white min-w-[3rem] text-center">{game.home_score || 0}</span>
                                            {iCanScore && (
                                                <button onClick={() => updateScore(game, 'home', 1)} className="w-8 h-8 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/30 flex items-center justify-center transition-colors"><Plus className="w-4 h-4" /></button>
                                            )}
                                        </div>
                                    </div>

                                    <span className="text-2xl text-gray-600 font-bold">—</span>

                                    <div className="text-center">
                                        <p className="text-xs text-gray-400 uppercase font-bold mb-1">
                                            {isStaff ? (
                                                <input type="text" value={game.opponent_name || ''}
                                                    onChange={(e) => setGames(prev => prev.map(g => g.id === game.id ? { ...g, opponent_name: e.target.value } : g))}
                                                    onBlur={(e) => updateOpponent(game.id, e.target.value)}
                                                    placeholder="Opponent"
                                                    className="bg-transparent border-b border-dashed border-gray-600 text-gray-400 text-xs uppercase text-center w-24 focus:outline-none focus:border-brand-gold" />
                                            ) : (game.opponent_name || 'Away')}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            {iCanScore && (
                                                <button onClick={() => updateScore(game, 'away', -1)} className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors"><Minus className="w-4 h-4" /></button>
                                            )}
                                            <span className="text-4xl sm:text-5xl font-mono font-bold text-white min-w-[3rem] text-center">{game.away_score || 0}</span>
                                            {iCanScore && (
                                                <button onClick={() => updateScore(game, 'away', 1)} className="w-8 h-8 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/30 flex items-center justify-center transition-colors"><Plus className="w-4 h-4" /></button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Scorekeeper row */}
                                {status !== 'finished' && (
                                    <div className="mt-3 flex items-center gap-2 text-xs">
                                        {skName ? (
                                            <>
                                                <UserCheck className="w-4 h-4 text-brand-green" />
                                                <span className="text-gray-300">Keeping score: <span className="text-white font-medium">{skIsMe ? 'You' : skName}</span></span>
                                                {(skIsMe || isStaff) && (
                                                    <button onClick={() => release(game)} disabled={busy} className="ml-auto text-gray-500 hover:text-white underline disabled:opacity-50">
                                                        {isStaff && !skIsMe ? 'Reassign' : 'Hand off'}
                                                    </button>
                                                )}
                                            </>
                                        ) : (
                                            <button onClick={() => claim(game)} disabled={busy}
                                                className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-green/15 text-brand-green font-bold hover:bg-brand-green/25 transition-colors disabled:opacity-50">
                                                <Hand className="w-3.5 h-3.5" /> I'll keep score
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Video link */}
                                {game.video_url && (
                                    <a href={game.video_url} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-2 text-red-400 hover:text-red-300 text-sm transition-colors">
                                        <Video className="w-4 h-4" /> Watch Stream
                                    </a>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default LiveScoringView;
