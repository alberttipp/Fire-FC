import React, { useState } from 'react';
import { X, Goal, Hand, ChevronLeft } from 'lucide-react';

// Goal attribution for a Fire FC goal, in 3 unmistakable steps:
//   1) Who scored?              (roster grid, or "Skip")
//   2) "[Name] scored! Add an assist?"  (clear Yes / No screen)
//   3) Who assisted?            (roster grid minus the scorer)
// onConfirm(scorerId|null, assistId|null) -> caller records the goal.
// Big tap targets, the scorer is shown on every later step so it's always
// clear whose goal you're attributing, and "Skip / No assist" never blocks.
const GoalAttributionModal = ({ roster = [], onConfirm, onClose }) => {
    const [step, setStep] = useState('scorer'); // 'scorer' | 'ask' | 'assist'
    const [scorer, setScorer] = useState(null);  // full player object (for display)

    const label = (p) => `${p.first_name}${p.jersey_number != null ? ` #${p.jersey_number}` : ''}`;

    const Avatar = ({ p, size = 'w-8 h-8' }) => (
        p?.avatar_url
            ? <img src={p.avatar_url} alt="" className={`${size} rounded-full object-cover shrink-0`} />
            : <span className={`${size} rounded-full bg-brand-green/15 text-brand-green text-xs font-bold flex items-center justify-center shrink-0`}>{(p?.first_name || '?').charAt(0)}</span>
    );

    const PlayerGrid = ({ list, onPick }) => (
        roster.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">No roster found for this team.</p>
        ) : (
            <div className="grid grid-cols-2 gap-2">
                {list.map(p => (
                    <button key={p.id} onClick={() => onPick(p)}
                        className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-colors">
                        <Avatar p={p} />
                        <span className="text-white text-sm font-medium truncate">{label(p)}</span>
                    </button>
                ))}
            </div>
        )
    );

    return (
        <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-brand-dark border border-white/10 w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                 style={{ maxHeight: 'min(85vh, 85dvh)' }} onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div className="shrink-0 border-b border-white/10 p-4 flex items-center gap-3">
                    {step === 'assist' && (
                        <button onClick={() => setStep('ask')} className="text-gray-400 hover:text-white -ml-1"><ChevronLeft className="w-5 h-5" /></button>
                    )}
                    {step === 'scorer' ? <Goal className="w-5 h-5 text-brand-green" /> : step === 'ask' ? <Goal className="w-5 h-5 text-brand-green" /> : <Hand className="w-5 h-5 text-brand-gold" />}
                    <h3 className="text-white font-bold flex-1">
                        {step === 'scorer' ? '⚽ Who scored?' : step === 'ask' ? 'Goal!' : '🅰️ Who assisted?'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                {/* Body */}
                {step === 'scorer' && (
                    <>
                        <div className="flex-1 min-h-0 overflow-y-auto p-3">
                            <PlayerGrid list={roster} onPick={(p) => { setScorer(p); setStep('ask'); }} />
                        </div>
                        <div className="shrink-0 border-t border-white/10 p-3">
                            <button onClick={() => onConfirm(null, null)} className="w-full py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-bold transition-colors">
                                Skip — log goal without scorer
                            </button>
                        </div>
                    </>
                )}

                {step === 'ask' && (
                    <div className="p-5 flex flex-col items-center text-center">
                        <Avatar p={scorer} size="w-20 h-20" />
                        <div className="mt-3 text-2xl font-display font-bold text-white">⚽ {scorer?.first_name} scored!</div>
                        <p className="text-gray-400 text-sm mt-1 mb-5">Did someone set it up?</p>
                        <button onClick={() => setStep('assist')}
                            className="w-full py-3.5 rounded-xl bg-brand-gold text-brand-dark font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-white transition-colors">
                            <Hand className="w-5 h-5" /> Add an assist
                        </button>
                        <button onClick={() => onConfirm(scorer?.id ?? null, null)}
                            className="w-full mt-2 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-bold transition-colors">
                            No assist — log the goal
                        </button>
                    </div>
                )}

                {step === 'assist' && (
                    <>
                        <div className="shrink-0 px-4 pt-3 -mb-1 flex items-center gap-2 text-xs text-gray-400">
                            <Avatar p={scorer} size="w-5 h-5" /> Assist for <span className="text-white font-medium">{scorer?.first_name}</span>’s goal
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto p-3">
                            <PlayerGrid list={roster.filter(p => p.id !== scorer?.id)} onPick={(p) => onConfirm(scorer?.id ?? null, p.id)} />
                        </div>
                        <div className="shrink-0 border-t border-white/10 p-3">
                            <button onClick={() => onConfirm(scorer?.id ?? null, null)} className="w-full py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-bold transition-colors">
                                No assist — log the goal
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default GoalAttributionModal;
