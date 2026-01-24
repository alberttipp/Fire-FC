import React, { useState, useEffect } from 'react';
import { Dumbbell, Play, Plus, Calendar } from 'lucide-react';
import AssignDrillModal from './AssignDrillModal';
import CreateEventModal from './CreateEventModal';
import { drills as mockDrills } from '../../data/drills';
import { supabase } from '../../supabaseClient';

const TrainingView = () => {
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showCreateTrainingModal, setShowCreateTrainingModal] = useState(false);
    const [drills, setDrills] = useState([]);

    useEffect(() => {
        const fetchDrills = async () => {
            const { data, error } = await supabase
                .from('drills')
                .select('*');

            if (error || !data || data.length === 0) {
                console.log("Using mock drills due to:", error?.message || "No data");
                setDrills(mockDrills);
            } else {
                setDrills(data);
            }
        };

        fetchDrills();
    }, []);

    const handleCreateTraining = (event) => {
        console.log("Created Training Event:", event);
        // In a real app, this would save to the DB
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl text-white font-display uppercase">Training Center</h2>

                <div className="flex gap-4">
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

            {showAssignModal && (
                <AssignDrillModal onClose={() => setShowAssignModal(false)} />
            )}

            {showCreateTrainingModal && (
                <CreateEventModal onClose={() => setShowCreateTrainingModal(false)} onEventCreated={handleCreateTraining} />
            )}

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
        </div>
    );
};

export default TrainingView;
