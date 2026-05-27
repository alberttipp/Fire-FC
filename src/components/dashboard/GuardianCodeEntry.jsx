import React, { useEffect, useState } from 'react';
import { Shield, Loader2, CheckCircle, X, User, Phone, Heart, Users, ChevronRight, Check } from 'lucide-react';
import { supabase } from '../../supabaseClient';

const PUBLIC_TEAM_ID = '57ea33d1-f8c8-4ed8-9749-37226e5780bb';

// Family onboarding:
//   1) profile  - tell us about yourself: relationship, full name, phone
//   2) children - pick one or more kids from the roster
//   3) code     - fallback if a kid is missing from the picker
//   4) done     - confetti
//
// The component still calls join_player_family() under the hood so the
// database writes stay consistent.
const GuardianCodeEntry = ({ onSuccess, onClose }) => {
    const [step, setStep] = useState('profile');
    const [relationship, setRelationship] = useState('');
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [manualCode, setManualCode] = useState('');

    const [rosterKids, setRosterKids] = useState([]);
    const [rosterLoading, setRosterLoading] = useState(true);
    const [selectedKids, setSelectedKids] = useState([]);
    const [linkedNames, setLinkedNames] = useState([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const RELATIONSHIPS = ['Mom', 'Dad', 'Step-parent', 'Guardian', 'Grandparent', 'Other'];

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const { data, error: rosterError } = await supabase.rpc('get_public_team_roster_invites', {
                p_team_id: PUBLIC_TEAM_ID,
            });

            if (cancelled) return;

            if (rosterError) {
                console.error('[GuardianCodeEntry] roster load failed', rosterError);
                setRosterKids([]);
            } else {
                setRosterKids(data || []);
            }

            setRosterLoading(false);
        })();

        return () => { cancelled = true; };
    }, []);

    const submitProfile = async (e) => {
        e.preventDefault();
        if (!relationship || !fullName.trim() || !phone.trim()) {
            setError('Please fill in all fields so the coach can reach you.');
            return;
        }

        setError('');
        setStep('children');
    };

    const toggleKid = (code) => {
        setError('');
        setSelectedKids(prev => (
            prev.includes(code)
                ? prev.filter(item => item !== code)
                : [...prev, code]
        ));
    };

    const linkChildByCode = async (code, profileValues) => {
        const { data, error: rpcError } = await supabase.rpc('join_player_family', {
            input_code: code.toUpperCase().trim(),
            p_full_name: profileValues.fullName,
            p_phone: profileValues.phone,
            p_relationship_label: profileValues.relationship,
        });

        if (rpcError) throw rpcError;
        if (data?.success || data?.message === 'Already linked to this player') {
            return {
                playerId: data?.player_id || null,
                playerName: data?.player_name || null,
            };
        }

        throw new Error(data?.message || 'Could not link child.');
    };

    const submitSelectedKids = async (e) => {
        e.preventDefault();
        if (selectedKids.length === 0) {
            setError('Pick at least one child to link.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const profileValues = {
                fullName: fullName.trim(),
                phone: phone.trim(),
                relationship,
            };

            const chosenRows = rosterKids.filter(k => selectedKids.includes(k.guardian_code));
            const names = [];
            const playerIds = [];

            for (const row of chosenRows) {
                const result = await linkChildByCode(row.guardian_code, profileValues);
                names.push(result.playerName || `${row.first_name} ${row.last_initial || ''}`.trim());
                if (result.playerId) playerIds.push(result.playerId);
            }

            setLinkedNames(names);
            setStep('done');
            setTimeout(() => {
                if (onSuccess) {
                    onSuccess({
                        player_id: playerIds[0] || null,
                        player_name: names[0] || null,
                        relationship,
                        linked_player_ids: playerIds,
                    });
                }
            }, 1200);
        } catch (err) {
            console.error('[GuardianCodeEntry] child selection failed', err);
            setError(err.message || 'Could not link the selected child.');
        } finally {
            setLoading(false);
        }
    };

    const submitManualCode = async (e) => {
        e.preventDefault();
        if (!manualCode.trim()) return;

        setLoading(true);
        setError('');

        try {
            const result = await linkChildByCode(manualCode, {
                fullName: fullName.trim(),
                phone: phone.trim(),
                relationship,
            });

            setLinkedNames([result.playerName || 'your child']);
            setStep('done');
            setTimeout(() => {
                if (onSuccess) {
                    onSuccess({
                        player_id: result.playerId,
                        player_name: result.playerName,
                        relationship,
                        linked_player_ids: result.playerId ? [result.playerId] : [],
                    });
                }
            }, 1200);
        } catch (err) {
            console.error('[GuardianCodeEntry] manual code failed', err);
            setError(err.message || 'That code didn’t match a player on your team.');
        } finally {
            setLoading(false);
        }
    };

    if (step === 'done') {
        const all = linkedNames.length > 0 ? linkedNames : ['your child'];
        const names = all.length === 1
            ? all[0]
            : all.length === 2
                ? `${all[0]} and ${all[1]}`
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

            {step === 'profile' && (
                <>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-brand-gold/20 rounded-xl">
                            <Heart className="w-7 h-7 text-brand-gold" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-xl font-bold text-white truncate">Tell us about you</h3>
                            <p className="text-gray-400 text-sm truncate">This is the family setup step.</p>
                        </div>
                    </div>

                    <form onSubmit={submitProfile} className="space-y-4">
                        <div>
                            <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-2">
                                You are the child's...
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
                            After this, you’ll pick your child from the roster and link them to your family account.
                        </p>

                        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading
                                ? <><Loader2 className="w-5 h-5 animate-spin" /> Savingâ€¦</>
                                : <><CheckCircle className="w-5 h-5" /> Continue</>}
                        </button>
                    </form>
                </>
            )}

            {step === 'children' && (
                <>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-brand-green/20 rounded-xl">
                            <Users className="w-7 h-7 text-brand-green" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-xl font-bold text-white truncate">Select your child</h3>
                            <p className="text-gray-400 text-sm">
                                Pick one or more kids to link now. You can add another later from the dashboard.
                            </p>
                        </div>
                    </div>

                    {rosterLoading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="w-6 h-6 text-brand-green animate-spin" />
                        </div>
                    ) : (
                        <form onSubmit={submitSelectedKids} className="space-y-4">
                            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                                {rosterKids.length === 0 ? (
                                    <p className="text-gray-500 text-sm">No players are available to select right now.</p>
                                ) : rosterKids.map((kid) => {
                                    const isSelected = selectedKids.includes(kid.guardian_code);
                                    const label = `${kid.first_name} ${kid.last_initial || ''}.${kid.jersey_number != null ? ` · #${kid.jersey_number}` : ''}`;
                                    return (
                                        <button
                                            key={kid.guardian_code}
                                            type="button"
                                            onClick={() => toggleKid(kid.guardian_code)}
                                            className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border text-left transition-colors ${isSelected
                                                ? 'bg-brand-green/10 border-brand-green/40'
                                                : 'bg-white/[0.03] border-white/10 hover:border-brand-gold/30'
                                            }`}
                                        >
                                            <div className="min-w-0">
                                                <p className="text-white font-bold truncate">{label}</p>
                                                <p className="text-[11px] text-gray-500 uppercase tracking-wider">Tap to select</p>
                                            </div>
                                            <div className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'bg-brand-green border-brand-green text-brand-dark' : 'border-white/20 text-transparent'}`}>
                                                <Check className="w-3.5 h-3.5" />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setStep('code')}
                                    className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-400 text-sm font-bold uppercase tracking-wider hover:bg-white/10 flex items-center gap-2"
                                >
                                    Use code instead <ChevronRight className="w-4 h-4" />
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || selectedKids.length === 0}
                                    className="flex-1 btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading
                                        ? <><Loader2 className="w-5 h-5 animate-spin" /> Linkingâ€¦</>
                                        : <><Shield className="w-5 h-5" /> Link selected child{selectedKids.length === 1 ? '' : 'ren'}</>}
                                </button>
                            </div>

                            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                        </form>
                    )}
                </>
            )}

            {step === 'code' && (
                <>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-brand-green/20 rounded-xl">
                            <Shield className="w-8 h-8 text-brand-green" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Link with a code</h3>
                            <p className="text-gray-400 text-sm">Fallback if your child doesn’t appear in the picker</p>
                        </div>
                    </div>

                    <form onSubmit={submitManualCode} className="space-y-4">
                        <div>
                            <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-2">
                                Child Code
                            </label>
                            <input
                                type="text"
                                value={manualCode}
                                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                                placeholder="ABC123"
                                maxLength={6}
                                className="w-full bg-black/50 border border-white/10 rounded-lg py-3 px-4 text-white text-center text-2xl font-mono tracking-widest uppercase focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                                disabled={loading}
                                autoFocus
                            />
                        </div>

                        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setStep('children')}
                                className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-400 text-sm font-bold uppercase tracking-wider hover:bg-white/10"
                            >
                                Back
                            </button>
                            <button
                                type="submit"
                                disabled={loading || manualCode.length < 6}
                                className="flex-1 btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {loading
                                    ? <><Loader2 className="w-5 h-5 animate-spin" /> Checkingâ€¦</>
                                    : <><Shield className="w-5 h-5" /> Continue</>}
                            </button>
                        </div>
                    </form>
                </>
            )}
        </div>
    );
};

export default GuardianCodeEntry;
