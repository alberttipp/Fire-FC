import React, { useState, useEffect } from 'react';
import { User, Activity, Clock, Mic, Users, Trophy, Plus, Copy, Check } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import PlayerEvaluationModal from './PlayerEvaluationModal';
import DrillLibraryModal from './DrillLibraryModal';
import AIFeedbackModal from './AIFeedbackModal';
import CreateTeamModal from './CreateTeamModal';
import InviteManager from './InviteManager';
import CreatePlayerModal from './CreatePlayerModal';
import AddExistingPlayerModal from './AddExistingPlayerModal';
import BulkInviteModal from './BulkInviteModal';
import FamilyInviteModal from './FamilyInviteModal';
import UpcomingWeek from './UpcomingWeek';
import { getPlayerAvatarPath } from '../../utils/playerAvatar';

const TeamView = () => {
    const { user, profile } = useAuth();
    const [myTeam, setMyTeam] = useState(null);
    const [allTeams, setAllTeams] = useState([]);
    const [selectedTeamId, setSelectedTeamId] = useState(null);
    const [roster, setRoster] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showPlayerModal, setShowPlayerModal] = useState(false);
    const [showAddExisting, setShowAddExisting] = useState(false);
    const [showBulkInvite, setShowBulkInvite] = useState(false);

    // UI State
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [invitePlayer, setInvitePlayer] = useState(null); // For Family Invite Modal
    const [feedbackPlayer, setFeedbackPlayer] = useState(null);
    const [copied, setCopied] = useState(false);
    const [showTeamSettings, setShowTeamSettings] = useState(false);
    const [savingEvalMode, setSavingEvalMode] = useState(false);
    const [trainCategory, setTrainCategory] = useState(null); // drill-library deep-link from an attribute

    // Set the team's default evaluation depth (youth = trimmed, pro = full FIFA).
    // Players inherit this unless they have a personal override.
    const setTeamEvalMode = async (nextMode) => {
        if (!myTeam?.id || savingEvalMode || myTeam.eval_mode === nextMode) return;
        setSavingEvalMode(true);
        const prev = myTeam.eval_mode;
        setMyTeam((t) => ({ ...t, eval_mode: nextMode })); // optimistic
        const { error } = await supabase.from('teams').update({ eval_mode: nextMode }).eq('id', myTeam.id);
        if (error) {
            console.warn('[TeamView] could not set eval_mode', error);
            setMyTeam((t) => ({ ...t, eval_mode: prev })); // revert
        }
        setSavingEvalMode(false);
    };

    // Check if user is manager or coach (used for UI)
    const isManager = profile?.role === 'manager' || user?.role === 'manager';
    const isCoach = profile?.role === 'coach' || user?.role === 'coach';

    const fetchTeamData = async () => {
        if (!user) return;
        setLoading(true);

        // Re-check roles inside function to get current values
        const currentIsManager = profile?.role === 'manager';
        const currentIsCoach = profile?.role === 'coach';

        console.log('[TeamView] fetchTeamData - profile:', profile);
        console.log('[TeamView] fetchTeamData - role:', profile?.role, 'isManager:', currentIsManager, 'isCoach:', currentIsCoach);

        let currentTeamId = null; // Track locally to avoid state timing issues

        try {
            // For managers and coaches, fetch ALL teams they can access
            if (currentIsManager) {
                // Managers see ALL teams in the club
                const { data: teams } = await supabase
                    .from('teams')
                    .select('*')
                    .order('age_group', { ascending: true });

                setAllTeams(teams || []);

                if (teams?.length > 0) {
                    const teamToSelect = selectedTeamId
                        ? teams.find(t => t.id === selectedTeamId) || teams[0]
                        : teams[0];
                    setSelectedTeamId(teamToSelect.id);
                    setMyTeam(teamToSelect);
                    currentTeamId = teamToSelect.id; // Use local variable
                }
            } else if (currentIsCoach) {
                // Coaches see all teams (for demo, coach manages all)
                const { data: teams } = await supabase
                    .from('teams')
                    .select('*')
                    .order('age_group', { ascending: true });

                setAllTeams(teams || []);

                if (teams?.length > 0) {
                    const teamToSelect = selectedTeamId
                        ? teams.find(t => t.id === selectedTeamId) || teams[0]
                        : teams[0];
                    setSelectedTeamId(teamToSelect.id);
                    setMyTeam(teamToSelect);
                    currentTeamId = teamToSelect.id; // Use local variable
                }
            } else {
                // Regular users - single team
                let teamId = profile?.team_id;
                let teamData = null;

                if (teamId) {
                    const { data } = await supabase.from('teams').select('*').eq('id', teamId).single();
                    teamData = data;
                }

                // Fallback for demo users: get the first available team
                if (!teamData) {
                    const { data: teams } = await supabase
                        .from('teams')
                        .select('*')
                        .order('age_group', { ascending: true })
                        .limit(1);
                    if (teams && teams.length > 0) {
                        teamData = teams[0];
                        teamId = teams[0].id;
                    }
                }

                setMyTeam(teamData);
                setAllTeams(teamData ? [teamData] : []);
                currentTeamId = teamData?.id; // Use local variable
            }

            // Fetch roster using local variable (not stale state). Reads
            // through team_active_roster view, which joins player_teams
            // (status='active') to players — supports a kid being on
            // multiple teams with a different jersey on each.
            if (currentTeamId) {
                const { data: players } = await supabase
                    .from('team_active_roster')
                    .select('*')
                    .eq('team_id', currentTeamId)
                    .order('last_name', { ascending: true });

                // Fetch evaluations and player_stats for all players
                const playerIds = (players || []).map(p => p.id);
                let evaluationsMap = {};
                let statsMap = {};
                if (playerIds.length > 0) {
                    const [{ data: evaluations }, { data: playerStatsData }] = await Promise.all([
                        supabase.from('evaluations').select('*').in('player_id', playerIds).order('created_at', { ascending: false }),
                        supabase.from('player_stats').select('player_id, weekly_minutes, training_minutes, career_touches').in('player_id', playerIds),
                    ]);

                    // Group by player_id, keep only latest eval
                    (evaluations || []).forEach(e => {
                        if (!evaluationsMap[e.player_id]) evaluationsMap[e.player_id] = e;
                    });
                    (playerStatsData || []).forEach(s => { statsMap[s.player_id] = s; });
                }

                // Transform - use evaluation OVR + player_stats for minutes/touches
                const formatted = (players || []).map(p => {
                    const eval_ = evaluationsMap[p.id];
                    const pStats = statsMap[p.id];
                    let ovr = '--';
                    if (eval_) {
                        const stats = [eval_.pace, eval_.shooting, eval_.passing, eval_.dribbling, eval_.defending, eval_.physical].filter(s => s != null);
                        if (stats.length > 0) {
                            ovr = Math.round(stats.reduce((a, b) => a + b, 0) / stats.length);
                        }
                    }
                    const weeklyMins = pStats?.weekly_minutes || 0;
                    const careerMins = pStats?.training_minutes || p.training_minutes || 0;
                    return {
                        id: p.id,
                        name: `${p.first_name} ${p.last_name}`,
                        firstName: p.first_name,
                        lastName: p.last_name,
                        number: p.jersey_number || '#',
                        rating: ovr,
                        minutes: weeklyMins,
                        careerMinutes: careerMins,
                        touches: pStats?.career_touches || 0,
                        status: weeklyMins > 60 ? 'On Fire' : weeklyMins > 20 ? 'Steady' : 'Warming Up',
                        avatar: getPlayerAvatarPath({
                            avatarUrl: p.avatar_url || null,
                            firstName: p.first_name || '',
                            lastName: p.last_name || '',
                            displayName: `${p.first_name || ''} ${p.last_name || ''}`.trim()
                        }),
                        position: p.position
                    };
                }).sort((a, b) => b.minutes - a.minutes);

                setRoster(formatted);
            } else {
                setRoster([]);
            }

        } catch (error) {
            console.error("Error loading team:", error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch roster when selected team changes
    const fetchRosterForTeam = async (teamId) => {
        if (!teamId) return;

        const { data: players } = await supabase
            .from('team_active_roster')
            .select('*')
            .eq('team_id', teamId)
            .order('last_name', { ascending: true });

        // Fetch evaluations and player_stats for all players
        const playerIds = (players || []).map(p => p.id);
        let evaluationsMap = {};
        let statsMap = {};
        if (playerIds.length > 0) {
            const [{ data: evaluations }, { data: playerStatsData }] = await Promise.all([
                supabase.from('evaluations').select('*').in('player_id', playerIds).order('created_at', { ascending: false }),
                supabase.from('player_stats').select('player_id, weekly_minutes, training_minutes, career_touches').in('player_id', playerIds),
            ]);

            (evaluations || []).forEach(e => {
                if (!evaluationsMap[e.player_id]) evaluationsMap[e.player_id] = e;
            });
            (playerStatsData || []).forEach(s => { statsMap[s.player_id] = s; });
        }

        // Transform - use evaluation OVR + player_stats for minutes/touches
        const formatted = (players || []).map(p => {
            const eval_ = evaluationsMap[p.id];
            const pStats = statsMap[p.id];
            let ovr = '--';
            if (eval_) {
                const stats = [eval_.pace, eval_.shooting, eval_.passing, eval_.dribbling, eval_.defending, eval_.physical].filter(s => s != null);
                if (stats.length > 0) {
                    ovr = Math.round(stats.reduce((a, b) => a + b, 0) / stats.length);
                }
            }
            const weeklyMins = pStats?.weekly_minutes || 0;
            const careerMins = pStats?.training_minutes || p.training_minutes || 0;
            return {
                id: p.id,
                name: `${p.first_name} ${p.last_name}`,
                firstName: p.first_name,
                lastName: p.last_name,
                number: p.jersey_number || '#',
                rating: ovr,
                minutes: weeklyMins,
                careerMinutes: careerMins,
                touches: pStats?.career_touches || 0,
                status: weeklyMins > 60 ? 'On Fire' : weeklyMins > 20 ? 'Steady' : 'Warming Up',
                avatar: getPlayerAvatarPath({
                    avatarUrl: p.avatar_url || null,
                    firstName: p.first_name || '',
                    lastName: p.last_name || '',
                    displayName: `${p.first_name || ''} ${p.last_name || ''}`.trim()
                }),
                position: p.position
            };
        }).sort((a, b) => b.minutes - a.minutes);

        setRoster(formatted);
    };

    const handleTeamSelect = (teamId) => {
        const team = allTeams.find(t => t.id === teamId);
        if (team) {
            setSelectedTeamId(teamId);
            setMyTeam(team);
            fetchRosterForTeam(teamId);
        }
    };

    useEffect(() => {
        fetchTeamData();
    }, [user, profile]);

    const handleCopyCode = () => {
        if (myTeam?.join_code) {
            navigator.clipboard.writeText(myTeam.join_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (loading) return <div className="text-white">Loading Team...</div>;

    // --- EMPTY STATE (No Team) ---
    if (!myTeam) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-fade-in-up">
                {showCreateModal && (
                    <CreateTeamModal
                        onClose={() => setShowCreateModal(false)}
                        onTeamCreated={(newTeam) => {
                            setMyTeam(newTeam);
                            setAllTeams([...allTeams, newTeam]);
                            fetchTeamData();
                        }}
                    />
                )}

                <div className="w-24 h-24 bg-brand-green/10 rounded-full flex items-center justify-center mb-6">
                    <Users className="w-12 h-12 text-brand-green" />
                </div>
                <h2 className="text-3xl text-white font-display uppercase font-bold mb-2">Build Your Squad</h2>
                <p className="text-gray-400 max-w-md text-center mb-8">
                    You haven't created a team yet. Set up your team roster, generate invite codes, and start tracking player progress.
                </p>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn-primary py-3 px-8 flex items-center gap-2 group"
                >
                    <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" /> Create New Team
                </button>
            </div>
        );
    }

    // --- ACTIVE TEAM VIEW ---
    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Create Team Modal - Available in active view too */}
            {showCreateModal && (
                <CreateTeamModal
                    onClose={() => setShowCreateModal(false)}
                    onTeamCreated={(newTeam) => {
                        setAllTeams([...allTeams, newTeam]);
                        setSelectedTeamId(newTeam.id);
                        setMyTeam(newTeam);
                        fetchTeamData();
                    }}
                />
            )}
            {/* Team Selector - Shows when user has access to teams (managers/coaches) */}
            {(isManager || isCoach) && (
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-black/30 rounded-xl border border-white/10">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-gray-400 text-sm font-bold uppercase tracking-wider mr-2">Select Team:</span>
                        {allTeams.map(team => (
                            <button
                                key={team.id}
                                onClick={() => handleTeamSelect(team.id)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                    selectedTeamId === team.id
                                        ? 'bg-brand-green text-brand-dark shadow-lg shadow-brand-green/30'
                                        : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                                }`}
                            >
                                {team.age_group}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-brand-green/10 text-brand-green border border-brand-green/30 px-3 py-2 rounded-lg text-xs font-bold uppercase hover:bg-brand-green/20 transition-colors flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> New Team
                    </button>
                </div>
            )}

            {/* Header with Team Code */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-brand-green/5 p-6 rounded-xl border border-brand-green/20">
                <div>
                    <h2 className="text-3xl text-white font-display uppercase font-bold flex items-center gap-3">
                        <Users className="w-8 h-8 text-brand-gold" /> {myTeam.name}
                        <span className="text-sm font-sans font-normal text-gray-400 border border-gray-600 px-2 py-0.5 rounded ml-2">
                            {myTeam.age_group}
                        </span>
                    </h2>
                    <p className="text-brand-green text-sm font-bold uppercase tracking-widest mt-1">
                        Active Roster: {roster.length} Players
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="bg-black/40 px-4 py-2 rounded-lg border border-white/10 flex flex-col items-end">
                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Team Code</span>
                        <div className="flex items-center gap-2">
                            <span className="text-xl text-white font-mono font-bold tracking-widest">{myTeam.join_code || '----'}</span>
                            <button onClick={handleCopyCode} className="text-brand-gold hover:text-white transition-colors" title="Copy Code">
                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowTeamSettings((s) => !s)}
                        className={`px-4 py-2 border rounded uppercase font-bold text-xs tracking-wider transition-colors ${showTeamSettings ? 'border-brand-green bg-brand-green/10 text-brand-green' : 'border-brand-green/30 text-brand-green hover:bg-brand-green/10'}`}
                    >
                        Settings
                    </button>
                </div>
            </div>

            {/* Team settings — coach/manager only */}
            {showTeamSettings && (isManager || isCoach) && (
                <div className="bg-black/30 border border-white/10 rounded-xl p-4 md:p-5 -mt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h3 className="text-white font-bold text-sm uppercase tracking-wider">Evaluation Depth</h3>
                            <p className="text-xs text-gray-400 mt-0.5 max-w-md">
                                <span className="text-gray-200 font-semibold">Youth</span> = simplified card for younger players ·{' '}
                                <span className="text-gray-200 font-semibold">Pro</span> = full FIFA sub-stats. Players inherit this unless individually overridden.
                            </p>
                        </div>
                        <div className="inline-flex rounded-lg border border-white/15 overflow-hidden shrink-0 self-start">
                            {[['youth', 'Youth'], ['pro', 'Pro']].map(([val, label]) => (
                                <button
                                    key={val}
                                    type="button"
                                    onClick={() => setTeamEvalMode(val)}
                                    disabled={savingEvalMode}
                                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-60 ${(myTeam.eval_mode || 'youth') === val ? 'bg-brand-green text-brand-dark' : 'text-gray-300 hover:text-white'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {selectedPlayer && (
                <PlayerEvaluationModal
                    player={selectedPlayer}
                    onTrainCategory={setTrainCategory}
                    onClose={() => { setSelectedPlayer(null); if (myTeam?.id) fetchRosterForTeam(myTeam.id); }}
                />
            )}

            {/* Drill library opened from an attribute's "Train" link — stacks over
                the eval card so the coach can browse/assign, then return. */}
            {trainCategory && selectedPlayer && (
                <DrillLibraryModal
                    initialFilter={trainCategory}
                    player={selectedPlayer}
                    teamId={myTeam?.id}
                    onClose={() => setTrainCategory(null)}
                />
            )}

            {feedbackPlayer && (
                <AIFeedbackModal player={feedbackPlayer} onClose={() => setFeedbackPlayer(null)} />
            )}

            {showPlayerModal && (
                <CreatePlayerModal
                    teamId={myTeam.id}
                    onClose={() => setShowPlayerModal(false)}
                    onPlayerCreated={(result) => {
                        fetchTeamData();
                        // Auto-open the parent-invite share modal so Albert
                        // can send the guardian code right after creating
                        // the kid — saves a navigation step.
                        if (result?.guardian_code) {
                            setInvitePlayer({
                                id: result.player_id,
                                name: `${result.first_name} ${result.last_name}`,
                                firstName: result.first_name,
                                lastName: result.last_name,
                                number: result.jersey_number,
                                guardian_code: result.guardian_code,
                                avatar: null,
                            });
                        }
                    }}
                />
            )}

            {showAddExisting && (
                <AddExistingPlayerModal
                    teamId={myTeam.id}
                    teamName={myTeam.name}
                    onClose={() => setShowAddExisting(false)}
                    onAdded={() => fetchRosterForTeam(myTeam.id)}
                />
            )}

            {showBulkInvite && (
                <BulkInviteModal
                    teamId={myTeam.id}
                    teamName={myTeam.name}
                    onClose={() => setShowBulkInvite(false)}
                />
            )}

            {invitePlayer && (
                <FamilyInviteModal
                    player={invitePlayer}
                    onClose={() => setInvitePlayer(null)}
                />
            )}

            {/* Upcoming Week Calendar */}
            <div className="mb-6">
                <UpcomingWeek teamId={myTeam.id} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Roster List */}
                <div className="md:col-span-2 glass-panel p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg text-brand-gold font-display uppercase font-bold flex items-center gap-2">
                            Roster
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                            <button
                                onClick={() => setShowBulkInvite(true)}
                                disabled={roster.length === 0}
                                className="bg-brand-gold/10 text-brand-gold border border-brand-gold/30 px-3 py-1.5 rounded text-xs font-bold uppercase hover:bg-brand-gold/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                title="Generate one message with every player's guardian code"
                            >
                                <Copy className="w-3 h-3" /> Invite Families
                            </button>
                            <button
                                onClick={() => setShowAddExisting(true)}
                                className="bg-brand-gold/10 text-brand-gold border border-brand-gold/30 px-3 py-1.5 rounded text-xs font-bold uppercase hover:bg-brand-gold/20 transition-colors flex items-center gap-2"
                                title="Pull a player from another team in your club"
                            >
                                <Users className="w-3 h-3" /> Add Existing
                            </button>
                            <button
                                onClick={() => setShowPlayerModal(true)}
                                className="bg-brand-green/10 text-brand-green border border-brand-green/30 px-3 py-1.5 rounded text-xs font-bold uppercase hover:bg-brand-green/20 transition-colors flex items-center gap-2"
                            >
                                <Trophy className="w-3 h-3" /> Add Player
                            </button>
                        </div>
                    </div>

                    {roster.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-xl">
                            <p className="text-gray-500 italic mb-2">No players found.</p>
                            <p className="text-sm text-gray-400">
                                Add players manually or share invites.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {roster.map((player) => (
                                <div
                                    key={player.id}
                                    className="flex items-center justify-between p-3 bg-white/5 rounded border border-white/5 hover:border-brand-green/30 transition-colors group cursor-pointer"
                                    onClick={() => setSelectedPlayer(player)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-white overflow-hidden border-2 border-white/20">
                                            {player.avatar ? (
                                                <img src={player.avatar} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                player.name.charAt(0)
                                            )}
                                        </div>
                                        <div>
                                            <span className="text-white font-bold block">{player.name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 rounded">#{player.number}</span>
                                                <span className={`text-[10px] uppercase font-bold ${player.status === 'On Fire' ? 'text-orange-400' : 'text-blue-400'}`}>
                                                    {player.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="hidden sm:flex items-center gap-4 text-right">
                                            <div>
                                                <span className="text-blue-400 font-display font-bold text-sm block">{player.minutes}</span>
                                                <span className="text-gray-600 text-[9px] uppercase">wk min</span>
                                            </div>
                                            <div>
                                                <span className="text-orange-400 font-display font-bold text-sm block">{(player.touches || 0).toLocaleString()}</span>
                                                <span className="text-gray-600 text-[9px] uppercase">touches</span>
                                            </div>
                                            <div>
                                                <span className="text-brand-gold font-display font-bold text-lg">{player.rating}</span>
                                                <span className="text-gray-500 text-[9px] uppercase block">OVR</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setInvitePlayer(player); }}
                                                className="p-2 rounded-full bg-brand-green/10 text-brand-green hover:bg-brand-green/20 border border-brand-green/30 transition-colors"
                                                title="Invite Family"
                                            >
                                                <Users className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setFeedbackPlayer(player); }}
                                                className="p-2 rounded-full bg-brand-gold/10 text-brand-gold hover:bg-brand-gold/20 border border-brand-gold/30 transition-colors"
                                                title="AI Feedback"
                                            >
                                                <Mic className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Team Stats / Sidebar */}
                <div className="space-y-6">
                    {/* Invite Manager */}
                    <InviteManager teamId={myTeam.id} />

                    <div className="glass-panel p-6 border-l-4 border-brand-green">
                        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Team Training</h3>
                        <div className="text-3xl font-display font-bold text-white">
                            {roster.reduce((sum, p) => sum + (p.minutes || 0), 0).toLocaleString()} <span className="text-lg text-gray-400">min</span>
                        </div>
                    </div>

                    <div className="glass-panel p-6">
                        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4">Pending Training</h3>
                        <div className="flex -space-x-3 mb-4 pl-2">
                            {/* Placeholder for pending avatars */}
                            <div className="w-8 h-8 rounded-full bg-gray-800 border border-brand-dark flex items-center justify-center text-[10px] text-gray-500">?</div>
                            <div className="w-8 h-8 rounded-full bg-gray-800 border border-brand-dark flex items-center justify-center text-[10px] text-gray-500">?</div>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">2 players missing challenges.</p>
                        <button className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded uppercase text-[10px] font-bold tracking-wider text-white transition-colors">
                            Send Reminder
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeamView;
