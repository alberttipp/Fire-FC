import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Users, User, ChevronRight, Loader2, Eye } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

// PreviewPickerModal — replaces the old "View as Player" link.
//
// Flow: Team → Player → Role.  After the user picks, we navigate to the
// dashboard for that role with ?preview=<player_id>&previewRole=<role>.
// Parent/Player dashboards read those params and pull the previewed
// player's data instead of the auth-linked one. RLS still applies — the
// manager/coach already has staff access to all team data, so the queries
// work; we just point them at a different player_id than usual.
//
// Used by Dashboard.jsx (manager/coach view) — not exposed to parents.

const PreviewPickerModal = ({ onClose }) => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [step, setStep] = useState(1); // 1 = team, 2 = player, 3 = role
    const [teams, setTeams] = useState([]);
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [selectedTeam, setSelectedTeam] = useState(null);
    const [selectedPlayer, setSelectedPlayer] = useState(null);

    // Load teams the current user is staff on (coach or manager).
    useEffect(() => {
        const fetchTeams = async () => {
            if (!user?.id) return;
            setLoading(true);
            setError(null);
            try {
                const { data, error: err } = await supabase
                    .from('team_memberships')
                    .select('team_id, role, teams(id, name, age_group, season)')
                    .eq('user_id', user.id)
                    .in('role', ['coach', 'manager', 'head_coach', 'assistant_coach', 'team_manager']);

                if (err) throw err;

                const list = (data || [])
                    .map((m) => ({
                        id: m.teams?.id,
                        name: m.teams?.name,
                        age_group: m.teams?.age_group,
                        season: m.teams?.season,
                        role: m.role,
                    }))
                    .filter((t) => t.id);

                // De-dup if a user is on a team in multiple roles
                const seen = new Set();
                const unique = list.filter((t) => (seen.has(t.id) ? false : seen.add(t.id)));
                setTeams(unique);
            } catch (e) {
                console.error('Preview picker teams error:', e);
                setError("Couldn't load teams. Try again.");
            } finally {
                setLoading(false);
            }
        };
        fetchTeams();
    }, [user?.id]);

    const handlePickTeam = async (team) => {
        setSelectedTeam(team);
        setStep(2);
        setLoading(true);
        setError(null);
        try {
            const { data, error: err } = await supabase
                .from('players')
                .select('id, first_name, last_name, display_name, jersey_number, position, user_id')
                .eq('team_id', team.id)
                .order('first_name', { ascending: true });
            if (err) throw err;
            setPlayers(data || []);
        } catch (e) {
            console.error('Preview picker players error:', e);
            setError("Couldn't load players. Try again.");
        } finally {
            setLoading(false);
        }
    };

    const handlePickPlayer = (player) => {
        setSelectedPlayer(player);
        setStep(3);
    };

    const handlePickRole = (role) => {
        if (!selectedPlayer) return;
        const path = role === 'player' ? '/player-dashboard' : '/parent-dashboard';
        navigate(`${path}?preview=${selectedPlayer.id}&previewRole=${role}`);
        onClose();
    };

    const goBack = () => {
        if (step === 3) setStep(2);
        else if (step === 2) {
            setStep(1);
            setSelectedTeam(null);
            setPlayers([]);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
        >
            <div
                className="bg-brand-dark border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-5 border-b border-white/10 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-gold/20 flex items-center justify-center">
                        <Eye className="w-5 h-5 text-brand-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold text-base">Preview as…</h3>
                        <p className="text-gray-400 text-xs">
                            {step === 1 && 'Pick a team'}
                            {step === 2 && `Pick a player on ${selectedTeam?.name}`}
                            {step === 3 && `Choose a view for ${selectedPlayer?.display_name || selectedPlayer?.first_name}`}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1 -m-1 text-gray-500 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    {loading && (
                        <div className="p-10 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 text-brand-green animate-spin" />
                        </div>
                    )}

                    {!loading && error && (
                        <div className="p-6 text-center">
                            <p className="text-red-300 text-sm mb-3">{error}</p>
                        </div>
                    )}

                    {!loading && !error && step === 1 && (
                        <div className="p-3 space-y-2">
                            {teams.length === 0 ? (
                                <p className="p-6 text-center text-gray-500 text-sm">
                                    You're not staff on any team yet.
                                </p>
                            ) : (
                                teams.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => handlePickTeam(t)}
                                        className="w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-brand-green/30 flex items-center gap-3 transition-colors text-left"
                                    >
                                        <Users className="w-5 h-5 text-brand-green shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-bold truncate">{t.name}</p>
                                            <p className="text-xs text-gray-500 truncate">
                                                {[t.age_group, t.season].filter(Boolean).join(' · ')}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-gray-500" />
                                    </button>
                                ))
                            )}
                        </div>
                    )}

                    {!loading && !error && step === 2 && (
                        <div className="p-3 space-y-2">
                            {players.length === 0 ? (
                                <p className="p-6 text-center text-gray-500 text-sm">
                                    No players on this team yet.
                                </p>
                            ) : (
                                players.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => handlePickPlayer(p)}
                                        className="w-full p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-brand-green/30 flex items-center gap-3 transition-colors text-left"
                                    >
                                        <div className="w-9 h-9 rounded-full bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center shrink-0">
                                            <span className="text-brand-gold text-xs font-bold">
                                                #{p.jersey_number ?? '?'}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-bold truncate">
                                                {p.display_name || `${p.first_name} ${p.last_name}`}
                                            </p>
                                            <p className="text-xs text-gray-500">{p.position || 'Position TBD'}</p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-gray-500" />
                                    </button>
                                ))
                            )}
                        </div>
                    )}

                    {!loading && !error && step === 3 && (
                        <div className="p-4 space-y-3">
                            <button
                                onClick={() => handlePickRole('parent')}
                                className="w-full p-4 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 hover:border-blue-500/50 flex items-center gap-3 transition-colors text-left"
                            >
                                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-blue-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-bold">Parent view</p>
                                    <p className="text-xs text-gray-400">
                                        See what {selectedPlayer?.first_name}'s parents see.
                                    </p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-500" />
                            </button>

                            <button
                                onClick={() => handlePickRole('player')}
                                className="w-full p-4 rounded-xl bg-brand-gold/10 hover:bg-brand-gold/20 border border-brand-gold/30 hover:border-brand-gold/50 flex items-center gap-3 transition-colors text-left"
                            >
                                <div className="w-10 h-10 rounded-full bg-brand-gold/20 flex items-center justify-center">
                                    <User className="w-5 h-5 text-brand-gold" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-bold">Player view</p>
                                    <p className="text-xs text-gray-400">
                                        See what {selectedPlayer?.first_name} sees.
                                    </p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step > 1 && (
                    <div className="border-t border-white/10 p-3 flex justify-start">
                        <button
                            onClick={goBack}
                            className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                        >
                            ← Back
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PreviewPickerModal;
