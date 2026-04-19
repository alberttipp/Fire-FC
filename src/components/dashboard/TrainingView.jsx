import React, { useState, useEffect } from 'react';
import { Dumbbell, Play, Plus, ClipboardList, Calendar, AlertCircle, X, Clock, Target, Zap, Shield, Footprints, Wind, Brain, Heart, Flame, Eye } from 'lucide-react';
import AssignDrillModal from './AssignDrillModal';
import PracticeSessionBuilder from './PracticeSessionBuilder';
import CreateEventModal from './CreateEventModal';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

const CATEGORY_CONFIG = {
    'Ball Mastery (Solo)': { color: 'purple', bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400', icon: Footprints, label: 'Ball Mastery' },
    'First Touch':         { color: 'blue', bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400', icon: Target, label: 'First Touch' },
    'Dribbling & 1v1':     { color: 'emerald', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400', icon: Zap, label: 'Dribbling' },
    'Passing & Receiving': { color: 'cyan', bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-400', icon: Wind, label: 'Passing' },
    'Finishing & Shooting':{ color: 'red', bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400', icon: Flame, label: 'Shooting' },
    'Defending':           { color: 'amber', bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-400', icon: Shield, label: 'Defending' },
    'Tactical / Game Intelligence': { color: 'indigo', bg: 'bg-indigo-500/20', border: 'border-indigo-500/30', text: 'text-indigo-400', icon: Brain, label: 'Tactical' },
    'Warm-Up':             { color: 'orange', bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400', icon: Heart, label: 'Warm-Up' },
    'Conditioning':        { color: 'rose', bg: 'bg-rose-500/20', border: 'border-rose-500/30', text: 'text-rose-400', icon: Dumbbell, label: 'Conditioning' },
    'Speed & Agility':     { color: 'yellow', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-400', icon: Zap, label: 'Speed' },
    'Goalkeeper':          { color: 'teal', bg: 'bg-teal-500/20', border: 'border-teal-500/30', text: 'text-teal-400', icon: Eye, label: 'Goalkeeper' },
};

const getCategoryConfig = (category) => CATEGORY_CONFIG[category] || { color: 'gray', bg: 'bg-gray-500/20', border: 'border-gray-500/30', text: 'text-gray-400', icon: Dumbbell, label: category };

const TrainingView = () => {
    const { user, profile } = useAuth();
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showPracticeBuilder, setShowPracticeBuilder] = useState(false);
    const [showAddPractice, setShowAddPractice] = useState(false);
    const [drills, setDrills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [teamId, setTeamId] = useState(null);
    const [selectedDrill, setSelectedDrill] = useState(null);
    const [filterCategory, setFilterCategory] = useState('all');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);

            // Get team ID - prioritize coach's teams
            if (profile?.team_id) {
                setTeamId(profile.team_id);
            } else if (profile?.id && profile?.role === 'coach') {
                // For coaches, get their first team
                const { data: coachTeams } = await supabase
                    .from('teams')
                    .select('id')
                    .eq('coach_id', profile.id)
                    .limit(1);
                if (coachTeams?.length) setTeamId(coachTeams[0].id);
            } else {
                // For other roles, get first available team
                const { data: teams } = await supabase
                    .from('teams')
                    .select('id')
                    .limit(1);
                if (teams?.length) setTeamId(teams[0].id);
            }

            // Fetch drills from database only - NO mock fallback
            const { data, error } = await supabase
                .from('drills')
                .select('*');

            if (error) {
                console.error("Error fetching drills:", error.message);
                setDrills([]);
            } else {
                setDrills(data || []);
            }
            
            setLoading(false);
        };

        fetchData();
    }, [profile]);

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl text-white font-display uppercase">Practice Center</h2>

                <div className="flex gap-3">
                    <button
                        onClick={() => setShowAddPractice(true)}
                        className="bg-brand-green text-brand-dark px-4 py-2 rounded font-bold uppercase text-sm flex items-center gap-2 hover:bg-white transition-colors"
                    >
                        <Calendar className="w-4 h-4" /> Add Practice
                    </button>
                    <button
                        onClick={() => setShowPracticeBuilder(true)}
                        className="bg-brand-gold/10 border border-brand-gold/30 text-brand-gold px-4 py-2 rounded font-bold uppercase text-sm flex items-center gap-2 hover:bg-brand-gold/20 transition-colors"
                    >
                        <ClipboardList className="w-4 h-4" /> Build Session
                    </button>
                    <button
                        onClick={() => setShowAssignModal(true)}
                        className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
                    >
                        <Plus className="w-4 h-4" /> Assign Homework
                    </button>
                </div>
            </div>

            {showAddPractice && (
                <CreateEventModal defaultType="practice" onClose={() => setShowAddPractice(false)} onEventCreated={() => setShowAddPractice(false)} />
            )}

            {showAssignModal && (
                <AssignDrillModal onClose={() => setShowAssignModal(false)} />
            )}

            {showPracticeBuilder && (
                <PracticeSessionBuilder
                    onClose={() => setShowPracticeBuilder(false)}
                    onSave={(session) => console.log('Session saved:', session)}
                />
            )}

            {/* Category Filter */}
            <div className="flex gap-2 flex-wrap">
                <button
                    onClick={() => setFilterCategory('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                        filterCategory === 'all' ? 'bg-white text-brand-dark' : 'bg-white/10 text-gray-400 hover:bg-white/20'
                    }`}
                >
                    All ({drills.length})
                </button>
                {Object.entries(CATEGORY_CONFIG).map(([cat, config]) => {
                    const count = drills.filter(d => d.category === cat).length;
                    if (count === 0) return null;
                    const Icon = config.icon;
                    return (
                        <button
                            key={cat}
                            onClick={() => setFilterCategory(cat)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1 ${
                                filterCategory === cat ? `${config.bg} ${config.text} border ${config.border}` : 'bg-white/5 text-gray-500 hover:bg-white/10'
                            }`}
                        >
                            <Icon className="w-3 h-3" /> {config.label} ({count})
                        </button>
                    );
                })}
            </div>

            {/* Drill Library Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {drills
                    .filter(d => filterCategory === 'all' || d.category === filterCategory)
                    .map((drill) => {
                        const cat = getCategoryConfig(drill.category);
                        const CatIcon = cat.icon;
                        return (
                            <div
                                key={drill.id}
                                onClick={() => setSelectedDrill(drill)}
                                className={`glass-panel p-4 group hover:${cat.border} transition-all cursor-pointer relative overflow-hidden border-l-2 ${cat.border}`}
                            >
                                <div className="h-28 bg-gray-800 rounded mb-3 relative overflow-hidden">
                                    <img
                                        src={drill.image_url || drill.image}
                                        alt={drill.name}
                                        className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:scale-110 transition-transform duration-500"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                                    {/* Category badge */}
                                    <div className={`absolute top-2 left-2 ${cat.bg} ${cat.text} px-2 py-0.5 rounded text-[9px] font-bold uppercase flex items-center gap-1`}>
                                        <CatIcon className="w-2.5 h-2.5" /> {cat.label}
                                    </div>

                                    {/* Duration badge */}
                                    <div className="absolute top-2 right-2 bg-black/60 text-white px-2 py-0.5 rounded text-[9px] font-bold flex items-center gap-1">
                                        <Clock className="w-2.5 h-2.5" /> {drill.duration} min
                                    </div>

                                    {/* Hover overlay */}
                                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-3">
                                        <p className="text-[11px] text-gray-200 text-center leading-relaxed line-clamp-4">{drill.description}</p>
                                    </div>
                                </div>

                                <h4 className="text-white font-bold text-sm leading-tight">{drill.name}</h4>
                                <p className={`text-[10px] mt-1 ${cat.text} font-bold uppercase flex items-center gap-1`}>
                                    <CatIcon className="w-3 h-3" /> {drill.duration} Min
                                </p>
                            </div>
                        );
                    })}
            </div>

            {/* Drill Detail Modal */}
            {selectedDrill && (() => {
                const cat = getCategoryConfig(selectedDrill.category);
                const CatIcon = cat.icon;
                return (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedDrill(null)}>
                        <div className="bg-brand-dark border border-white/10 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                            {/* Image header */}
                            <div className="h-48 relative">
                                <img
                                    src={selectedDrill.image_url || selectedDrill.image}
                                    alt={selectedDrill.name}
                                    className="absolute inset-0 w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/50 to-transparent" />
                                <button onClick={() => setSelectedDrill(null)} className="absolute top-4 right-4 p-2 bg-black/50 rounded-full hover:bg-black/80 transition-colors">
                                    <X className="w-5 h-5 text-white" />
                                </button>
                                <div className="absolute bottom-4 left-4 right-4">
                                    <div className={`${cat.bg} ${cat.text} px-2.5 py-1 rounded text-[10px] font-bold uppercase inline-flex items-center gap-1 mb-2`}>
                                        <CatIcon className="w-3 h-3" /> {selectedDrill.category}
                                    </div>
                                    <h3 className="text-xl text-white font-bold font-display">{selectedDrill.name}</h3>
                                </div>
                            </div>

                            {/* Details */}
                            <div className="p-6 space-y-4">
                                <div className="flex gap-4">
                                    <div className="flex items-center gap-2 text-sm text-gray-300">
                                        <Clock className="w-4 h-4 text-blue-400" /> {selectedDrill.duration} minutes
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-300">
                                        <Target className="w-4 h-4 text-orange-400" /> ~{Math.round((selectedDrill.touch_weight || 8) * selectedDrill.duration)} est. touches
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xs text-gray-500 uppercase font-bold mb-1">Description</h4>
                                    <p className="text-sm text-gray-300 leading-relaxed">{selectedDrill.description || 'No description available.'}</p>
                                </div>

                                {selectedDrill.video_url && (
                                    <div>
                                        <h4 className="text-xs text-gray-500 uppercase font-bold mb-1">Video</h4>
                                        <a href={selectedDrill.video_url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-green hover:underline flex items-center gap-1">
                                            <Play className="w-4 h-4" /> Watch Demo
                                        </a>
                                    </div>
                                )}

                                <button
                                    onClick={() => setSelectedDrill(null)}
                                    className="w-full py-3 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:bg-white/10 transition-colors text-sm font-bold uppercase"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default TrainingView;
