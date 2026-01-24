import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { RefreshCw, Link, Users, User, Database, CheckCircle, AlertTriangle } from 'lucide-react';

const DebugStatus = () => {
    const { user, profile } = useAuth();
    const [teams, setTeams] = useState([]);
    const [players, setPlayers] = useState([]);
    const [profiles, setProfiles] = useState([]);
    const [myProfile, setMyProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    const fetchData = async () => {
        setLoading(true);
        setMessage('');

        // Fetch all teams
        const { data: teamsData, error: teamsErr } = await supabase
            .from('teams')
            .select('*')
            .order('name');
        
        if (teamsErr) console.error('Teams error:', teamsErr);
        setTeams(teamsData || []);

        // Fetch all players
        const { data: playersData, error: playersErr } = await supabase
            .from('players')
            .select('*, teams(name)')
            .order('last_name');
        
        if (playersErr) console.error('Players error:', playersErr);
        setPlayers(playersData || []);

        // Fetch all profiles
        const { data: profilesData, error: profilesErr } = await supabase
            .from('profiles')
            .select('*')
            .order('full_name');
        
        if (profilesErr) console.error('Profiles error:', profilesErr);
        setProfiles(profilesData || []);

        // Get MY profile
        if (user?.id) {
            const { data: myData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            setMyProfile(myData);
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [user]);

    // Link current user as coach of a team
    const linkMeToTeam = async (teamId) => {
        if (!user?.id) return;

        setMessage('Linking...');

        // Update the team's coach_id
        const { error: teamErr } = await supabase
            .from('teams')
            .update({ coach_id: user.id })
            .eq('id', teamId);

        // Update my profile's team_id
        const { error: profileErr } = await supabase
            .from('profiles')
            .update({ team_id: teamId, role: 'coach' })
            .eq('id', user.id);

        if (teamErr || profileErr) {
            setMessage(`❌ Error: ${teamErr?.message || profileErr?.message}`);
        } else {
            setMessage('✅ Successfully linked! Refresh the page and go to Teams.');
            fetchData();
        }
    };

    // Set a profile as coach role
    const makeCoach = async (profileId, teamId) => {
        const { error } = await supabase
            .from('profiles')
            .update({ role: 'coach', team_id: teamId })
            .eq('id', profileId);

        if (error) {
            setMessage(`❌ Error: ${error.message}`);
        } else {
            setMessage('✅ Updated!');
            fetchData();
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <RefreshCw className="w-8 h-8 animate-spin text-brand-green" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white p-6">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-bold text-brand-green flex items-center gap-3">
                        <Database className="w-8 h-8" /> Database Status
                    </h1>
                    <button 
                        onClick={fetchData}
                        className="px-4 py-2 bg-brand-green text-black font-bold rounded flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" /> Refresh
                    </button>
                </div>

                {message && (
                    <div className={`mb-4 p-4 rounded ${message.includes('✅') ? 'bg-green-900/50 border border-green-500' : 'bg-red-900/50 border border-red-500'}`}>
                        {message}
                    </div>
                )}

                {/* YOUR STATUS */}
                <div className="bg-gray-900 rounded-xl p-6 mb-6 border border-gray-700">
                    <h2 className="text-xl font-bold text-brand-gold mb-4 flex items-center gap-2">
                        <User className="w-5 h-5" /> Your Account
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-gray-400 text-sm">Auth Email</p>
                            <p className="text-white font-mono">{user?.email || 'Not logged in'}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-sm">User ID</p>
                            <p className="text-white font-mono text-xs">{user?.id || '—'}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-sm">Profile Name</p>
                            <p className="text-white">{myProfile?.full_name || '—'}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-sm">Role</p>
                            <p className={`font-bold ${myProfile?.role === 'coach' ? 'text-brand-green' : myProfile?.role === 'manager' ? 'text-brand-gold' : 'text-gray-400'}`}>
                                {myProfile?.role || 'None'}
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-sm">Team ID (in profile)</p>
                            <p className={myProfile?.team_id ? 'text-green-400' : 'text-red-400'}>
                                {myProfile?.team_id || '❌ NOT LINKED'}
                            </p>
                        </div>
                    </div>

                    {!myProfile?.team_id && teams.length > 0 && (
                        <div className="mt-4 p-4 bg-yellow-900/30 border border-yellow-600 rounded">
                            <p className="text-yellow-400 font-bold mb-2">⚠️ Your profile is not linked to a team!</p>
                            <p className="text-sm text-gray-300 mb-3">Click a team below to link yourself as coach:</p>
                            <div className="flex flex-wrap gap-2">
                                {teams.map(team => (
                                    <button
                                        key={team.id}
                                        onClick={() => linkMeToTeam(team.id)}
                                        className="px-3 py-2 bg-brand-green text-black font-bold text-sm rounded flex items-center gap-2 hover:bg-green-400"
                                    >
                                        <Link className="w-4 h-4" /> Link to "{team.name}"
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* TEAMS */}
                <div className="bg-gray-900 rounded-xl p-6 mb-6 border border-gray-700">
                    <h2 className="text-xl font-bold text-brand-gold mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5" /> Teams ({teams.length})
                    </h2>
                    
                    {teams.length === 0 ? (
                        <p className="text-red-400">❌ No teams found in database!</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-400 border-b border-gray-700">
                                        <th className="pb-2">Name</th>
                                        <th className="pb-2">Age Group</th>
                                        <th className="pb-2">Join Code</th>
                                        <th className="pb-2">Coach ID</th>
                                        <th className="pb-2">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {teams.map(team => (
                                        <tr key={team.id} className="border-b border-gray-800">
                                            <td className="py-3 font-bold text-white">{team.name}</td>
                                            <td className="py-3 text-gray-300">{team.age_group || '—'}</td>
                                            <td className="py-3 font-mono text-brand-green">{team.join_code || '—'}</td>
                                            <td className="py-3 font-mono text-xs text-gray-500">
                                                {team.coach_id ? team.coach_id.substring(0, 8) + '...' : '—'}
                                            </td>
                                            <td className="py-3">
                                                {team.coach_id === user?.id ? (
                                                    <span className="text-green-400 flex items-center gap-1">
                                                        <CheckCircle className="w-4 h-4" /> You're Coach
                                                    </span>
                                                ) : team.coach_id ? (
                                                    <span className="text-gray-400">Has Coach</span>
                                                ) : (
                                                    <button
                                                        onClick={() => linkMeToTeam(team.id)}
                                                        className="text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
                                                    >
                                                        <AlertTriangle className="w-4 h-4" /> Claim as Coach
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* PLAYERS */}
                <div className="bg-gray-900 rounded-xl p-6 mb-6 border border-gray-700">
                    <h2 className="text-xl font-bold text-brand-gold mb-4">
                        Players ({players.length})
                    </h2>
                    
                    {players.length === 0 ? (
                        <p className="text-gray-400">No players found.</p>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {players.map(player => (
                                <div key={player.id} className="bg-black/50 p-3 rounded border border-gray-800">
                                    <p className="font-bold text-white text-sm">{player.first_name} {player.last_name}</p>
                                    <p className="text-xs text-gray-400">#{player.number || '?'}</p>
                                    <p className="text-xs text-brand-green">{player.teams?.name || 'No team'}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* PROFILES */}
                <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
                    <h2 className="text-xl font-bold text-brand-gold mb-4">
                        Profiles ({profiles.length})
                    </h2>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-400 border-b border-gray-700">
                                    <th className="pb-2">Name</th>
                                    <th className="pb-2">Email</th>
                                    <th className="pb-2">Role</th>
                                    <th className="pb-2">Team ID</th>
                                </tr>
                            </thead>
                            <tbody>
                                {profiles.map(p => (
                                    <tr key={p.id} className={`border-b border-gray-800 ${p.id === user?.id ? 'bg-brand-green/10' : ''}`}>
                                        <td className="py-2 text-white">{p.full_name || '—'} {p.id === user?.id && <span className="text-brand-green">(You)</span>}</td>
                                        <td className="py-2 text-gray-400">{p.email || '—'}</td>
                                        <td className="py-2">
                                            <span className={`px-2 py-0.5 rounded text-xs ${
                                                p.role === 'coach' ? 'bg-green-900 text-green-400' :
                                                p.role === 'manager' ? 'bg-yellow-900 text-yellow-400' :
                                                p.role === 'player' ? 'bg-blue-900 text-blue-400' :
                                                'bg-gray-800 text-gray-400'
                                            }`}>
                                                {p.role || 'none'}
                                            </span>
                                        </td>
                                        <td className="py-2 font-mono text-xs text-gray-500">
                                            {p.team_id ? p.team_id.substring(0, 8) + '...' : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <p className="text-center text-gray-600 mt-8 text-sm">
                    Go to <a href="/login" className="text-brand-green underline">/login</a> to access the app, 
                    or <a href="/" className="text-brand-green underline">Dashboard</a> after linking.
                </p>
            </div>
        </div>
    );
};

export default DebugStatus;
