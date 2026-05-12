import React, { useState } from 'react';
import { Shield, Loader2, CheckCircle, X, User, Phone, Heart } from 'lucide-react';
import { supabase } from '../../supabaseClient';

// Two-step "Link to Your Player" form:
//   1) Enter the 6-char guardian code (validated against players.guardian_code)
//   2) Tell us about yourself: relationship, full name, phone
//
// Both steps submit through join_player_family() which now accepts the
// profile fields in the same RPC call. We split into two screens for UX,
// but the second screen just calls the same RPC again — the function
// upserts the profile fields onto the existing family_members row.
const GuardianCodeEntry = ({ onSuccess, onClose }) => {
    const [step, setStep] = useState('code'); // 'code' | 'profile' | 'done'
    const [code, setCode] = useState('');
    const [playerName, setPlayerName] = useState('');
    const [playerId, setPlayerId] = useState(null);

    const [relationship, setRelationship] = useState('');
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const RELATIONSHIPS = ['Mom', 'Dad', 'Step-parent', 'Guardian', 'Grandparent', 'Other'];

    const submitCode = async (e) => {
        e.preventDefault();
        if (!code.trim()) return;
        setLoading(true);
        setError('');

        try {
            const { data, error: rpcError } = await supabase.rpc('join_player_family', {
                input_code: code.toUpperCase().trim(),
            });
            if (rpcError) throw rpcError;

            if (data?.success) {
                setPlayerName(data.player_name);
                setPlayerId(data.player_id);
                setStep('profile');
            } else if (data?.message === 'Already linked to this player') {
                // Already linked — skip to profile so they can fill it in.
                setPlayerName('your player');
                setStep('profile');
            } else {
                throw new Error(data?.message || 'Invalid code');
            }
        } catch (err) {
            console.error('[GuardianCodeEntry] code submit failed', err);
            setError(err.message || 'Invalid or expired code');
        } finally {
            setLoading(false);
        }
    };

    const submitProfile = async (e) => {
        e.preventDefault();
        if (!relationship || !fullName.trim() || !phone.trim()) {
            setError('Please fill in all fields so the coach can reach you.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            // join_player_family is idempotent for the "already linked" case —
            // we pass the profile fields and it upserts them onto the existing
            // family_members row.
            const { data, error: rpcError } = await supabase.rpc('join_player_family', {
                input_code: code.toUpperCase().trim(),
                p_full_name: fullName.trim(),
                p_phone: phone.trim(),
                p_relationship_label: relationship,
            });
            if (rpcError) throw rpcError;
            setStep('done');
            setTimeout(() => {
                if (onSuccess) onSuccess({ player_id: playerId, player_name: playerName, relationship });
            }, 1200);
        } catch (err) {
            console.error('[GuardianCodeEntry] profile submit failed', err);
            setError(err.message || 'Could not save profile.');
        } finally {
            setLoading(false);
        }
    };

    if (step === 'done') {
        return (
            <div className="bg-brand-dark border border-brand-green/30 rounded-2xl p-8 text-center">
                <CheckCircle className="w-16 h-16 text-brand-green mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">You're connected!</h3>
                <p className="text-gray-400">
                    You're linked to <span className="text-brand-green font-bold">{playerName}</span> as their {relationship.toLowerCase()}.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-brand-dark border border-white/10 rounded-2xl p-6 md:p-8 relative">
            {onClose && (
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                    <X className="w-5 h-5" />
                </button>
            )}

            {step === 'code' && (
                <>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-brand-green/20 rounded-xl">
                            <Shield className="w-8 h-8 text-brand-green" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Link to Your Player</h3>
                            <p className="text-gray-400 text-sm">Enter the guardian code from your coach</p>
                        </div>
                    </div>

                    <form onSubmit={submitCode} className="space-y-4">
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
                                autoFocus
                            />
                        </div>

                        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

                        <button
                            type="submit"
                            disabled={loading || code.length < 6}
                            className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading
                                ? <><Loader2 className="w-5 h-5 animate-spin" /> Checking…</>
                                : <><Shield className="w-5 h-5" /> Continue</>}
                        </button>
                    </form>

                    <p className="text-xs text-gray-500 text-center mt-4">
                        Don't have a code? Ask your team's coach or manager.
                    </p>
                </>
            )}

            {step === 'profile' && (
                <>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-brand-gold/20 rounded-xl">
                            <Heart className="w-7 h-7 text-brand-gold" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-xl font-bold text-white truncate">Tell us about you</h3>
                            <p className="text-gray-400 text-sm truncate">So {playerName}'s coach can reach you.</p>
                        </div>
                    </div>

                    <form onSubmit={submitProfile} className="space-y-4">
                        <div>
                            <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-2">
                                You are {playerName}'s…
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {RELATIONSHIPS.map((r) => (
                                    <button
                                        type="button"
                                        key={r}
                                        onClick={() => setRelationship(r)}
                                        className={`py-2.5 px-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${relationship === r
                                            ? 'bg-brand-green text-brand-dark border-brand-green shadow-lg shadow-brand-green/30'
                                            : 'bg-white/5 border-white/10 text-gray-300 hover:border-brand-green/50'
                                            }`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-2">
                                Your Full Name
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Albert Tipp"
                                    className="w-full bg-black/50 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                                    autoComplete="name"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-2">
                                Cell Phone
                            </label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="(815) 555-1212"
                                    className="w-full bg-black/50 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                                    autoComplete="tel"
                                />
                            </div>
                        </div>

                        <p className="text-[11px] text-gray-500 leading-snug">
                            We use this so the coach can text you about practice, games, and pickup. If the other parent also wants to log in, share your guardian code with them — they'll go through this same screen and have their own contact saved.
                        </p>

                        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading
                                ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving…</>
                                : <><CheckCircle className="w-5 h-5" /> Save & Continue</>}
                        </button>
                    </form>
                </>
            )}
        </div>
    );
};

export default GuardianCodeEntry;
