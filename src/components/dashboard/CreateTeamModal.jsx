import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { X, Shield } from 'lucide-react';

const CreateTeamModal = ({ onClose, onTeamCreated }) => {
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [ageGroup, setAgeGroup] = useState('U11 Boys');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Generate a random 6-character code (e.g., FC-A1B2)
        const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        const joinCode = `FC-${randomStr}`;

        try {
            // Check if user profile exists in database (real users have profiles, demo users don't)
            const { data: profileExists } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', user.id)
                .single();

            // 1. Insert Team (only set coach_id if profile exists)
            const teamInsert = {
                name,
                age_group: ageGroup,
                join_code: joinCode,
            };

            if (profileExists) {
                teamInsert.coach_id = user.id;
            }

            const { data: teamData, error: teamError } = await supabase
                .from('teams')
                .insert(teamInsert)
                .select()
                .single();

            if (teamError) throw teamError;

            // 2. Update Coach's Profile with correct team_id (only if profile exists)
            if (profileExists) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({ team_id: teamData.id })
                    .eq('id', user.id);

                if (profileError) throw profileError;
            }

            // Success
            onTeamCreated(teamData);
            onClose();

        } catch (err) {
            console.error("Error creating team:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-brand-dark border border-brand-green/30 w-full max-w-md rounded-xl shadow-2xl overflow-hidden relative">
                {/* Header */}
                <div className="bg-brand-green/10 p-6 border-b border-brand-green/20 flex justify-between items-center">
                    <h2 className="text-xl text-white font-display uppercase font-bold tracking-wider flex items-center gap-2">
                        <Shield className="w-5 h-5 text-brand-green" /> Create New Team
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Form */}
                <div className="p-6">
                    {error && (
                        <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Team Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Rockford Fire FC"
                                className="w-full bg-black/50 border border-white/10 rounded p-3 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all outline-none"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Age Group</label>
                            <select
                                value={ageGroup}
                                onChange={(e) => setAgeGroup(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded p-3 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all outline-none"
                            >
                                <option>U8 Boys</option>
                                <option>U9 Boys</option>
                                <option>U10 Boys</option>
                                <option>U11 Boys</option>
                                <option>U12 Boys</option>
                                <option>U13 Boys</option>
                                <option>U14 Boys</option>
                                <option>U8 Girls</option>
                                <option>U9 Girls</option>
                                <option>U10 Girls</option>
                                <option>U11 Girls</option>
                                <option>U12 Girls</option>
                                <option>U13 Girls</option>
                                <option>U14 Girls</option>
                            </select>
                        </div>

                        <div className="bg-brand-gold/10 border border-brand-gold/20 p-3 rounded text-xs text-brand-gold">
                            <strong>Note:</strong> A standard "Team Code" will be generated automatically for players to join.
                        </div>

                        <div className="pt-4 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded text-gray-400 hover:text-white hover:bg-white/5 transition-colors uppercase font-bold text-xs tracking-wider"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2 rounded bg-brand-green text-brand-dark font-display font-bold uppercase tracking-wider hover:bg-white hover:scale-105 transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Creating...' : 'Create Team'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreateTeamModal;
