import React, { useState } from 'react';
import { X, Goal, Hand } from 'lucide-react';

// Two-step goal attribution for a Fire FC goal:
//   1) Who scored?   (roster grid, or "Skip")
//   2) Assist?       (roster grid minus the scorer, or "No assist")
// onConfirm(scorerId|null, assistId|null) -> caller records the goal.
// Designed to be fast on the sideline — big tap targets, two taps to log a
// goal+assist, and "Skip" never blocks a chaotic moment.
const GoalAttributionModal = ({ roster = [], onConfirm, onClose }) => {
    const [step, setStep] = useState('scorer'); // 'scorer' | 'assist'
    const [scorerId, setScorerId] = useState(null);

    const label = (p) => `${p.first_name}${p.jersey_number != null ? ` #${p.jersey_number}` : ''}`;

    const pickScorer = (id) => { setScorerId(id); setStep('assist'); };
    const finish = (assistId) => onConfirm(scorerId, assistId);

    const list = step === 'assist' ? roster.filter(p => p.id !== scorerId) : roster;

    return (
        <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-brand-dark border border-white/10 w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                 style={{ maxHeight: 'min(85vh, 85dvh)' }} onClick={(e) => e.stopPropagation()}>
                <div className="shrink-0 border-b border-white/10 p-4 flex items-center gap-3">
                    {step === 'scorer'
                        ? <Goal className="w-5 h-5 text-brand-green" />
                        : <Hand className="w-5 h-5 text-brand-gold" />}
                    <h3 className="text-white font-bold flex-1">
                        {step === 'scorer' ? '⚽ Who scored?' : '🅰️ Assist?'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-3">
                    {roster.length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-6">No roster found for this team.</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {list.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => step === 'scorer' ? pickScorer(p.id) : finish(p.id)}
                                    className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-colors"
                                >
                                    {p.avatar_url
                                        ? <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                                        : <span className="w-8 h-8 rounded-full bg-brand-green/15 text-brand-green text-xs font-bold flex items-center justify-center shrink-0">{(p.first_name || '?').charAt(0)}</span>}
                                    <span className="text-white text-sm font-medium truncate">{label(p)}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="shrink-0 border-t border-white/10 p-3">
                    <button
                        onClick={() => finish(null)}
                        className="w-full py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-bold transition-colors"
                    >
                        {step === 'scorer' ? 'Skip — log goal without scorer' : 'No assist — log the goal'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GoalAttributionModal;
