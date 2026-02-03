import React, { useState, useEffect } from 'react';
import { User, Activity, Clock, Mic, Users, Trophy, Plus, Copy, Check } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import PlayerEvaluationModal from './PlayerEvaluationModal';
import AIFeedbackModal from './AIFeedbackModal';
import CreateTeamModal from './CreateTeamModal';
import InviteManager from './InviteManager';
import CreatePlayerModal from './CreatePlayerModal';
import FamilyInviteModal from './FamilyInviteModal';
import UpcomingWeek from './UpcomingWeek';

const TeamView = () => {
    const { user, profile } = useAuth();
    const [myTeam, setMyTeam] = useState(null);
    const [allTeams, setAllTeams] = useState([]);
    const [selectedTeamId, setSelectedTeamId] = useState(null);
    const [roster, setRoster] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showPlayerModal, setShowPlayerModal] = useState(false);

    // UI State
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [invitePlayer, setInvitePlayer] = useState(null); // For Family Invite Modal
    const [feedbackRecipient, setFeedbackRecipient] = useState(null);
    const [copied, setCopied] = useState(false);

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

            // Fetch roster using local variable (not stale state)
            if (currentTeamId) {
                const { data: players } = await supabase
                    .from('players')
                    .select('*')
                    .eq('team_id', currentTeamId)
                    .order('last_name', { ascending: true });

                // Transform - use rating and minutes instead of XP
                const formatted = (players || []).map(p => ({
                    id: p.id,
                    name: `${p.first_name} ${p.last_name}`,
                    firstName: p.first_name,
                    lastName: p.last_name,
                    number: p.jersey_number || '#',
                    rating: p.overall_rating || '--',
                    minutes: p.training_minutes || 0,
                    status: (p.training_minutes > 60) ? 'On Fire' : 'Steady',
                    avatar: p.avatar_url,
                    position: p.position
                })).sort((a, b) => b.minutes - a.minutes);

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
            .from('players')
            .select('*')
            .eq('team_id', teamId)
            .order('last_name', { ascending: true });

        const formatted = (players || []).map(p => ({
            id: p.id,
            name: `${p.first_name} ${p.last_name}`,
            firstName: p.first_name,
            lastName: p.last_name,
            number: p.jersey_number || '#',
            rating: p.overall_rating || '--',
            minutes: p.training_minutes || 0,
            status: (p.training_minutes > 60) ? 'On Fire' : 'Steady',
            avatar: p.avatar_url,
            position: p.position
        })).sort((a, b) => b.minutes - a.minutes);

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
                    <button className="px-4 py-2 border border-brand-green/30 text-brand-green hover:bg-brand-green/10 rounded uppercase font-bold text-xs tracking-wider">
                        Settings
                    </button>
                </div>
            </div>

            {selectedPlayer && (
                <PlayerEvaluationModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
            )}

            {feedbackRecipient && (
                <AIFeedbackModal recipient={feedbackRecipient} onClose={() => setFeedbackRecipient(null)} />
            )}

            {showPlayerModal && (
                <CreatePlayerModal
                    teamId={myTeam.id}
                    onClose={() => setShowPlayerModal(false)}
                    onPlayerCreated={() => fetchTeamData()}
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
                        <button
                            onClick={() => setShowPlayerModal(true)}
                            className="bg-brand-green/10 text-brand-green border border-brand-green/30 px-3 py-1.5 rounded text-xs font-bold uppercase hover:bg-brand-green/20 transition-colors flex items-center gap-2"
                        >
                            <Trophy className="w-3 h-3" /> Add Player
                        </button>
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
                                        <div className="hidden sm:flex items-center gap-3">
                                            <span className="text-brand-gold font-display font-bold text-lg">{player.rating}</span>
                                            <span className="text-gray-500 text-xs">OVR</span>
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
                                                onClick={(e) => { e.stopPropagation(); setFeedbackRecipient(player.name); }}
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
                        <p className="text-xs text-gray-500 mb-3">2 players missing assignments.</p>
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
