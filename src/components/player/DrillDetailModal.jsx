import React from 'react';
import { X, PlayCircle, Clock, Award, CheckCircle } from 'lucide-react';

const DrillDetailModal = ({ drill, onClose, onComplete }) => {
    if (!drill) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-brand-dark border border-white/10 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl relative animate-scale-up">
                {/* Header Image / Video Placeholder */}
                <div className="h-48 bg-gray-900 relative group cursor-pointer">
                    <img
                        src="https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=1000&auto=format&fit=crop"
                        alt="Drill Preview"
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <PlayCircle className="w-16 h-16 text-brand-green fill-brand-green/20 drop-shadow-lg group-hover:scale-110 transition-transform" />
                    </div>
                    {/* Close Button */}
                    <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-brand-green text-xs font-bold uppercase tracking-widest border border-brand-green/30 px-2 py-1 rounded bg-brand-green/5">
                            Technical Drill
                        </span>
                        <div className="flex items-center gap-4 text-gray-400 text-sm">
                            <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {drill.duration}</span>
                            <span className="flex items-center gap-1 text-brand-gold"><Award className="w-4 h-4" /> {drill.xp} XP</span>
                        </div>
                    </div>

                    <h2 className="text-3xl text-white font-display uppercase font-bold mb-4">{drill.title}</h2>

                    <div className="space-y-4 mb-8">
                        <div>
                            <h4 className="text-gray-400 text-xs font-bold uppercase mb-2">Instructions</h4>
                            <p className="text-gray-300 text-sm leading-relaxed">
                                Set up two cones 5 yards apart. Pass the ball against a wall, receive it with a directional touch around the cone, and pass again. Focus on clean contact and quick footwork.
                            </p>
                        </div>
                        <div>
                            <h4 className="text-gray-400 text-xs font-bold uppercase mb-2">Key Points</h4>
                            <ul className="text-gray-300 text-sm list-disc pl-5 space-y-1">
                                <li>Keep on your toes.</li>
                                <li>Use inside of the foot for passing.</li>
                                <li>Head up before receiving.</li>
                            </ul>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            onComplete(drill);
                            onClose();
                        }}
                        className="w-full py-4 bg-brand-green text-brand-dark font-display font-bold uppercase text-lg tracking-wider hover:bg-white hover:scale-[1.02] transition-all shadow-[0_0_20px_rgba(204,255,0,0.3)] rounded-lg flex items-center justify-center gap-2"
                    >
                        <CheckCircle className="w-6 h-6" /> Mark Complete
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DrillDetailModal;
