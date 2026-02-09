import React, { useState, useEffect } from 'react';
import { X, Dumbbell, Play, Clock, Search, CheckCircle, Loader2, Filter } from 'lucide-react';
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
        try {
            // Fetch all drills - no .order() to avoid column name mismatch
            // (table may have 'title' or 'name' depending on migration)
            const { data, error } = await supabase
                .from('drills')
                .select('*');

            if (error) {
                console.error('[DrillLibrary] Error fetching drills:', error);
                setDrills([]);
            } else {
                console.log('[DrillLibrary] Fetched drills:', data?.length || 0);
                // Sort client-side using whichever name column exists
                const sorted = (data || []).sort((a, b) => {
                    const nameA = (a.title || a.name || '').toLowerCase();
                    const nameB = (b.title || b.name || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                });
                setDrills(sorted);
            }
        } catch (err) {
            console.error('[DrillLibrary] Fetch exception:', err);
            setDrills([]);
        }
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
            console.error('[DrillLibrary] Error assigning drill:', err);
            alert('Failed to assign drill. Please try again.');
        } finally {
            setAssigning(null);
        }
    };

    // Get unique skills/categories for filter chips
    const skills = [...new Set(drills.map(d => d.skill || d.category).filter(Boolean))];

    const filtered = drills.filter(d => {
        const name = (d.title || d.name || '').toLowerCase();
        const desc = (d.description || '').toLowerCase();
        const skill = (d.skill || d.category || '').toLowerCase();
        const matchesSearch = name.includes(search.toLowerCase()) || skill.includes(search.toLowerCase()) || desc.includes(search.toLowerCase());
        const matchesFilter = filter === 'all' || skill === filter.toLowerCase();
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-brand-dark border border-white/10 w-full max-w-4xl h-[95vh] sm:h-auto sm:max-h-[90vh] rounded-t-xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header - compact on mobile */}
                <div className="bg-gray-900/50 px-4 py-3 sm:p-5 border-b border-white/10 flex justify-between items-center shrink-0">
                    <div className="min-w-0">
                        <h2 className="text-base sm:text-xl text-white font-display uppercase font-bold tracking-wider flex items-center gap-2">
                            <Dumbbell className="w-4 h-4 sm:w-5 sm:h-5 text-brand-green shrink-0" /> Drill Library
                        </h2>
                        <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 truncate">
                            Assign drills to {player?.first_name || 'player'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Search & Filters - compact on mobile */}
                <div className="px-3 py-2 sm:p-4 border-b border-white/10 space-y-2 sm:space-y-3 shrink-0">
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
                    {skills.length > 0 && (
                        <div className="flex gap-1.5 sm:gap-2 items-center overflow-x-auto no-scrollbar pb-0.5">
                            <Filter className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase transition-all whitespace-nowrap shrink-0 ${filter === 'all' ? 'bg-brand-green text-brand-dark' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                            >
                                All ({drills.length})
                            </button>
                            {skills.map(s => {
                                const count = drills.filter(d => (d.skill || d.category || '').toLowerCase() === s.toLowerCase()).length;
                                return (
                                    <button
                                        key={s}
                                        onClick={() => setFilter(filter.toLowerCase() === s.toLowerCase() ? 'all' : s)}
                                        className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase transition-all whitespace-nowrap shrink-0 ${filter.toLowerCase() === s.toLowerCase() ? 'bg-brand-green text-brand-dark' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                                    >
                                        {s} ({count})
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Drill Grid - Coach-style layout */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="text-center">
                                <Loader2 className="w-8 h-8 animate-spin text-brand-green mx-auto mb-3" />
                                <p className="text-gray-500 text-sm">Loading drills...</p>
                            </div>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-16 text-gray-500">
                            <Dumbbell className="w-16 h-16 mx-auto mb-4 opacity-20" />
                            <p className="text-lg font-bold">No drills found</p>
                            <p className="text-sm mt-1">
                                {search || filter !== 'all'
                                    ? 'Try adjusting your search or filters'
                                    : 'No drills available in the library yet'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filtered.map(drill => {
                                const isAssigned = assigned.has(drill.id);
                                const isAssigning = assigning === drill.id;
                                const duration = drill.duration_minutes || drill.duration || 15;
                                const skill = drill.skill || drill.category || 'General';
                                const drillName = drill.title || drill.name || 'Unnamed Drill';
                                const imageUrl = drill.image_url || drill.image;

                                return (
                                    <div
                                        key={drill.id}
                                        className={`rounded-xl border overflow-hidden transition-all group ${
                                            isAssigned
                                                ? 'bg-brand-green/5 border-brand-green/30'
                                                : 'bg-white/5 border-white/10 hover:border-brand-green/50'
                                        }`}
                                    >
                                        {/* Image thumbnail - like coach's TrainingView */}
                                        <div className="h-32 bg-gray-800 relative overflow-hidden">
                                            {imageUrl ? (
                                                <img
                                                    src={imageUrl}
                                                    alt={drillName}
                                                    className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                                                    <Dumbbell className="w-10 h-10 text-gray-700" />
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />

                                            {/* Play button hover overlay */}
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                <span className="w-12 h-12 rounded-full bg-brand-green flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                                                    <Play className="text-brand-dark w-6 h-6 fill-current ml-0.5" />
                                                </span>
                                            </div>

                                            {/* Skill badge */}
                                            <div className="absolute top-2 left-2 z-10">
                                                <span className="px-2 py-0.5 rounded-full bg-black/60 text-brand-gold text-[10px] font-bold uppercase backdrop-blur-sm">
                                                    {skill}
                                                </span>
                                            </div>

                                            {/* Duration badge */}
                                            <div className="absolute top-2 right-2 z-10">
                                                <span className="px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold flex items-center gap-1 backdrop-blur-sm">
                                                    <Clock className="w-2.5 h-2.5" /> {duration}m
                                                </span>
                                            </div>

                                            {/* Assigned checkmark overlay */}
                                            {isAssigned && (
                                                <div className="absolute inset-0 bg-brand-green/20 flex items-center justify-center z-20">
                                                    <CheckCircle className="w-12 h-12 text-brand-green" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Info + Assign button */}
                                        <div className="p-3">
                                            <h4 className="text-white font-bold font-display uppercase text-sm truncate">{drillName}</h4>
                                            {drill.description && (
                                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{drill.description}</p>
                                            )}
                                            <button
                                                onClick={() => !isAssigned && !isAssigning && assignDrill(drill)}
                                                disabled={isAssigned || isAssigning}
                                                className={`w-full mt-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                                    isAssigned
                                                        ? 'bg-brand-green/20 text-brand-green cursor-default'
                                                        : isAssigning
                                                            ? 'bg-white/10 text-gray-400'
                                                            : 'bg-brand-green/10 text-brand-green hover:bg-brand-green hover:text-brand-dark border border-brand-green/30'
                                                }`}
                                            >
                                                {isAssigned ? 'Assigned!' : isAssigning ? 'Assigning...' : `Assign to ${player?.first_name || 'Player'}`}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer with count */}
                {!loading && filtered.length > 0 && (
                    <div className="shrink-0 px-4 py-3 border-t border-white/10 bg-gray-900/30 flex justify-between items-center">
                        <span className="text-xs text-gray-500">
                            Showing {filtered.length} of {drills.length} drills
                        </span>
                        {assigned.size > 0 && (
                            <span className="text-xs text-brand-green font-bold">
                                {assigned.size} drill{assigned.size > 1 ? 's' : ''} assigned
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DrillLibraryModal;
