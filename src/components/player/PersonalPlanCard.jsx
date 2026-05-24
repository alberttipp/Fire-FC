import React from 'react';
import { CheckCircle, Clock, Dumbbell, Target } from 'lucide-react';

const formatDue = (dateStr) => {
    if (!dateStr) return null;
    const days = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
    if (days < 0) return { label: 'Overdue', className: 'text-red-400' };
    if (days === 0) return { label: 'Due today', className: 'text-brand-gold' };
    return { label: `${days}d left`, className: 'text-gray-500' };
};

const PersonalPlanCard = ({ assignments = [], onComplete, readOnly = false }) => {
    const completedCount = assignments.filter(a => a.status === 'completed').length;
    const totalCount = assignments.length;

    return (
        <div className="glass-panel p-5 border-l-4 border-l-brand-green animate-fade-in-up">
            <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-brand-green text-xs uppercase font-bold tracking-wider flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Personal Plan
                </h3>
                {totalCount > 0 && (
                    <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${completedCount === totalCount ? 'bg-brand-green/20 text-brand-green' : 'bg-white/10 text-gray-300'}`}>
                        {completedCount}/{totalCount} Done
                    </span>
                )}
            </div>

            {totalCount === 0 ? (
                <div className="text-center py-5">
                    <Dumbbell className="w-7 h-7 text-gray-700 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No personal drills assigned yet.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {assignments.map(assign => {
                        const completed = assign.status === 'completed';
                        const drill = assign.drills || {};
                        const duration = assign.custom_duration || drill.duration || drill.duration_minutes || 15;
                        const due = formatDue(assign.due_date);
                        const description = drill.description || 'Follow your coach instructions for this drill.';

                        return (
                            <div
                                key={assign.id}
                                className={`rounded-lg border p-3 ${completed ? 'border-brand-green/20 bg-brand-green/5' : 'border-white/10 bg-white/5'}`}
                            >
                                <div className="flex items-start gap-3">
                                    {completed ? (
                                        <CheckCircle className="w-5 h-5 text-brand-green shrink-0 mt-0.5" />
                                    ) : (
                                        <div className="w-5 h-5 rounded-full border-2 border-brand-green/50 shrink-0 mt-0.5" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className={`text-sm font-bold ${completed ? 'text-gray-400 line-through' : 'text-white'}`}>
                                            {drill.name || drill.title || 'Drill'}
                                        </div>
                                        <div className="mt-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider flex-wrap">
                                            <span className="text-brand-green flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {duration} min
                                            </span>
                                            {drill.category && <span className="text-gray-500">{drill.category}</span>}
                                            {due && <span className={due.className}>{due.label}</span>}
                                        </div>
                                        <p className="mt-2 text-xs text-gray-400 leading-relaxed line-clamp-3">
                                            {description}
                                        </p>
                                    </div>
                                </div>

                                {!completed && !readOnly && (
                                    <button
                                        type="button"
                                        onClick={() => onComplete(assign.id)}
                                        className="mt-3 w-full py-2 rounded-lg bg-brand-green text-brand-dark font-display font-bold uppercase tracking-wider text-xs hover:bg-brand-green/90 transition-colors"
                                    >
                                        Mark Done
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default PersonalPlanCard;
