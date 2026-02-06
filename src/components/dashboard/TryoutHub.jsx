import React, { useState, useEffect } from 'react';
import { Users, Filter, Mic, Search, ChevronRight, UserPlus, Loader2, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import ScoutCard from './ScoutCard';

const STATUS_COLORS = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    contacted: 'bg-blue-500/20 text-blue-400',
    scheduled: 'bg-purple-500/20 text-purple-400',
    tried_out: 'bg-brand-green/20 text-brand-green',
    accepted: 'bg-green-500/20 text-green-400',
    declined: 'bg-red-500/20 text-red-400',
};

const TryoutHub = () => {
    const { user } = useAuth();
    const [prospects, setProspects] = useState([]);
    const [ageGroups, setAgeGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState('All');
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newProspect, setNewProspect] = useState({ name: '', age_group: '', email: '', phone: '', notes: '' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchProspects();
    }, []);

    const fetchProspects = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('tryout_waitlist')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const items = data || [];
            setProspects(items);

            // Extract unique age groups
            const groups = [...new Set(items.map(p => p.age_group).filter(Boolean))];
            setAgeGroups(groups);
            if (groups.length > 0 && selectedGroup === 'All') {
                // keep All as default
            }
        } catch (err) {
            console.error('Error fetching prospects:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddProspect = async () => {
        if (!newProspect.name.trim()) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('tryout_waitlist')
                .insert([{
                    name: newProspect.name.trim(),
                    age_group: newProspect.age_group || null,
                    email: newProspect.email || null,
                    phone: newProspect.phone || null,
                    notes: newProspect.notes || null,
                    status: 'pending'
                }]);

            if (error) throw error;

            setNewProspect({ name: '', age_group: '', email: '', phone: '', notes: '' });
            setShowAddForm(false);
            fetchProspects();
        } catch (err) {
            console.error('Error adding prospect:', err);
            alert('Could not add prospect.');
        } finally {
            setSaving(false);
        }
    };

    const updateStatus = async (prospectId, newStatus) => {
        try {
            const { error } = await supabase
                .from('tryout_waitlist')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', prospectId);

            if (error) throw error;
            setProspects(prev => prev.map(p => p.id === prospectId ? { ...p, status: newStatus } : p));
        } catch (err) {
            console.error('Error updating status:', err);
        }
    };

    const filtered = prospects.filter(p => {
        const matchesGroup = selectedGroup === 'All' || p.age_group === selectedGroup;
        const matchesSearch = !searchQuery ||
            p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.notes?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesGroup && matchesSearch;
    });

    const handlePlayerClick = (player) => {
        setSelectedPlayer(player);
    };

    if (loading) {
        return (
            <div className="h-[calc(100vh-140px)] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-brand-green" />
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col md:flex-row gap-6 animate-fade-in relative">

            {/* Left Sidebar: Groups & List */}
            <div className={`w-full md:w-1/3 flex flex-col glass-panel overflow-hidden ${selectedPlayer ? 'hidden md:flex' : 'flex'}`}>
                {/* Header */}
                <div className="p-6 border-b border-white/10 bg-brand-dark/50">
                    <h2 className="text-2xl text-white font-display uppercase font-bold tracking-wider mb-4">Tryout Center</h2>

                    {/* Group Selector */}
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                        <button
                            onClick={() => setSelectedGroup('All')}
                            className={`px-3 py-1.5 rounded text-xs font-bold uppercase whitespace-nowrap transition-colors ${selectedGroup === 'All' ? 'bg-brand-gold text-brand-dark' : 'bg-white/10 text-gray-400 hover:text-white'}`}
                        >
                            All ({prospects.length})
                        </button>
                        {ageGroups.map(group => (
                            <button
                                key={group}
                                onClick={() => setSelectedGroup(group)}
                                className={`px-3 py-1.5 rounded text-xs font-bold uppercase whitespace-nowrap transition-colors ${selectedGroup === group ? 'bg-brand-gold text-brand-dark' : 'bg-white/10 text-gray-400 hover:text-white'}`}
                            >
                                {group}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative mt-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search prospects..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-brand-green outline-none"
                        />
                    </div>
                </div>

                {/* Player List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                    {filtered.length === 0 ? (
                        <div className="text-center py-8">
                            <Users className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                            <p className="text-gray-500 text-sm">No prospects found.</p>
                            <p className="text-gray-600 text-xs mt-1">Add a walk-in trialist to get started.</p>
                        </div>
                    ) : (
                        filtered.map(prospect => (
                            <div
                                key={prospect.id}
                                onClick={() => handlePlayerClick(prospect)}
                                className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all hover:bg-white/5 ${selectedPlayer?.id === prospect.id ? 'bg-brand-green/10 border-brand-green' : 'bg-transparent border-transparent'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center font-display font-bold text-gray-400 border border-white/10 text-sm">
                                        {prospect.name?.charAt(0)?.toUpperCase() || '?'}
                                    </div>
                                    <div>
                                        <h4 className={`font-bold text-sm ${selectedPlayer?.id === prospect.id ? 'text-brand-green' : 'text-white'}`}>
                                            {prospect.name}
                                        </h4>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {prospect.age_group && (
                                                <span className="text-xs text-gray-500 uppercase font-bold">{prospect.age_group}</span>
                                            )}
                                            {prospect.status && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${STATUS_COLORS[prospect.status] || 'bg-gray-500/20 text-gray-400'}`}>
                                                    {prospect.status.replace('_', ' ')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className={`w-4 h-4 ${selectedPlayer?.id === prospect.id ? 'text-brand-green' : 'text-gray-600'}`} />
                            </div>
                        ))
                    )}

                    {/* Add Walk-in Button */}
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="w-full py-3 my-2 border border-dashed border-white/20 rounded-lg text-gray-400 text-sm hover:text-brand-green hover:border-brand-green transition-colors flex items-center justify-center gap-2"
                    >
                        <UserPlus className="w-4 h-4" /> Add Walk-in Trialist
                    </button>
                </div>
            </div>

            {/* Add Prospect Modal */}
            {showAddForm && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="bg-brand-dark border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-white font-bold text-lg uppercase">Add Prospect</h3>
                            <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <input
                            type="text"
                            placeholder="Full Name *"
                            value={newProspect.name}
                            onChange={(e) => setNewProspect({ ...newProspect, name: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                        />
                        <input
                            type="text"
                            placeholder="Age Group (e.g. U11)"
                            value={newProspect.age_group}
                            onChange={(e) => setNewProspect({ ...newProspect, age_group: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                        />
                        <input
                            type="email"
                            placeholder="Parent Email"
                            value={newProspect.email}
                            onChange={(e) => setNewProspect({ ...newProspect, email: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                        />
                        <input
                            type="tel"
                            placeholder="Phone"
                            value={newProspect.phone}
                            onChange={(e) => setNewProspect({ ...newProspect, phone: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                        />
                        <textarea
                            placeholder="Notes (position, background, etc.)"
                            value={newProspect.notes}
                            onChange={(e) => setNewProspect({ ...newProspect, notes: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white h-20 resize-none"
                        />

                        <button
                            onClick={handleAddProspect}
                            disabled={!newProspect.name.trim() || saving}
                            className="w-full py-3 bg-brand-green text-brand-dark rounded-lg font-bold uppercase hover:bg-brand-green/90 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                            Add to Waitlist
                        </button>
                    </div>
                </div>
            )}

            {/* Right Panel: Scout Card & Voice Tools */}
            <div className={`w-full md:w-2/3 glass-panel relative overflow-hidden flex flex-col ${!selectedPlayer && 'hidden md:flex'}`}>
                {selectedPlayer ? (
                    <ScoutCard
                        prospect={selectedPlayer}
                        onClose={() => setSelectedPlayer(null)}
                        onStatusChange={updateStatus}
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-50">
                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                            <Mic className="w-8 h-8 text-white/30" />
                        </div>
                        <h3 className="text-xl text-white font-display uppercase font-bold mb-2">Ready to Scout</h3>
                        <p className="text-gray-400 max-w-sm">Select a prospect from the list to view their profile, record voice notes, and grade their performance.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TryoutHub;
