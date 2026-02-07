import React, { useState, useEffect } from 'react';
import { X, Dumbbell, Play, Clock, Search, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

const DrillLibraryModal = ({ onClose, player, teamId }) => {
    const { user } = useAuth();
    const [drills, setDrills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [assigning, setAssigning] = useState(null);
    const [assigned, setAssigned] = useState(new Set());

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    useEffect(() => {
        fetchDrills();
    }, []);

    const fetchDrills = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('drills')
            .select('*')
            .order('title', { ascending: true });

        if (error) {
            console.error('Error fetching drills:', error);
        }
        setDrills(data || []);
        setLoading(false);
    };

    const assignDrill = async (drill) => {
        if (!player?.id || !teamId) return;
        setAssigning(drill.id);

        try {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 7);

            const { error } = await supabase
                .from('assignments')
                .insert({
                    drill_id: drill.id,
                    player_id: player.id,
                    team_id: teamId,
                    assigned_by: user.id,
                    status: 'pending',
                    custom_duration: drill.duration_minutes || drill.duration || 15,
                    due_date: dueDate.toISOString()
                });

            if (error) throw error;
            setAssigned(prev => new Set([...prev, drill.id]));
        } catch (err) {
            console.error('Error assigning drill:', err);
            alert('Failed to assign drill. Please try again.');
        } finally {
            setAssigning(null);
        }
    };

    const skills = [...new Set(drills.map(d => d.skill || d.category).filter(Boolean))];

    const filtered = drills.filter(d => {
        const name = (d.title || d.name || '').toLowerCase();
        const skill = (d.skill || d.category || '').toLowerCase();
        const matchesSearch = name.includes(search.toLowerCase()) || skill.includes(search.toLowerCase());
        const matchesFilter = filter === 'all' || skill === filter.toLowerCase();
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-brand-dark border border-white/10 w-full max-w-3xl max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-gray-900/50 p-5 border-b border-white/10 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl text-white font-display uppercase font-bold tracking-wider flex items-center gap-2">
                            <Dumbbell className="w-5 h-5 text-brand-green" /> Drill Library
                        </h2>
                        <p className="text-xs text-gray-400 mt-1">
                            Assign drills to {player?.first_name || 'player'} for solo practice
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Search & Filters */}
                <div className="p-4 border-b border-white/10 space-y-3 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search drills..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-black/30 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white text-sm focus:border-brand-green outline-none"
                        />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-3 py-1 rounded-full text-xs font-bold uppercase transition-all ${filter === 'all' ? 'bg-brand-green text-brand-dark' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                        >
                            All
                        </button>
                        {skills.map(s => (
                            <button
                                key={s}
                                onClick={() => setFilter(s)}
                                className={`px-3 py-1 rounded-full text-xs font-bold uppercase transition-all ${filter.toLowerCase() === s.toLowerCase() ? 'bg-brand-green text-brand-dark' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Drill Grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-brand-green" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Dumbbell className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>No drills found</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {filtered.map(drill => {
                                const isAssigned = assigned.has(drill.id);
                                const isAssigning = assigning === drill.id;
                                const duration = drill.duration_minutes || drill.duration || 15;
                                const skill = drill.skill || drill.category || 'General';

                                return (
                                    <div
                                        key={drill.id}
                                        className={`p-4 rounded-xl border transition-all ${isAssigned ? 'bg-brand-green/10 border-brand-green/30' : 'bg-white/5 border-white/10 hover:border-brand-green/30'}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-brand-green/10 flex items-center justify-center shrink-0">
                                                {isAssigned ? (
                                                    <CheckCircle className="w-5 h-5 text-brand-green" />
                                                ) : (
                                                    <Play className="w-5 h-5 text-brand-green" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-white font-bold text-sm truncate">{drill.title || drill.name}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs text-brand-gold font-bold uppercase">{skill}</span>
                                                    <span className="text-xs text-gray-500 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" /> {duration} min
                                                    </span>
                                                </div>
                                                {drill.description && (
                                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{drill.description}</p>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => !isAssigned && !isAssigning && assignDrill(drill)}
                                            disabled={isAssigned || isAssigning}
                                            className={`w-full mt-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                                isAssigned
                                                    ? 'bg-brand-green/20 text-brand-green cursor-default'
                                                    : isAssigning
                                                        ? 'bg-white/10 text-gray-400'
                                                        : 'bg-brand-green/10 text-brand-green hover:bg-brand-green/20 border border-brand-green/30'
                                            }`}
                                        >
                                            {isAssigned ? 'Assigned!' : isAssigning ? 'Assigning...' : `Assign to ${player?.first_name || 'Player'}`}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DrillLibraryModal;
