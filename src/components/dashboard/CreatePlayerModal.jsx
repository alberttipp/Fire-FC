import React, { useState } from 'react';
import { X, User, Hash, Save } from 'lucide-react';
import { supabase } from '../../supabaseClient';

const CreatePlayerModal = ({ onClose, teamId, onPlayerCreated }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [number, setNumber] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data, error } = await supabase
                .from('players')
                .insert([
                    {
                        team_id: teamId,
                        first_name: firstName,
                        last_name: lastName,
                        number: number,
                        stats: { xp: 0, level: 1 }
                    }
                ])
                .select()
                .single();

            if (error) throw error;

            if (onPlayerCreated) onPlayerCreated(data);
            onClose();

        } catch (error) {
            console.error('Error creating player:', error);
            alert('Failed to add player.');
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
                        Add a player to your official roster. Parents can claim them later.
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

                        <div>
                            <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-2 ml-1">Jersey Number</label>
                            <div className="relative">
                                <Hash className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                                <input
                                    type="text"
                                    value={number}
                                    onChange={(e) => setNumber(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                                    placeholder="10"
                                />
                            </div>
                        </div>

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
