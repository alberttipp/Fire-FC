import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { X, Shield } from 'lucide-react';

// Age-group options. Generated from two arrays so adding an age bracket
// or a new gender category later is a one-line change (instead of 14+
// hardcoded option tags). Coed added per Albert's summer-team request.
const AGE_BRACKETS = ['U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18'];
const GENDER_GROUPS = ['Boys', 'Girls', 'Coed'];

const CreateTeamModal = ({ onClose, onTeamCreated }) => {
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [ageGroup, setAgeGroup] = useState('U11 Boys');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Clubs (orgs) where this user is a club_director — the only role the
    // teams INSERT RLS policy lets create teams. We need to know which to
    // attach the new team to. One club → auto-select. Multiple → picker.
    const [clubs, setClubs] = useState([]);
    const [selectedOrgId, setSelectedOrgId] = useState('');
    const [clubsLoading, setClubsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const fetchClubs = async () => {
            if (!user?.id) return;
            setClubsLoading(true);
            const { data, error: orgErr } = await supabase
                .from('org_memberships')
                .select('org_id, role, organizations:org_id (id, name)')
                .eq('user_id', user.id)
                .eq('role', 'club_director');
            if (cancelled) return;
            if (orgErr) {
                console.error('[CreateTeamModal] club fetch failed', orgErr);
                setClubs([]);
            } else {
                const list = (data || [])
                    .map(r => r.organizations)
                    .filter(Boolean);
                setClubs(list);
                if (list.length > 0) setSelectedOrgId(list[0].id);
            }
            setClubsLoading(false);
        };
        fetchClubs();
        return () => { cancelled = true; };
    }, [user?.id]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (!selectedOrgId) {
            setError('You must be a club director to create a team. Ask your club admin to grant you access.');
            setLoading(false);
            return;
        }

        // Generate a random 6-character code (e.g., FC-A1B2)
        const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        const joinCode = `FC-${randomStr}`;

        try {
            // 1. Insert the team. org_id is sent explicitly so this works
            // for any club the director belongs to (not just the default
            // Rockford Fire FC org). The teams RLS INSERT policy requires
            // has_org_role(uid, org_id, 'club_director'); the SELECT policy
            // (post-RETURNING) accepts the same director check.
            const { data: teamData, error: teamError } = await supabase
                .from('teams')
                .insert({
                    org_id: selectedOrgId,
                    name,
                    age_group: ageGroup,
                    join_code: joinCode,
                })
                .select()
                .single();
            if (teamError) throw teamError;

            // 2. Link the creator as manager. upsert + ignoreDuplicates so
            // this stays safe if a future trigger ever re-introduces an
            // auto-insert path (the unique (team_id, user_id) constraint
            // already blocks real duplicates).
            const { error: membershipError } = await supabase
                .from('team_memberships')
                .upsert(
                    { team_id: teamData.id, user_id: user.id, role: 'manager' },
                    { onConflict: 'team_id,user_id', ignoreDuplicates: true }
                );
            if (membershipError) throw membershipError;

            onTeamCreated(teamData);
            onClose();
        } catch (err) {
            console.error("Error creating team:", err);
            setError(err.message || 'Could not create team. Try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm md:p-4 animate-fade-in">
            <div className="bg-brand-dark border border-brand-green/30 w-full md:max-w-md rounded-t-2xl md:rounded-xl shadow-2xl overflow-hidden relative max-h-[90vh] overflow-y-auto">
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

                    {!clubsLoading && clubs.length === 0 && (
                        <div className="mb-4 bg-yellow-500/10 border border-yellow-500/50 text-yellow-400 p-3 rounded text-sm">
                            You aren't a club director on any club yet. Create a club first or ask an admin to grant you access.
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {clubs.length > 1 && (
                            <div>
                                <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Club</label>
                                <select
                                    value={selectedOrgId}
                                    onChange={(e) => setSelectedOrgId(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded p-3 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all outline-none"
                                >
                                    {clubs.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

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
                                {GENDER_GROUPS.map((gender) => (
                                    <optgroup key={gender} label={gender}>
                                        {AGE_BRACKETS.map((bracket) => {
                                            const value = `${bracket} ${gender}`;
                                            return <option key={value} value={value}>{value}</option>;
                                        })}
                                    </optgroup>
                                ))}
                                <option value="High School">High School</option>
                                <option value="Adult">Adult</option>
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
                                disabled={loading || clubsLoading || clubs.length === 0}
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
