import React, { useState } from 'react';
import { X, User, Hash, Save, Lock } from 'lucide-react';
import { supabase } from '../../supabaseClient';

const CreatePlayerModal = ({ onClose, teamId, onPlayerCreated }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [number, setNumber] = useState('');
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate PIN
        if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
            alert('PIN must be exactly 4 digits');
            return;
        }

        setLoading(true);

        try {
            // Get current session token
            const { data: { session } } = await supabase.auth.getSession();
            console.log('[CreatePlayer] Session:', session);
            console.log('[CreatePlayer] Access Token:', session?.access_token?.substring(0, 20) + '...');
            console.log('[CreatePlayer] Anon Key:', import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + '...');
            console.log('[CreatePlayer] URL:', import.meta.env.VITE_SUPABASE_URL);
            if (!session) throw new Error('Not authenticated - no session found');

            // Call create-player Edge Function
            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-player`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
                    },
                    body: JSON.stringify({
                        firstName: firstName,
                        lastName: lastName,
                        jerseyNumber: parseInt(number),
                        pin: pin,
                        teamId: teamId
                    })
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to create player');
            }

            alert(`✅ Player created!\n\nDisplay Name: ${result.display_name}\nPIN: ${pin}\n\nPlayer can now login using team join code.`);

            if (onPlayerCreated) onPlayerCreated(result);
            onClose();

        } catch (error) {
            console.error('Error creating player:', error);
            alert(`Failed to create player: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-brand-dark border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="p-8">
                    <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wider mb-2">
                        Add New Player
                    </h2>
                    <p className="text-gray-400 text-sm mb-6">
                        Create a player account with PIN-based login. Player can access their dashboard immediately.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-2 ml-1">First Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                                    <input
                                        type="text"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                                        placeholder="Leo"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-2 ml-1">Last Name</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg py-2.5 px-4 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                                        placeholder="Messi"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-2 ml-1">Jersey #</label>
                                <div className="relative">
                                    <Hash className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                                    <input
                                        type="number"
                                        value={number}
                                        onChange={(e) => setNumber(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                                        placeholder="58"
                                        required
                                        min="1"
                                        max="99"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-2 ml-1">4-Digit PIN</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                                    <input
                                        type="password"
                                        value={pin}
                                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                                        placeholder="1234"
                                        required
                                        maxLength="4"
                                        pattern="\d{4}"
                                    />
                                </div>
                            </div>
                        </div>

                        <p className="text-xs text-gray-400 bg-black/30 p-3 rounded-lg border border-white/5">
                            <strong className="text-brand-green">Note:</strong> Player will login using their Display Name (e.g., "Bo58") and this 4-digit PIN. No email needed.
                        </p>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn-primary py-3 flex items-center justify-center gap-2 mt-6 group"
                        >
                            {loading ? (
                                'Saving...'
                            ) : (
                                <>
                                    <Save className="w-4 h-4 group-hover:scale-110 transition-transform" /> Add to Roster
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreatePlayerModal;
