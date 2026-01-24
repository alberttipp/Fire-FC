import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Rocket, Shield, Users, User, ArrowRight, Lock, UserCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';

const Login = () => {
    // Auth Modes
    const [authMode, setAuthMode] = useState('standard'); // 'standard' (Coach/Parent) or 'player'

    // Standard Auth State
    const [isSignUp, setIsSignUp] = useState(false);
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [joinCode, setJoinCode] = useState('');

    // Player Auth State
    const [playerTeamCode, setPlayerTeamCode] = useState('');
    const [teamRoster, setTeamRoster] = useState(null);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [playerPin, setPlayerPin] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);

    const { signIn, signUp, loginDemo, loginPlayer } = useAuth();
    const navigate = useNavigate();

    // --- Standard Auth Handler ---
    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (isSignUp) {
                const { data, error } = await signUp(email, password, {
                    role: joinCode ? 'parent' : 'coach',
                    full_name: fullName
                });

                if (error) throw error;

                if (joinCode && data?.user) {
                    try {
                        const { data: joinData, error: joinError } = await supabase.rpc('join_team_via_code', {
                            input_code: joinCode
                        });
                        if (joinError) throw joinError;
                    } catch (codeErr) {
                        console.error("Invite Code Error:", codeErr);
                        setError(`Account created, but failed to join team: ${codeErr.message}`);
                    }
                }

                setMessage("Account created! You are now logged in.");
                if (data?.session) navigate('/dashboard');
                else {
                    setMessage("Account created! Please check your email for confirmation.");
                    setIsSignUp(false);
                }

            } else {
                const { data, error } = await signIn(email, password);
                if (error) throw error;

                if (data?.user) {
                    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
                    if (profile?.role === 'parent') navigate('/parent-dashboard');
                    else navigate('/dashboard');
                } else {
                    navigate('/dashboard');
                }
            }
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Player Auth Handlers ---
    const handleFindTeam = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setTeamRoster(null);

        try {
            const { data, error } = await supabase.rpc('get_team_roster_public', {
                input_code: playerTeamCode.toUpperCase()
            });

            if (error) throw error;
            if (!data || data.length === 0) throw new Error("Team not found or no players.");

            setTeamRoster(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePlayerLogin = async (e) => {
        e.preventDefault();
        if (!selectedPlayer || !playerPin) return;

        setLoading(true);
        setError(null);

        try {
            const { data, error } = await loginPlayer(selectedPlayer.id, playerPin);

            if (error) throw error;

            navigate('/player-dashboard');

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const resetPlayerFlow = () => {
        setTeamRoster(null);
        setSelectedPlayer(null);
        setPlayerPin('');
        setError(null);
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative bg-brand-dark overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?q=80&w=2500&auto=format&fit=crop')] bg-cover bg-center opacity-20"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/90 to-transparent"></div>

            <div className="relative z-10 w-full max-w-md p-8 glass-panel border-t-4 border-brand-green animate-fade-in-up">
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-24 h-24 mb-4 filter drop-shadow-[0_0_20px_rgba(204,255,0,0.2)] hover:scale-105 transition-transform duration-500">
                        <img src="/branding/logo.png" alt="Rockford Fire FC" className="w-full h-full object-contain" />
                    </div>
                    <h2 className="text-2xl font-display font-bold text-white tracking-widest uppercase mb-1">
                        Rockford Fire FC
                    </h2>

                    {/* Mode Switcher */}
                    <div className="flex justify-center gap-4mt-2 mb-4">
                        <div className="inline-flex bg-black/40 rounded-full p-1 border border-white/10">
                            <button
                                onClick={() => { setAuthMode('standard'); setError(null); }}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${authMode === 'standard' ? 'bg-brand-green text-brand-dark' : 'text-gray-400 hover:text-white'}`}
                            >
                                Member
                            </button>
                            <button
                                onClick={() => { setAuthMode('player'); setError(null); }}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${authMode === 'player' ? 'bg-brand-green text-brand-dark' : 'text-gray-400 hover:text-white'}`}
                            >
                                Athlete
                            </button>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded mb-6 text-center text-sm animate-pulse-fast">
                        {error}
                    </div>
                )}

                {message && (
                    <div className="bg-green-500/10 border border-green-500 text-green-500 p-3 rounded mb-6 text-center text-sm">
                        {message}
                    </div>
                )}

                {/* --- PLAYER Login Flow --- */}
                {authMode === 'player' && (
                    <div className="space-y-6">
                        {!teamRoster ? (
                            <form onSubmit={handleFindTeam} className="animate-fade-in">
                                <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-2 ml-1">Team Code</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={playerTeamCode}
                                        onChange={(e) => setPlayerTeamCode(e.target.value.toUpperCase())}
                                        className="flex-1 bg-black/50 border border-brand-green/30 rounded p-3 text-white placeholder-gray-600 focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all outline-none font-mono tracking-wider text-center"
                                        placeholder="FIRE-XXXX"
                                        required
                                    />
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="btn-primary px-4 flex items-center justify-center"
                                    >
                                        <ArrowRight className="w-5 h-5" />
                                    </button>
                                </div>
                                <p className="mt-2 text-[10px] text-gray-500 text-center">Ask your coach or manager for the team code.</p>
                            </form>
                        ) : !selectedPlayer ? (
                            <div className="animate-fade-in">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-brand-green text-xs font-bold uppercase tracking-widest ml-1">Select Athlete</label>
                                    <button onClick={resetPlayerFlow} className="text-[10px] text-gray-500 hover:text-white underline">Change Team</button>
                                </div>
                                <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                    {teamRoster.map(player => (
                                        <div
                                            key={player.id}
                                            onClick={() => setSelectedPlayer(player)}
                                            className="bg-white/5 border border-white/10 rounded-lg p-2 flex flex-col items-center justify-center cursor-pointer hover:bg-brand-green/20 hover:border-brand-green transition-all group"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-black/50 overflow-hidden mb-2 border border-white/20 group-hover:border-brand-green">
                                                <img src={player.avatar_url || `https://ui-avatars.com/api/?name=${player.first_name}+${player.last_name}`} alt="Player" className="w-full h-full object-cover" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xs font-bold text-white leading-tight">{player.first_name}</p>
                                                <p className="text-[10px] text-brand-green">#{player.number}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handlePlayerLogin} className="animate-fade-in">
                                <div className="text-center mb-6">
                                    <div className="inline-block relative">
                                        <div className="w-16 h-16 rounded-full bg-brand-green/20 border border-brand-green mx-auto overflow-hidden">
                                            <img src={selectedPlayer.avatar_url} alt="Selected" className="w-full h-full object-cover" />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedPlayer(null)}
                                            className="absolute -top-1 -right-1 bg-black rounded-full p-1 border border-white/20 hover:border-red-500 hover:text-red-500 text-gray-400"
                                        >
                                            <UserCircle className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <h3 className="text-white font-bold mt-2">{selectedPlayer.first_name} {selectedPlayer.last_name}</h3>
                                    <p className="text-xs text-gray-500">#{selectedPlayer.number}</p>
                                </div>

                                <div className="max-w-[200px] mx-auto">
                                    <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-2 ml-1 text-center">Enter PIN</label>
                                    <div className="relative">
                                        <input
                                            type="password"
                                            maxLength={4}
                                            value={playerPin}
                                            onChange={(e) => setPlayerPin(e.target.value)}
                                            className="w-full bg-black/50 border border-brand-green/30 rounded p-3 text-white text-center text-xl tracking-[0.5em] focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all outline-none"
                                            placeholder="••••"
                                            autoFocus
                                            required
                                        />
                                        <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || playerPin.length < 4}
                                    className="w-full mt-6 btn-primary py-3 flex items-center justify-center gap-2 group"
                                >
                                    {loading ? 'Verifying...' : (
                                        <>
                                            Enter Locker Room <Rocket className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                )}

                {/* --- STANDARD Login Flow (Coach/Parent) --- */}
                {authMode === 'standard' && (
                    <form onSubmit={handleAuth} className="space-y-6 animate-fade-in">
                        {isSignUp && (
                            <div>
                                <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-2 ml-1">Full Name</label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded p-3 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all outline-none"
                                    placeholder="Coach Mike"
                                    required
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-2 ml-1">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded p-3 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all outline-none"
                                placeholder="coach@firefc.com"
                                required
                                autoComplete="username"
                            />
                        </div>
                        <div>
                            <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-2 ml-1">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded p-3 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all outline-none"
                                placeholder="Min 6 characters"
                                required
                                autoComplete="current-password"
                            />
                        </div>

                        {isSignUp && (
                            <div>
                                <label className="block text-brand-gold text-xs font-bold uppercase tracking-widest mb-2 ml-1">Join Code (Optional)</label>
                                <input
                                    type="text"
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                    className="w-full bg-black/50 border border-brand-gold/30 rounded p-3 text-brand-gold placeholder-gray-600 focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-all outline-none font-mono tracking-wider"
                                    placeholder="FC-XXXX"
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn-primary py-3 flex items-center justify-center gap-2 group"
                        >
                            {loading ? 'Processing...' : (
                                <>
                                    {isSignUp ? 'Create Account' : 'Enter Club'} <Rocket className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>

                        <div className="mt-4 text-center">
                            <button
                                type="button"
                                onClick={() => setIsSignUp(!isSignUp)}
                                className="text-gray-400 hover:text-brand-green text-sm uppercase tracking-wider underline decoration-brand-green/30 hover:decoration-brand-green underline-offset-4 transition-colors"
                            >
                                {isSignUp ? 'Already have an account? Login' : 'Need an account? Sign Up'}
                            </button>
                        </div>
                    </form>
                )}

                {/* Demo Actions (Footer) */}
                <div className="mt-8 pt-4 border-t border-white/5 text-center opacity-50">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Demo Actions</p>
                    <div className="flex justify-center gap-4 mt-2">
                        <Users
                            className="w-4 h-4 text-white/50 cursor-pointer hover:text-brand-green"
                            title="Team View"
                            onClick={async () => { await loginDemo('coach'); navigate('/dashboard'); }}
                        />
                        <Shield
                            className="w-4 h-4 text-white/50 cursor-pointer hover:text-brand-green"
                            title="Parent View"
                            onClick={async () => { await loginDemo('parent'); navigate('/parent-dashboard'); }}
                        />
                        <div
                            className="w-4 h-4 flex items-center justify-center text-white/50 cursor-pointer hover:text-brand-gold font-bold text-xs border border-white/30 rounded"
                            title="Club Manager"
                            onClick={async () => { await loginDemo('manager'); navigate('/dashboard'); }}
                        >
                            M
                        </div>
                        {/* DEBUG SEED BUTTON */}
                        <div
                            className="w-4 h-4 flex items-center justify-center text-red-500/50 cursor-pointer hover:text-red-500 font-bold text-xs border border-red-500/30 rounded"
                            title="SEED DATA"
                            onClick={async () => {
                                const { seedDemoData } = await import('../seed_data');
                                await seedDemoData();
                            }}
                        >
                            !
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
