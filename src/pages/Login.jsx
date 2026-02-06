import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { isValidEmail, isValidPassword, isValidName, isValidPin } from '../utils/validation';
import { Rocket, Shield, Users, User, ArrowRight, Lock, UserCircle, Mail } from 'lucide-react';
import { supabase } from '../supabaseClient';

const Login = () => {
    const toast = useToast();
    const navigate = useNavigate();
    const { signIn, signUp, loginDemo, loginPlayer } = useAuth();

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
    const [errors, setErrors] = useState({});

    // Clear errors when switching modes
    const switchAuthMode = (mode) => {
        setAuthMode(mode);
        setErrors({});
    };

    // --- Validation ---
    const validateStandardForm = () => {
        const newErrors = {};

        if (!email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!isValidEmail(email)) {
            newErrors.email = 'Please enter a valid email';
        }

        if (!password) {
            newErrors.password = 'Password is required';
        } else if (isSignUp && !isValidPassword(password)) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        if (isSignUp) {
            if (!fullName.trim()) {
                newErrors.fullName = 'Name is required';
            } else if (!isValidName(fullName)) {
                newErrors.fullName = 'Please enter a valid name';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validatePlayerPin = () => {
        if (!isValidPin(playerPin)) {
            setErrors({ playerPin: 'PIN must be 4 digits' });
            return false;
        }
        setErrors({});
        return true;
    };

    // --- Standard Auth Handler ---
    const handleAuth = async (e) => {
        e.preventDefault();
        
        if (!validateStandardForm()) return;

        setLoading(true);

        try {
            if (isSignUp) {
                const { data, error } = await signUp(email, password, {
                    role: joinCode ? 'parent' : 'coach',
                    full_name: fullName.trim()
                });

                if (error) throw error;

                if (joinCode && data?.user) {
                    try {
                        const { error: joinError } = await supabase.rpc('join_team_via_code', {
                            input_code: joinCode
                        });
                        if (joinError) throw joinError;
                    } catch (codeErr) {
                        console.error("Invite Code Error:", codeErr);
                        toast.warning(`Account created, but failed to join team: ${codeErr.message}`);
                    }
                }

                toast.success("Account created! Welcome to Fire FC!");
                if (data?.session) navigate('/dashboard');
                else {
                    toast.info("Please check your email to confirm your account.");
                    setIsSignUp(false);
                }

            } else {
                const { data, error } = await signIn(email, password);
                if (error) throw error;

                toast.success("Welcome back!");

                if (data?.user) {
                    // Check role from user_metadata (not profiles table)
                    const userRole = data.user.user_metadata?.role;
                    if (userRole === 'parent') navigate('/parent-dashboard');
                    else navigate('/dashboard');
                } else {
                    navigate('/dashboard');
                }
            }
        } catch (error) {
            toast.error(error.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    // --- Player Auth Handlers ---
    const handleFindTeam = async (e) => {
        e.preventDefault();
        
        if (!playerTeamCode.trim()) {
            setErrors({ teamCode: 'Team code is required' });
            return;
        }

        setLoading(true);
        setErrors({});
        setTeamRoster(null);

        try {
            const { data, error } = await supabase.rpc('get_team_roster_public', {
                input_code: playerTeamCode.toUpperCase()
            });

            if (error) throw error;
            if (!data || data.length === 0) throw new Error("Team not found or no players.");

            setTeamRoster(data);
            toast.success("Team found! Select your name.");
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePlayerLogin = async (e) => {
        e.preventDefault();
        if (!selectedPlayer) return;
        if (!validatePlayerPin()) return;

        setLoading(true);

        try {
            const { data, error } = await loginPlayer(selectedPlayer.id, playerPin);

            if (error) throw error;

            toast.success(`Welcome, ${selectedPlayer.first_name}!`);
            navigate('/player-dashboard');

        } catch (err) {
            toast.error(err.message || 'Invalid PIN');
        } finally {
            setLoading(false);
        }
    };

    const resetPlayerFlow = () => {
        setTeamRoster(null);
        setSelectedPlayer(null);
        setPlayerPin('');
        setErrors({});
    };

    // Input class helper
    const inputClass = (fieldName) => `
        w-full bg-black/50 border rounded p-3 text-white 
        focus:ring-1 transition-all outline-none
        ${errors[fieldName] 
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
            : 'border-white/10 focus:border-brand-green focus:ring-brand-green'
        }
    `;

    return (
        <div className="min-h-screen flex items-center justify-center relative bg-brand-dark overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?q=80&w=2500&auto=format&fit=crop')] bg-cover bg-center opacity-20"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/90 to-transparent"></div>

            <div className="relative z-10 w-full max-w-md p-8 glass-panel border-t-4 border-brand-green animate-fade-in-up">
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-24 h-24 mb-4 filter drop-shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:scale-105 transition-transform duration-500">
                        <img src="/branding/logo.png" alt="Rockford Fire FC" className="w-full h-full object-contain" />
                    </div>
                    <h2 className="text-2xl font-display font-bold text-white tracking-widest uppercase mb-1">
                        Rockford Fire FC
                    </h2>

                    {/* Mode Switcher */}
                    <div className="flex justify-center mt-2 mb-4">
                        <div className="inline-flex bg-black/40 rounded-full p-1 border border-white/10">
                            <button
                                onClick={() => switchAuthMode('standard')}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${authMode === 'standard' ? 'bg-brand-green text-brand-dark' : 'text-gray-400 hover:text-white'}`}
                            >
                                Member
                            </button>
                            <button
                                onClick={() => switchAuthMode('player')}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${authMode === 'player' ? 'bg-brand-gold text-brand-dark' : 'text-gray-400 hover:text-white'}`}
                            >
                                Player
                            </button>
                        </div>
                    </div>
                </div>

                {/* --- PLAYER Login Flow --- */}
                {authMode === 'player' && (
                    <div className="animate-fade-in text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-brand-gold/20 flex items-center justify-center mx-auto border-2 border-brand-gold">
                            <User className="w-10 h-10 text-brand-gold" />
                        </div>

                        <div>
                            <h3 className="text-xl text-white font-bold mb-2">Player Access</h3>
                            <p className="text-gray-400 text-sm">
                                Ask your parent to send you an access link from their Fire FC app.
                            </p>
                        </div>

                        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                            <p className="text-xs text-gray-500 mb-3">How it works:</p>
                            <ol className="text-left text-sm text-gray-400 space-y-2">
                                <li className="flex items-start gap-2">
                                    <span className="w-5 h-5 rounded-full bg-brand-gold/20 text-brand-gold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                                    <span>Your parent logs into their dashboard</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="w-5 h-5 rounded-full bg-brand-gold/20 text-brand-gold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                                    <span>They click "Generate Access Link" on your profile</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="w-5 h-5 rounded-full bg-brand-gold/20 text-brand-gold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                                    <span>They share the link with you via text or email</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="w-5 h-5 rounded-full bg-brand-gold/20 text-brand-gold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                                    <span>Click the link to enter your locker room!</span>
                                </li>
                            </ol>
                        </div>

                        <p className="text-xs text-gray-600">
                            Already have a link? Just click it to sign in automatically.
                        </p>
                    </div>
                )}

                {/* --- STANDARD Login Flow (Coach/Parent) --- */}
                {authMode === 'standard' && (
                    <form onSubmit={handleAuth} className="space-y-5 animate-fade-in">
                        {isSignUp && (
                            <div>
                                <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-2 ml-1">Full Name</label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className={inputClass('fullName')}
                                    placeholder="Coach Mike"
                                />
                                {errors.fullName && (
                                    <p className="text-red-400 text-xs mt-1 ml-1">{errors.fullName}</p>
                                )}
                            </div>
                        )}
                        
                        <div>
                            <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-2 ml-1">Email Address</label>
                            <div className="relative">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className={`${inputClass('email')} pl-10`}
                                    placeholder="coach@firefc.com"
                                    autoComplete="username"
                                />
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            </div>
                            {errors.email && (
                                <p className="text-red-400 text-xs mt-1 ml-1">{errors.email}</p>
                            )}
                        </div>
                        
                        <div>
                            <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-2 ml-1">Password</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={`${inputClass('password')} pl-10`}
                                    placeholder="Min 6 characters"
                                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                                />
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            </div>
                            {errors.password && (
                                <p className="text-red-400 text-xs mt-1 ml-1">{errors.password}</p>
                            )}
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

                        {/* Forgot Password Link */}
                        {!isSignUp && (
                            <div className="text-center">
                                <Link
                                    to="/reset-password"
                                    className="text-gray-500 hover:text-brand-green text-xs uppercase tracking-wider transition-colors"
                                >
                                    Forgot Password?
                                </Link>
                            </div>
                        )}

                        <div className="text-center pt-2">
                            <button
                                type="button"
                                onClick={() => { setIsSignUp(!isSignUp); setErrors({}); }}
                                className="text-gray-400 hover:text-brand-green text-sm uppercase tracking-wider underline decoration-brand-green/30 hover:decoration-brand-green underline-offset-4 transition-colors"
                            >
                                {isSignUp ? 'Already have an account? Login' : 'Need an account? Sign Up'}
                            </button>
                        </div>
                    </form>
                )}

                {/* Demo Quick Access - DISABLED FOR PROD */}
                {/* Uncomment for local dev testing only */}
                {/* <div className="mt-6 pt-6 border-t-2 border-brand-green/30">
                    <p className="text-sm text-brand-green font-bold uppercase tracking-widest mb-4 text-center">Quick Demo Access</p>
                    <div className="grid grid-cols-4 gap-2">
                        <button
                            onClick={async () => { await loginDemo('coach'); navigate('/dashboard'); }}
                            className="py-3 px-2 bg-brand-green/20 hover:bg-brand-green/40 border border-brand-green rounded-lg text-brand-green font-bold text-sm transition-all"
                        >
                            Coach
                        </button>
                        <button
                            onClick={async () => { await loginDemo('parent'); navigate('/parent-dashboard'); }}
                            className="py-3 px-2 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500 rounded-lg text-blue-400 font-bold text-sm transition-all"
                        >
                            Parent
                        </button>
                        <button
                            onClick={async () => { await loginDemo('manager'); navigate('/dashboard'); }}
                            className="py-3 px-2 bg-brand-gold/20 hover:bg-brand-gold/40 border border-brand-gold rounded-lg text-brand-gold font-bold text-sm transition-all"
                        >
                            Manager
                        </button>
                        <button
                            onClick={async () => { await loginDemo('player'); navigate('/player-dashboard'); }}
                            className="py-3 px-2 bg-orange-500/20 hover:bg-orange-500/40 border border-orange-500 rounded-lg text-orange-400 font-bold text-sm transition-all"
                        >
                            Player
                        </button>
                    </div>
                </div> */}
            </div>
        </div>
    );
};

export default Login;
