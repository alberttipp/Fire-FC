import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Shield, Swords, Zap, Users, PlayCircle, CheckCircle, Trophy, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase } from '../../supabaseClient';
import { SLOT_LABELS } from '../coach-hq/lineup/formations';

// Bottom-sheet lesson for one position: the role, golden rules, what to do in
// each phase, partners, an optional coach video, and a 3-question quiz.
// Portaled to <body> so a glass-panel ancestor's backdrop-filter can't trap the
// fixed positioning (see feedback_firefc_glass_panel_trap).
const PHASE_META = {
    attack:     { icon: Swords, color: 'text-brand-green', ring: 'border-brand-green/30 bg-brand-green/5' },
    defend:     { icon: Shield, color: 'text-blue-300',    ring: 'border-blue-400/30 bg-blue-500/5' },
    transition: { icon: Zap,    color: 'text-brand-gold',  ring: 'border-brand-gold/30 bg-brand-gold/5' },
};

const PlaybookLessonSheet = ({ lesson, slotId, formation, playerId, alreadyPassed = false, onClose, onMastered }) => {
    const c = lesson?.content || {};
    const quiz = Array.isArray(c.quiz) ? c.quiz : [];
    const label = SLOT_LABELS[slotId] || slotId;

    const [mode, setMode] = useState('learn');       // 'learn' | 'quiz' | 'done'
    const [qi, setQi] = useState(0);
    const [selected, setSelected] = useState(null);
    const [revealed, setRevealed] = useState(false);
    const [correct, setCorrect] = useState(0);
    const [result, setResult] = useState(null);       // { passed, newly_awarded_badge }
    const [saving, setSaving] = useState(false);

    const pick = (idx) => {
        if (revealed) return;
        setSelected(idx);
        setRevealed(true);
        if (idx === quiz[qi].answerIdx) setCorrect((n) => n + 1);
    };

    const next = async () => {
        if (qi < quiz.length - 1) {
            setQi(qi + 1); setSelected(null); setRevealed(false);
            return;
        }
        // Finished — record the attempt.
        setSaving(true);
        const finalCorrect = correct; // already includes the last question
        try {
            const { data } = await supabase.rpc('record_playbook_quiz', {
                p_player_id: playerId,
                p_formation: formation,
                p_slot_id: slotId,
                p_score: finalCorrect,
                p_total: quiz.length,
            });
            const res = data || { passed: finalCorrect >= Math.ceil(quiz.length * 2 / 3) };
            setResult(res);
            setMode('done');
            if (res.passed) {
                confetti({ particleCount: 90, spread: 70, startVelocity: 34, scalar: 0.9,
                    origin: { y: 0.5 }, colors: ['#e8c15a', '#3ddc84', '#ffffff'] });
                onMastered && onMastered(slotId);
            }
        } catch {
            setResult({ passed: finalCorrect >= Math.ceil(quiz.length * 2 / 3) });
            setMode('done');
        } finally {
            setSaving(false);
        }
    };

    const sheet = (
        <div className="fixed inset-0 z-[130] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div
                className="bg-brand-dark border border-white/10 w-full md:max-w-lg rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto"
                style={{ maxHeight: 'min(92vh, 92dvh)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center gap-3 p-4 border-b border-white/10 bg-brand-dark/95 backdrop-blur">
                    <div className="w-11 h-11 rounded-xl bg-brand-green/15 border border-brand-green/30 flex items-center justify-center text-brand-green font-display font-black text-sm shrink-0">
                        {slotId}
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-white font-display uppercase font-bold tracking-wider leading-tight truncate">
                            {c.nickname || label}
                        </h3>
                        <p className="text-gray-400 text-xs truncate">{label}{alreadyPassed ? ' · ✅ Mastered' : ''}</p>
                    </div>
                    <button onClick={onClose} className="ml-auto text-gray-400 hover:text-white shrink-0"><X className="w-6 h-6" /></button>
                </div>

                {mode === 'learn' && (
                    <div className="p-5 space-y-5">
                        {c.oneLiner && <p className="text-lg text-white font-semibold leading-snug">{c.oneLiner}</p>}

                        {/* Golden rules */}
                        {Array.isArray(c.goldenRules) && c.goldenRules.length > 0 && (
                            <div>
                                <p className="text-[11px] uppercase tracking-widest text-brand-gold font-bold mb-2">Your Golden Rules</p>
                                <div className="space-y-2">
                                    {c.goldenRules.map((r, i) => (
                                        <div key={i} className="rounded-xl border border-brand-gold/20 bg-brand-gold/5 p-3">
                                            <p className="text-white font-bold text-sm flex gap-2"><span className="text-brand-gold">{i + 1}.</span>{r.rule}</p>
                                            {r.why && <p className="text-gray-400 text-xs mt-1 pl-5">{r.why}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Phases */}
                        <div className="space-y-2">
                            {['attack', 'defend', 'transition'].map((k) => {
                                const ph = c.phases?.[k];
                                if (!ph) return null;
                                const M = PHASE_META[k]; const Icon = M.icon;
                                return (
                                    <div key={k} className={`rounded-xl border p-3 ${M.ring}`}>
                                        <p className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5 ${M.color}`}>
                                            <Icon className="w-4 h-4" /> {ph.title}
                                        </p>
                                        <ul className="space-y-1">
                                            {(ph.points || []).map((p, i) => (
                                                <li key={i} className="text-sm text-gray-200 flex gap-2"><span className={M.color}>•</span>{p}</li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Partners */}
                        {Array.isArray(c.partners) && c.partners.length > 0 && (
                            <div>
                                <p className="text-[11px] uppercase tracking-widest text-gray-400 font-bold mb-2 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> You work with</p>
                                <div className="flex flex-wrap gap-2">
                                    {c.partners.map((p, i) => (
                                        <span key={i} className="text-xs bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-gray-200">
                                            <span className="font-bold text-white">{p.label}</span>{p.why ? ` — ${p.why}` : ''}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Coach video (deep dive — links out to the source) */}
                        {c.video?.id && (
                            <a href={`https://www.youtube.com/watch?v=${c.video.id}`} target="_blank" rel="noreferrer"
                                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-colors">
                                <PlayCircle className="w-8 h-8 text-brand-green shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-white text-sm font-bold truncate">Deep dive: {c.video.title}</p>
                                    <p className="text-gray-500 text-[11px]">{c.video.channel} · watch on YouTube</p>
                                </div>
                            </a>
                        )}

                        {quiz.length > 0 && (
                            <button onClick={() => setMode('quiz')}
                                className="w-full py-3.5 rounded-xl bg-brand-green text-brand-dark font-display font-bold uppercase tracking-wider hover:bg-white transition-colors flex items-center justify-center gap-2">
                                <Trophy className="w-5 h-5" /> {alreadyPassed ? 'Retake the quiz' : 'Take the quiz'}
                            </button>
                        )}
                    </div>
                )}

                {mode === 'quiz' && quiz[qi] && (
                    <div className="p-5 space-y-4">
                        <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-gray-500 font-bold">
                            <span>Question {qi + 1} of {quiz.length}</span>
                            <span>{correct} correct</span>
                        </div>
                        <p className="text-white text-lg font-semibold leading-snug">{quiz[qi].q}</p>
                        <div className="space-y-2">
                            {quiz[qi].choices.map((ch, i) => {
                                const isAnswer = i === quiz[qi].answerIdx;
                                const isPicked = i === selected;
                                let cls = 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10';
                                if (revealed && isAnswer) cls = 'bg-brand-green/15 border-brand-green/50 text-white';
                                else if (revealed && isPicked && !isAnswer) cls = 'bg-red-500/15 border-red-500/50 text-white';
                                return (
                                    <button key={i} onClick={() => pick(i)} disabled={revealed}
                                        className={`w-full text-left p-3.5 rounded-xl border text-sm font-medium transition-colors flex items-center gap-2 ${cls}`}>
                                        {revealed && isAnswer && <CheckCircle className="w-4 h-4 text-brand-green shrink-0" />}
                                        {ch}
                                    </button>
                                );
                            })}
                        </div>
                        {revealed && (
                            <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/10 p-3 animate-fade-in">
                                <p className="text-[11px] uppercase tracking-wider text-brand-gold font-bold mb-1">Coach says</p>
                                <p className="text-sm text-gray-100">{quiz[qi].coachSays}</p>
                            </div>
                        )}
                        <button onClick={next} disabled={!revealed || saving}
                            className="w-full py-3 rounded-xl bg-brand-green text-brand-dark font-display font-bold uppercase tracking-wider hover:bg-white transition-colors flex items-center justify-center gap-2 disabled:opacity-40">
                            {qi < quiz.length - 1 ? <>Next <ArrowRight className="w-5 h-5" /></> : (saving ? 'Saving…' : 'Finish')}
                        </button>
                    </div>
                )}

                {mode === 'done' && result && (
                    <div className="p-6 text-center space-y-4">
                        {result.passed ? (
                            <>
                                <div className="w-20 h-20 mx-auto rounded-full bg-brand-gold/15 border-2 border-brand-gold/40 flex items-center justify-center text-4xl">🎯</div>
                                <h3 className="text-2xl font-display font-black text-white uppercase">Position Mastered!</h3>
                                <p className="text-gray-300">You got <span className="text-brand-green font-bold">{correct}/{quiz.length}</span> — you know your job as {c.nickname || label}.</p>
                                {result.newly_awarded_badge && (
                                    <div className="inline-flex items-center gap-2 rounded-full bg-brand-gold/15 border border-brand-gold/40 px-4 py-2 text-brand-gold font-bold text-sm">
                                        <Trophy className="w-4 h-4" /> New badge: Position Master
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="w-20 h-20 mx-auto rounded-full bg-white/5 border-2 border-white/15 flex items-center justify-center text-4xl">💪</div>
                                <h3 className="text-2xl font-display font-black text-white uppercase">So close!</h3>
                                <p className="text-gray-300">You got <span className="text-white font-bold">{correct}/{quiz.length}</span>. Review your golden rules and try again — you've got this.</p>
                            </>
                        )}
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => { setMode('learn'); setQi(0); setSelected(null); setRevealed(false); setCorrect(0); }}
                                className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-200 font-bold uppercase tracking-wider text-sm hover:bg-white/10">
                                Review
                            </button>
                            <button onClick={onClose}
                                className="flex-1 py-3 rounded-xl bg-brand-green text-brand-dark font-bold uppercase tracking-wider text-sm hover:bg-white">
                                Done
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(sheet, document.body);
};

export default PlaybookLessonSheet;
