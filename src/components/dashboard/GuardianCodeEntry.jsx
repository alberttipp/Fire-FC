import React, { useState } from 'react';
import { Shield, Loader2, CheckCircle, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';

const GuardianCodeEntry = ({ onSuccess, onClose }) => {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!code.trim()) return;

        setLoading(true);
        setError('');

        try {
            const { data, error: rpcError } = await supabase.rpc('join_player_family', {
                input_code: code.toUpperCase().trim()
            });

            if (rpcError) throw rpcError;

            if (data?.success) {
                setSuccess(data);
                setTimeout(() => {
                    if (onSuccess) onSuccess(data);
                }, 1500);
            } else {
                throw new Error(data?.message || 'Invalid code');
            }
        } catch (err) {
            console.error('Error joining family:', err);
            setError(err.message || 'Invalid or expired code');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="bg-brand-dark border border-brand-green/30 rounded-2xl p-8 text-center">
                <CheckCircle className="w-16 h-16 text-brand-green mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Connected!</h3>
                <p className="text-gray-400">
                    You are now linked to <span className="text-brand-green font-bold">{success.player_name}</span> as their {success.relationship}.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-brand-dark border border-white/10 rounded-2xl p-8 relative">
            {onClose && (
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                    <X className="w-5 h-5" />
                </button>
            )}

            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-brand-green/20 rounded-xl">
                    <Shield className="w-8 h-8 text-brand-green" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white">Link to Your Player</h3>
                    <p className="text-gray-400 text-sm">Enter the guardian code from your coach</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-2">
                        Guardian Code
                    </label>
                    <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="ABC123"
                        maxLength={6}
                        className="w-full bg-black/50 border border-white/10 rounded-lg py-3 px-4 text-white text-center text-2xl font-mono tracking-widest uppercase focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                        disabled={loading}
                    />
                </div>

                {error && (
                    <p className="text-red-400 text-sm text-center">{error}</p>
                )}

                <button
                    type="submit"
                    disabled={loading || code.length < 6}
                    className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Connecting...
                        </>
                    ) : (
                        <>
                            <Shield className="w-5 h-5" />
                            Connect to Player
                        </>
                    )}
                </button>
            </form>

            <p className="text-xs text-gray-500 text-center mt-4">
                Don't have a code? Ask your team's coach or manager.
            </p>
        </div>
    );
};

export default GuardianCodeEntry;
