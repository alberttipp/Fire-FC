import React, { useState, useEffect } from 'react';
import { Dumbbell, Play, Plus, ClipboardList, AlertCircle } from 'lucide-react';
import AssignDrillModal from './AssignDrillModal';
import PracticeSessionBuilder from './PracticeSessionBuilder';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

const TrainingView = () => {
    const { user, profile } = useAuth();
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showPracticeBuilder, setShowPracticeBuilder] = useState(false);
    const [drills, setDrills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [teamId, setTeamId] = useState(null);

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
                        onClick={() => setShowPracticeBuilder(true)}
                        className="bg-brand-gold/10 border border-brand-gold/30 text-brand-gold px-4 py-2 rounded font-bold uppercase text-sm flex items-center gap-2 hover:bg-brand-gold/20 transition-colors"
                    >
                        <ClipboardList className="w-4 h-4" /> Build Practice
                    </button>
                    <button
                        onClick={() => setShowAssignModal(true)}
                        className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
                    >
                        <Plus className="w-4 h-4" /> Assign Homework
                    </button>
                </div>
            </div>

            {showAssignModal && (
                <AssignDrillModal onClose={() => setShowAssignModal(false)} />
            )}

            {showPracticeBuilder && (
                <PracticeSessionBuilder
                    onClose={() => setShowPracticeBuilder(false)}
                    onSave={(session) => console.log('Session saved:', session)}
                />
            )}

            {/* Drill Library */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {drills.map((drill) => (
                    <div key={drill.id} className="glass-panel p-4 group hover:border-brand-green/50 transition-colors cursor-pointer relative overflow-hidden">
                        <div className="h-32 bg-gray-800 rounded mb-3 flex items-center justify-center relative overflow-hidden">
                            <img
                                src={drill.image_url || drill.image}
                                alt={drill.title}
                                className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors"></div>

                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <span className="w-10 h-10 rounded-full bg-brand-green flex items-center justify-center shadow-[0_0_10px_#3b82f6]">
                                    <Play className="text-brand-dark w-5 h-5 fill-current ml-0.5" />
                                </span>
                            </div>
                        </div>
                        <h4 className="text-white font-bold font-display uppercase relative z-10">{drill.title}</h4>
                        <p className="text-xs text-brand-gold mt-1 relative z-10 flex items-center gap-1 font-bold">
                            <Dumbbell className="w-3 h-3" /> {drill.duration_minutes || drill.duration} Min • {drill.skill}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TrainingView;
