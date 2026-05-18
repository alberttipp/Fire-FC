import React, { useState } from 'react';
import { Shield, Loader2, CheckCircle, X, User, Phone, Heart, Users } from 'lucide-react';
import { supabase } from '../../supabaseClient';

// Multi-step "Link to Your Player" form:
//   1) 'code'     — enter the 6-char guardian code (validated against players.guardian_code)
//   2) 'profile'  — tell us about yourself: relationship, full name, phone
//   3) 'siblings' — if other kids on the same team share the last name, prompt
//                   for their codes too so multi-kid families don't accidentally
//                   onboard half their household. Loops if 3+ siblings.
//   4) 'done'     — confetti.
//
// All code-entry submits go through join_player_family() which upserts the
// profile fields onto the new family_members row. For siblings we reuse the
// same RPC with the previously-saved relationship/name/phone values so the
// parent's contact info carries across all their kids automatically.
const GuardianCodeEntry = ({ onSuccess, onClose }) => {
    const [step, setStep] = useState('code'); // 'code' | 'profile' | 'siblings' | 'done'
    const [code, setCode] = useState('');
    const [playerName, setPlayerName] = useState('');
    const [playerId, setPlayerId] = useState(null);

    const [relationship, setRelationship] = useState('');
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');

    // Sibling detection state
    const [siblingCount, setSiblingCount] = useState(0);
    const [siblingCode, setSiblingCode] = useState('');
    const [linkedNames, setLinkedNames] = useState([]); // kids linked in this session

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const RELATIONSHIPS = ['Mom', 'Dad', 'Step-parent', 'Guardian', 'Grandparent', 'Other'];

    // Returns count of OTHER players on the just-linked kid's team that share
    // the last name and aren't already linked to this user. We surface the
    // count only, never the names — avoids leaking other families' kid info
    // when the last name happens to collide.
    const countPotentialSiblings = async (justLinkedPlayerId) => {
        if (!justLinkedPlayerId) return 0;
        const { data: linkedKid } = await supabase
            .from('players')
            .select('last_name, team_id')
            .eq('id', justLinkedPlayerId)
            .maybeSingle();
        if (!linkedKid?.last_name || !linkedKid?.team_id) return 0;

        const { data: existingLinks } = await supabase
            .from('family_members')
            .select('player_id');
        const alreadyLinked = new Set((existingLinks || []).map(l => l.player_id));

        const { data: siblings } = await supabase
            .from('players')
            .select('id')
            .eq('team_id', linkedKid.team_id)
            .eq('last_name', linkedKid.last_name)
            .neq('id', justLinkedPlayerId);
        return (siblings || []).filter(s => !alreadyLinked.has(s.id)).length;
    };

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
            const { data, error: rpcError } = await supabase.rpc('join_player_family', {
                input_code: code.toUpperCase().trim(),
                p_full_name: fullName.trim(),
                p_phone: phone.trim(),
                p_relationship_label: relationship,
            });
            if (rpcError) throw rpcError;

            // First kid is linked — record name and check for siblings.
            setLinkedNames([playerName]);
            const count = await countPotentialSiblings(playerId);
            if (count > 0) {
                setSiblingCount(count);
                setStep('siblings');
            } else {
                finishOnboarding();
            }
        } catch (err) {
            console.error('[GuardianCodeEntry] profile submit failed', err);
            setError(err.message || 'Could not save profile.');
        } finally {
            setLoading(false);
        }
    };

    const submitSiblingCode = async (e) => {
        e.preventDefault();
        if (!siblingCode.trim()) return;
        setLoading(true);
        setError('');
        try {
            // Use the same profile values so the new family_members row gets
            // the parent's name/phone/relationship automatically — they don't
            // have to re-enter it for each kid.
            const { data, error: rpcError } = await supabase.rpc('join_player_family', {
                input_code: siblingCode.toUpperCase().trim(),
                p_full_name: fullName.trim(),
                p_phone: phone.trim(),
                p_relationship_label: relationship,
            });
            if (rpcError) throw rpcError;

            if (data?.success || data?.message === 'Already linked to this player') {
                const newName = data?.player_name || 'your kid';
                setLinkedNames(prev => [...prev, newName]);
                setSiblingCode('');
                // Re-check in case there are 3+ siblings.
                const stillRemaining = await countPotentialSiblings(data?.player_id || playerId);
                if (stillRemaining > 0) {
                    setSiblingCount(stillRemaining);
                } else {
                    finishOnboarding();
                }
            } else {
                throw new Error(data?.message || 'Invalid code');
            }
        } catch (err) {
            console.error('[GuardianCodeEntry] sibling code failed', err);
            setError(err.message || 'That code didn’t match a player on your team.');
        } finally {
            setLoading(false);
        }
    };

    const finishOnboarding = () => {
        setStep('done');
        setTimeout(() => {
            if (onSuccess) onSuccess({ player_id: playerId, player_name: playerName, relationship });
        }, 1200);
    };

    if (step === 'done') {
        const all = linkedNames.length > 0 ? linkedNames : [playerName];
        const names = all.length === 1 ? all[0]
            : all.length === 2 ? `${all[0]} and ${all[1]}`
            : `${all.slice(0, -1).join(', ')} and ${all[all.length - 1]}`;
        return (
            <div className="bg-brand-dark border border-brand-green/30 rounded-2xl p-8 text-center">
                <CheckCircle className="w-16 h-16 text-brand-green mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">You're connected!</h3>
                <p className="text-gray-400">
                    You're linked to <span className="text-brand-green font-bold">{names}</span> as their {relationship.toLowerCase()}.
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

            {step === 'siblings' && (
                <>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-brand-gold/20 rounded-xl">
                            <Users className="w-7 h-7 text-brand-gold" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-xl font-bold text-white truncate">Got another kid on the team?</h3>
                            <p className="text-gray-400 text-sm">
                                We see {siblingCount} other {siblingCount === 1 ? 'player' : 'players'} with the same last name on this team. Each kid has their own guardian code — link them now so you don't have to log out and back in.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={submitSiblingCode} className="space-y-4">
                        <div>
                            <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-2">
                                Sibling's Guardian Code
                            </label>
                            <input
                                type="text"
                                value={siblingCode}
                                onChange={(e) => setSiblingCode(e.target.value.toUpperCase())}
                                placeholder="ABC123"
                                maxLength={6}
                                className="w-full bg-black/50 border border-white/10 rounded-lg py-3 px-4 text-white text-center text-2xl font-mono tracking-widest uppercase focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                                disabled={loading}
                                autoFocus
                            />
                        </div>

                        {linkedNames.length > 0 && (
                            <p className="text-[11px] text-gray-500 text-center">
                                Already linked: <span className="text-brand-green">{linkedNames.join(', ')}</span>
                            </p>
                        )}

                        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={loading || siblingCode.length < 6}
                                className="flex-1 btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {loading
                                    ? <><Loader2 className="w-5 h-5 animate-spin" /> Linking…</>
                                    : <><Shield className="w-5 h-5" /> Add this kid</>}
                            </button>
                            <button
                                type="button"
                                onClick={finishOnboarding}
                                disabled={loading}
                                className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-400 text-sm font-bold uppercase tracking-wider hover:bg-white/10"
                            >
                                I'm done
                            </button>
                        </div>
                    </form>

                    <p className="text-[11px] text-gray-500 text-center mt-4">
                        Don't have the code yet? Tap "I'm done" — you can add the sibling later from your dashboard.
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
