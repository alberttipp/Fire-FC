import React from 'react';
import { X, PlayCircle, Clock, CheckCircle, Dumbbell } from 'lucide-react';

// Shows a drill's REAL details (name, category, full description, optional
// video). `drill` comes from HomeworkHub/PersonalPlanCard as a light wrapper
// with `originalDrill` holding the full drills row; we fall back gracefully.
const DrillDetailModal = ({ drill, onClose, onComplete }) => {
    if (!drill) return null;

    const d = drill.originalDrill || drill;
    const title = drill.title || d.name || 'Drill';
    const category = d.category || 'Training Drill';
    const description = (d.description && d.description.trim())
        ? d.description
        : "Follow your coach's instructions for this drill — focus on clean touches and good habits.";
    const durationLabel = drill.duration || (d.duration ? `${d.duration}m` : null);
    const videoUrl = d.video_url || null;
    const imageUrl = d.image_url || null;
    const canComplete = typeof onComplete === 'function' && !drill.completed;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
        >
            <div
                className="bg-brand-dark border border-white/10 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl relative animate-scale-up max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="h-40 bg-gradient-to-br from-brand-green/20 via-brand-dark to-brand-gold/10 relative flex items-center justify-center">
                    {imageUrl
                        ? <img src={imageUrl} alt="" className="w-full h-full object-cover opacity-60" />
                        : <Dumbbell className="w-14 h-14 text-brand-green/40" />}
                    {videoUrl && (
                        <a
                            href={videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="absolute inset-0 flex items-center justify-center group"
                            aria-label="Watch drill video"
                        >
                            <PlayCircle className="w-16 h-16 text-brand-green fill-brand-green/20 drop-shadow-lg group-hover:scale-110 transition-transform" />
                        </a>
                    )}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="flex items-center justify-between mb-2 gap-3">
                        <span className="text-brand-green text-xs font-bold uppercase tracking-widest border border-brand-green/30 px-2 py-1 rounded bg-brand-green/5">
                            {category}
                        </span>
                        {durationLabel && (
                            <span className="flex items-center gap-1 text-gray-400 text-sm shrink-0">
                                <Clock className="w-4 h-4" /> {durationLabel}
                            </span>
                        )}
                    </div>

                    <h2 className="text-2xl md:text-3xl text-white font-display uppercase font-bold mb-4 break-words">{title}</h2>

                    <div className="mb-6">
                        <h4 className="text-gray-400 text-xs font-bold uppercase mb-2">How to do it</h4>
                        <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-line">{description}</p>
                        {videoUrl && (
                            <a
                                href={videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 mt-3 text-brand-green text-sm font-bold hover:underline"
                            >
                                <PlayCircle className="w-4 h-4" /> Watch the video
                            </a>
                        )}
                    </div>

                    {canComplete && (
                        <button
                            onClick={() => { onComplete(drill.id); onClose(); }}
                            className="w-full py-4 bg-brand-green text-brand-dark font-display font-bold uppercase text-lg tracking-wider hover:bg-white hover:scale-[1.02] transition-all rounded-lg flex items-center justify-center gap-2"
                        >
                            <CheckCircle className="w-6 h-6" /> Mark Complete
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DrillDetailModal;
