import React, { useState } from 'react';
import { CheckCircle, Play, Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import DrillDetailModal from './DrillDetailModal';

const INITIAL_VISIBLE = 3;

const HomeworkHub = ({ assignments, onComplete }) => {
    const [selectedDrill, setSelectedDrill] = useState(null);
    const [showAll, setShowAll] = useState(false);

    // Map DB Assignments to Display Format
    const displayDrills = (assignments || []).map(a => ({
        id: a.id, // Assignment ID
        title: a.drills?.name || "Unknown Drill",
        duration: (a.custom_duration || a.drills?.duration || 15) + "m",
        dueDate: a.due_date, // Pass due date
        completed: a.status === 'completed',
        originalDrill: a.drills // Store reference
    }));

    const getDaysLeft = (dateStr) => {
        if (!dateStr) return null;
        const diff = new Date(dateStr) - new Date();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return days;
    };

    // Sort: pending first (by due date asc), then completed last
    const drills = [...displayDrills].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return ad - bd;
    });

    const visibleDrills = showAll ? drills : drills.slice(0, INITIAL_VISIBLE);
    const hiddenCount = drills.length - visibleDrills.length;

    return (
        <div className="animate-fade-in-up">
            <h3 className="text-2xl text-white font-display uppercase font-bold mb-6 flex items-center gap-3">
                <Trophy className="text-brand-gold w-8 h-8" />
                This Week's Training
            </h3>

            <div className="space-y-4">
                {visibleDrills.map((drill) => {
                    const daysLeft = getDaysLeft(drill.dueDate);
                    let timeStatus = "";
                    let timeColor = "text-gray-400";

                    if (daysLeft !== null) {
                        if (daysLeft < 0) { timeStatus = "Overdue"; timeColor = "text-red-500 font-bold"; }
                        else if (daysLeft === 0) { timeStatus = "Due Today"; timeColor = "text-brand-gold font-bold"; }
                        else { timeStatus = `${daysLeft} Days Left`; timeColor = "text-brand-green"; }
                    }

                    return (
                        <div
                            key={drill.id}
                            onClick={() => !drill.completed && setSelectedDrill(drill)}
                            className={`relative p-4 rounded-xl border transition-all cursor-pointer ${drill.completed ? 'bg-brand-green/10 border-brand-green/50 opacity-70' : 'bg-glass border-white/10 hover:border-brand-gold/50 hover:bg-white/5'}`}
                        >
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${drill.completed ? 'bg-brand-green text-brand-dark' : 'bg-gray-800 text-gray-500'}`}>
                                        {drill.completed ? <CheckCircle className="w-6 h-6" /> : <Play className="w-6 h-6 fill-current" />}
                                    </div>
                                    <div>
                                        <h4 className={`font-display font-bold text-lg uppercase ${drill.completed ? 'text-brand-green line-through' : 'text-white'}`}>{drill.title}</h4>
                                        <div className="flex items-center gap-3 text-xs font-bold">
                                            <span className="text-gray-400">{drill.duration}</span>
                                            {!drill.completed && timeStatus && (
                                                <span className={`${timeColor} uppercase tracking-wider`}>• {timeStatus}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <button
                                    disabled={drill.completed}
                                    className={`px-4 py-2 rounded font-bold uppercase text-xs tracking-wider transition-all ${drill.completed ? 'text-brand-green' : 'bg-brand-gold text-brand-dark group-hover:bg-white'}`}
                                >
                                    {drill.completed ? 'Done' : 'View'}
                                </button>
                            </div>
                        </div>
                    );
                })}

                {/* Show more / show less toggle */}
                {drills.length > INITIAL_VISIBLE && (
                    <button
                        onClick={() => setShowAll(s => !s)}
                        className="w-full py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                    >
                        {showAll ? (
                            <>
                                <ChevronUp className="w-4 h-4" /> Show Less
                            </>
                        ) : (
                            <>
                                <ChevronDown className="w-4 h-4" /> Show {hiddenCount} More
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Drill Detail Modal */}
            {selectedDrill && (
                <DrillDetailModal
                    drill={selectedDrill}
                    onClose={() => setSelectedDrill(null)}
                    onComplete={onComplete}
                />
            )}
        </div>
    );
};

export default HomeworkHub;
