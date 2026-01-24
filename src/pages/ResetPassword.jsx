import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useToast } from '../components/Toast';
import { isValidEmail, isValidPassword } from '../utils/validation';
import { Mail, Lock, ArrowLeft, CheckCircle, KeyRound } from 'lucide-react';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const toast = useToast();

    // Determine mode: 'request' (ask for email) or 'update' (set new password)
    const [mode, setMode] = useState('request');
    
    // Form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [errors, setErrors] = useState({});

    // Check if we have a recovery token (user clicked email link)
    useEffect(() => {
        const checkRecoveryToken = async () => {
            // Supabase redirects with hash params after email link click
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const accessToken = hashParams.get('access_token');
            const type = hashParams.get('type');

            if (accessToken && type === 'recovery') {
                setMode('update');
                // Set the session with the recovery token
                const { error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: hashParams.get('refresh_token') || '',
                });
                if (error) {
                    toast.error('Invalid or expired reset link. Please try again.');
                    setMode('request');
                }
            }
        };

        checkRecoveryToken();
    }, []);

    // Handle password reset request (send email)
    const handleRequestReset = async (e) => {
        e.preventDefault();
        setErrors({});

        // Validate email
        if (!email.trim()) {
            setErrors({ email: 'Email is required' });
            return;
        }
        if (!isValidEmail(email)) {
            setErrors({ email: 'Please enter a valid email address' });
            return;
        }

        setLoading(true);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });

            if (error) throw error;

            setSuccess(true);
            toast.success('Reset link sent! Check your email.');
        } catch (error) {
            toast.error(error.message || 'Failed to send reset email');
        } finally {
            setLoading(false);
        }
    };

    // Handle setting new password
    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        setErrors({});

        // Validate passwords
        const newErrors = {};
        if (!password) {
            newErrors.password = 'Password is required';
        } else if (!isValidPassword(password)) {
            newErrors.password = 'Password must be at least 6 characters';
        }
        if (password !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({ password });

            if (error) throw error;

            toast.success('Password updated successfully!');
            
            // Sign out and redirect to login
            await supabase.auth.signOut();
            setTimeout(() => navigate('/login'), 1500);
        } catch (error) {
            toast.error(error.message || 'Failed to update password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative bg-brand-dark overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?q=80&w=2500&auto=format&fit=crop')] bg-cover bg-center opacity-20"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/90 to-transparent"></div>

            <div className="relative z-10 w-full max-w-md p-8 glass-panel border-t-4 border-brand-green animate-fade-in-up">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-brand-green/10 border border-brand-green/30">
                        <KeyRound className="w-8 h-8 text-brand-green" />
                    </div>
                    <h2 className="text-2xl font-display font-bold text-white tracking-widest uppercase mb-1">
                        {mode === 'request' ? 'Reset Password' : 'New Password'}
                    </h2>
                    <p className="text-gray-400 text-sm">
                        {mode === 'request' 
                            ? "Enter your email and we'll send you a reset link"
                            : "Enter your new password below"
                        }
                    </p>
                </div>

                {/* Success State (after email sent) */}
                {success && mode === 'request' && (
                    <div className="text-center py-8 animate-fade-in">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                            <CheckCircle className="w-8 h-8 text-green-400" />
                        </div>
                        <h3 className="text-white font-bold mb-2">Check Your Email</h3>
                        <p className="text-gray-400 text-sm mb-6">
                            We sent a password reset link to<br />
                            <span className="text-white font-medium">{email}</span>
                        </p>
                        <button
                            onClick={() => navigate('/login')}
                            className="text-brand-green text-sm underline hover:text-white transition-colors"
                        >
                            Back to Login
                        </button>
                    </div>
                )}

                {/* Request Reset Form */}
                {!success && mode === 'request' && (
                    <form onSubmit={handleRequestReset} className="space-y-6">
                        <div>
                            <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-2 ml-1">
                                Email Address
                            </label>
                            <div className="relative">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className={`w-full bg-black/50 border rounded p-3 pl-10 text-white focus:ring-1 transition-all outline-none ${
                                        errors.email 
                                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                                            : 'border-white/10 focus:border-brand-green focus:ring-brand-green'
                                    }`}
                                    placeholder="your@email.com"
                                />
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            </div>
                            {errors.email && (
                                <p className="text-red-400 text-xs mt-1 ml-1">{errors.email}</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn-primary py-3 flex items-center justify-center gap-2"
                        >
                            {loading ? 'Sending...' : 'Send Reset Link'}
                        </button>

                        <button
                            type="button"
                            onClick={() => navigate('/login')}
                            className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" /> Back to Login
                        </button>
                    </form>
                )}

                {/* Update Password Form */}
                {mode === 'update' && (
                    <form onSubmit={handleUpdatePassword} className="space-y-6">
                        <div>
                            <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-2 ml-1">
                                New Password
                            </label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={`w-full bg-black/50 border rounded p-3 pl-10 text-white focus:ring-1 transition-all outline-none ${
                                        errors.password 
                                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                                            : 'border-white/10 focus:border-brand-green focus:ring-brand-green'
                                    }`}
                                    placeholder="Min 6 characters"
                                />
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            </div>
                            {errors.password && (
                                <p className="text-red-400 text-xs mt-1 ml-1">{errors.password}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-2 ml-1">
                                Confirm Password
                            </label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className={`w-full bg-black/50 border rounded p-3 pl-10 text-white focus:ring-1 transition-all outline-none ${
                                        errors.confirmPassword 
                                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                                            : 'border-white/10 focus:border-brand-green focus:ring-brand-green'
                                    }`}
                                    placeholder="Re-enter password"
                                />
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            </div>
                            {errors.confirmPassword && (
                                <p className="text-red-400 text-xs mt-1 ml-1">{errors.confirmPassword}</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn-primary py-3 flex items-center justify-center gap-2"
                        >
                            {loading ? 'Updating...' : 'Update Password'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ResetPassword;
