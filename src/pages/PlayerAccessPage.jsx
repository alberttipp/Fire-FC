import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Loader2, CheckCircle, XCircle, Rocket } from 'lucide-react';

const PlayerAccessPage = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const { loginWithToken } = useAuth();

    const [status, setStatus] = useState('verifying'); // 'verifying', 'ready', 'error', 'logging_in'
    const [player, setPlayer] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (token) {
            verifyToken();
        } else {
            setStatus('error');
            setError('No access token provided');
        }
    }, [token]);

    const verifyToken = async () => {
        try {
            const { data, error } = await supabase.rpc('verify_player_access_token', {
                p_token: token
            });

            if (error) throw error;

            if (data?.success) {
                setPlayer(data.player);
                setStatus('ready');
            } else {
                setStatus('error');
                setError(data?.message || 'Invalid or expired link');
            }
        } catch (err) {
            console.error('Token verification error:', err);
            setStatus('error');
            setError('Could not verify access link. It may be expired or invalid.');
        }
    };

    const handleEnter = async () => {
        if (!player) return;

        setStatus('logging_in');

        try {
            await loginWithToken(player);
            navigate('/player-dashboard');
        } catch (err) {
            console.error('Login error:', err);
            setStatus('error');
            setError('Failed to log in. Please try again.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative bg-brand-dark overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?q=80&w=2500&auto=format&fit=crop')] bg-cover bg-center opacity-20"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/90 to-transparent"></div>

            <div className="relative z-10 w-full max-w-md p-8 glass-panel border-t-4 border-brand-gold animate-fade-in-up">
                {/* Logo */}
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-20 h-20 mb-4 filter drop-shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                        <img src="/branding/logo.png" alt="Rockford Fire FC" className="w-full h-full object-contain" />
                    </div>
                    <h2 className="text-xl font-display font-bold text-white tracking-widest uppercase">
                        Player Access
                    </h2>
                </div>

                {/* Verifying State */}
                {status === 'verifying' && (
                    <div className="text-center py-12">
                        <Loader2 className="w-12 h-12 animate-spin text-brand-gold mx-auto mb-4" />
                        <p className="text-gray-400">Verifying your access link...</p>
                    </div>
                )}

                {/* Ready State - Show player and enter button */}
                {status === 'ready' && player && (
                    <div className="text-center space-y-6 animate-fade-in">
                        <div className="relative inline-block">
                            <div className="w-24 h-24 rounded-full bg-gray-800 overflow-hidden mx-auto border-4 border-brand-gold shadow-[0_0_30px_rgba(251,191,36,0.3)]">
                                <img
                                    src={player.avatar_url || '/branding/logo.png'}
                                    alt={player.first_name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-brand-gold rounded-full flex items-center justify-center text-brand-dark font-bold text-sm border-2 border-brand-dark">
                                #{player.jersey_number || '00'}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-2xl text-white font-bold">
                                {player.first_name} {player.last_name}
                            </h3>
                            <p className="text-gray-400 text-sm mt-1">
                                {player.team_name || 'Fire FC'} • {player.position || 'Player'}
                            </p>
                        </div>

                        <div className="flex items-center justify-center gap-2 text-brand-green text-sm">
                            <CheckCircle className="w-4 h-4" />
                            <span>Access verified</span>
                        </div>

                        <button
                            onClick={handleEnter}
                            className="w-full btn-primary py-4 flex items-center justify-center gap-3 group text-lg bg-brand-gold hover:bg-yellow-400"
                        >
                            Enter Locker Room
                            <Rocket className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>

                        <p className="text-xs text-gray-500">
                            This link was created by your parent/guardian
                        </p>
                    </div>
                )}

                {/* Logging In State */}
                {status === 'logging_in' && (
                    <div className="text-center py-12">
                        <Loader2 className="w-12 h-12 animate-spin text-brand-green mx-auto mb-4" />
                        <p className="text-white font-bold">Entering locker room...</p>
                    </div>
                )}

                {/* Error State */}
                {status === 'error' && (
                    <div className="text-center space-y-6 animate-fade-in">
                        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
                            <XCircle className="w-8 h-8 text-red-400" />
                        </div>

                        <div>
                            <h3 className="text-xl text-white font-bold mb-2">Access Denied</h3>
                            <p className="text-gray-400 text-sm">{error}</p>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-white font-bold transition-all"
                            >
                                Go to Login
                            </button>
                            <p className="text-xs text-gray-500">
                                Ask your parent to generate a new access link
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlayerAccessPage;
