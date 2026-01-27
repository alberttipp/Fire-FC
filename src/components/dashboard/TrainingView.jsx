import React, { useState, useEffect } from 'react';
import { Dumbbell, Play, Plus, Calendar, Users, ClipboardList, Mic, AlertCircle } from 'lucide-react';
import AssignDrillModal from './AssignDrillModal';
import CreateEventModal from './CreateEventModal';
import PracticeSessionBuilder from './PracticeSessionBuilder';
import TrainingClients from './TrainingClients';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

const TrainingView = () => {
    const { user, profile } = useAuth();
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showCreateTrainingModal, setShowCreateTrainingModal] = useState(false);
    const [showPracticeBuilder, setShowPracticeBuilder] = useState(false);
    const [drills, setDrills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('drills');
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

    const handleCreateTraining = (event) => {
        console.log("Created Training Event:", event);
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl text-white font-display uppercase">Training Center</h2>

                <div className="flex gap-3">
                    <button
                        onClick={() => setShowPracticeBuilder(true)}
                        className="bg-brand-gold/10 border border-brand-gold/30 text-brand-gold px-4 py-2 rounded font-bold uppercase text-sm flex items-center gap-2 hover:bg-brand-gold/20 transition-colors"
                    >
                        <ClipboardList className="w-4 h-4" /> Build Practice
                    </button>
                    <button
                        onClick={() => setShowCreateTrainingModal(true)}
                        className="bg-brand-dark border border-brand-green/50 text-brand-green px-4 py-2 rounded font-bold uppercase text-sm flex items-center gap-2 hover:bg-brand-green/10 transition-colors"
                    >
                        <Calendar className="w-4 h-4" /> Schedule Session
                    </button>
                    <button
                        onClick={() => setShowAssignModal(true)}
                        className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
                    >
                        <Plus className="w-4 h-4" /> Create Assignment
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-white/10 pb-2">
                <button
                    onClick={() => setActiveTab('drills')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${
                        activeTab === 'drills' 
                            ? 'bg-brand-green/20 text-brand-green' 
                            : 'text-gray-400 hover:text-white'
                    }`}
                >
                    <Dumbbell className="w-4 h-4" /> Drill Library
                </button>
                <button
                    onClick={() => setActiveTab('clients')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${
                        activeTab === 'clients' 
                            ? 'bg-brand-green/20 text-brand-green' 
                            : 'text-gray-400 hover:text-white'
                    }`}
                >
                    <Users className="w-4 h-4" /> Training Clients
                </button>
            </div>

            {showAssignModal && (
                <AssignDrillModal onClose={() => setShowAssignModal(false)} />
            )}

            {showCreateTrainingModal && (
                <CreateEventModal onClose={() => setShowCreateTrainingModal(false)} onEventCreated={handleCreateTraining} />
            )}

            {showPracticeBuilder && (
                <PracticeSessionBuilder 
                    onClose={() => setShowPracticeBuilder(false)}
                    teamId={teamId}
                    onSave={(session) => console.log('Session saved:', session)}
                />
            )}

            {/* Drill Library Tab */}
            {activeTab === 'drills' && (
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
                                    <span className="w-10 h-10 rounded-full bg-brand-green flex items-center justify-center shadow-[0_0_10px_#ccff00]">
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
            )}

            {/* Training Clients Tab */}
            {activeTab === 'clients' && (
                <TrainingClients />
            )}
        </div>
    );
};

export default TrainingView;
