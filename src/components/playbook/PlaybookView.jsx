import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Loader2, ChevronRight } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { PLAYBOOK_SHAPES, PLAYBOOK_SLOT_ORDER, slotForPosition } from '../../data/playbookShapes';
import PlaybookLessonSheet from './PlaybookLessonSheet';

// "The Playbook" — a player-facing tactics board. Tap your spot (or any spot) to
// learn that position's job, then pass a 3-question quiz to earn Position Master.
// The WE HAVE IT / THEY HAVE IT toggle slides every dot between attacking and
// defending shape — that motion teaches team shape without a word of lecture.
//
// Self-contained: give it teamId + playerId (+ optional position). It resolves
// the team's formation, loads the lessons + this player's progress, and renders
// NOTHING if the team has no published Playbook — so it's safe to drop anywhere.
const PlaybookView = ({ teamId, playerId, position = null, className = '' }) => {
    const [formation, setFormation] = useState(null);
    const [teamName, setTeamName] = useState('');
    const [lessons, setLessons] = useState({});      // slot_id -> lesson row
    const [mastered, setMastered] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [phase, setPhase] = useState('attack');    // 'attack' | 'defend'
    const [openSlot, setOpenSlot] = useState(null);

    const loadProgress = async (fmt) => {
        if (!playerId || !fmt) return;
        const { data } = await supabase
            .from('position_lesson_progress')
            .select('slot_id, passed')
            .eq('player_id', playerId)
            .eq('formation', fmt);
        setMastered(new Set((data || []).filter(r => r.passed).map(r => r.slot_id)));
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!teamId) { setLoading(false); return; }
            setLoading(true);
            const { data: team } = await supabase
                .from('teams').select('name, default_formation').eq('id', teamId).maybeSingle();
            const fmt = team?.default_formation || '4-4-2';
            if (cancelled) return;
            setTeamName(team?.name || '');
            setFormation(fmt);

            const { data: rows } = await supabase
                .from('position_lessons')
                .select('slot_id, content')
                .eq('team_id', teamId).eq('formation', fmt).eq('status', 'published');
            if (cancelled) return;
            const map = {};
            (rows || []).forEach(r => { map[r.slot_id] = r; });
            setLessons(map);
            await loadProgress(fmt);
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [teamId, playerId]);

    const mySlot = useMemo(() => slotForPosition(formation, position), [formation, position]);
    const shape = formation ? PLAYBOOK_SHAPES[formation] : null;
    const order = (formation && PLAYBOOK_SLOT_ORDER[formation]) || Object.keys(shape || {});
    const lessonCount = Object.keys(lessons).length;

    // Nothing to show unless this formation has a shape map AND published lessons.
    if (!loading && (!shape || lessonCount === 0)) return null;

    return (
        <div className={`glass-panel p-5 ${className}`}>
            <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="text-lg text-white font-display uppercase font-bold flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-brand-green" /> The Playbook
                </h3>
                {formation && <span className="text-[11px] font-bold uppercase tracking-wider text-brand-gold bg-brand-gold/10 border border-brand-gold/30 rounded px-2 py-0.5">{formation}</span>}
            </div>
            <p className="text-gray-400 text-xs mb-4">
                Tap a spot to learn that job. Pass the quiz to earn <span className="text-brand-gold font-semibold">Position Master</span>.
            </p>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-brand-green animate-spin" /></div>
            ) : (
                <>
                    {/* Possession toggle */}
                    <div className="flex rounded-xl border border-white/10 bg-white/5 p-1 mb-3 max-w-sm mx-auto">
                        {[['attack', 'WE HAVE IT ⚽'], ['defend', 'THEY HAVE IT']].map(([k, lbl]) => (
                            <button key={k} onClick={() => setPhase(k)}
                                className={`flex-1 py-2 rounded-lg text-[11px] sm:text-xs font-display font-bold uppercase tracking-wider transition-all ${
                                    phase === k
                                        ? (k === 'attack' ? 'bg-brand-green text-brand-dark shadow' : 'bg-blue-500 text-white shadow')
                                        : 'text-gray-400 hover:text-white'}`}>
                                {lbl}
                            </button>
                        ))}
                    </div>

                    {/* Pitch */}
                    <div className="relative w-full max-w-[330px] mx-auto aspect-[2/3] rounded-lg overflow-hidden border-2 border-white/20 bg-gradient-to-b from-emerald-700 to-emerald-800 shadow-xl">
                        <svg viewBox="0 0 100 150" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                            <rect x="2" y="2" width="96" height="146" fill="none" stroke="white" strokeWidth="0.4" strokeOpacity="0.7" />
                            <line x1="2" y1="75" x2="98" y2="75" stroke="white" strokeWidth="0.3" strokeOpacity="0.6" />
                            <circle cx="50" cy="75" r="9" fill="none" stroke="white" strokeWidth="0.3" strokeOpacity="0.6" />
                            <rect x="22" y="120" width="56" height="20" fill="none" stroke="white" strokeWidth="0.3" strokeOpacity="0.6" />
                            <rect x="35" y="135" width="30" height="8" fill="none" stroke="white" strokeWidth="0.3" strokeOpacity="0.6" />
                            <rect x="22" y="10" width="56" height="20" fill="none" stroke="white" strokeWidth="0.3" strokeOpacity="0.6" />
                            <rect x="35" y="7" width="30" height="8" fill="none" stroke="white" strokeWidth="0.3" strokeOpacity="0.6" />
                            {[0,1,2,3,4,5,6].map(i => (
                                <rect key={i} x="0" y={i * 21} width="100" height="10.5" fill="black" fillOpacity={i % 2 === 0 ? '0.06' : '0'} />
                            ))}
                        </svg>

                        {order.map((slot) => {
                            const pos = shape[slot]?.[phase];
                            if (!pos) return null;
                            const [x, y] = pos;
                            const isMe = slot === mySlot;
                            const isMastered = mastered.has(slot);
                            const hasLesson = !!lessons[slot];
                            return (
                                <button
                                    key={slot}
                                    type="button"
                                    onClick={() => hasLesson && setOpenSlot(slot)}
                                    style={{ left: `${x}%`, top: `${y}%` }}
                                    className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-out flex flex-col items-center"
                                >
                                    <span className={`relative w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-display font-black shadow-lg border-2 ${
                                        isMe ? 'bg-brand-green text-brand-dark border-white animate-pulse'
                                             : 'bg-brand-dark/90 text-white border-white/40'}`}>
                                        {slot}
                                        {isMastered && <span className="absolute -top-1 -right-1 text-[10px] bg-brand-gold text-brand-dark rounded-full w-4 h-4 flex items-center justify-center border border-brand-dark">✓</span>}
                                    </span>
                                    {isMe && <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-brand-green bg-brand-dark/70 rounded px-1">You</span>}
                                </button>
                            );
                        })}
                    </div>

                    {/* Quick legend / progress */}
                    <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-gray-400">
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-brand-green border border-white inline-block" /> Your spot</span>
                        <span className="flex items-center gap-1.5"><span className="text-brand-gold">✓</span> Mastered ({mastered.size}/{lessonCount})</span>
                    </div>

                    {mySlot && lessons[mySlot] && (
                        <button onClick={() => setOpenSlot(mySlot)}
                            className="mt-4 w-full py-3 rounded-xl bg-brand-green/10 border border-brand-green/40 text-brand-green font-display font-bold uppercase tracking-wider text-sm hover:bg-brand-green/20 transition-colors flex items-center justify-center gap-2">
                            Learn my position <ChevronRight className="w-4 h-4" />
                        </button>
                    )}
                </>
            )}

            {openSlot && lessons[openSlot] && (
                <PlaybookLessonSheet
                    lesson={lessons[openSlot]}
                    slotId={openSlot}
                    formation={formation}
                    playerId={playerId}
                    alreadyPassed={mastered.has(openSlot)}
                    onClose={() => setOpenSlot(null)}
                    onMastered={() => loadProgress(formation)}
                />
            )}
        </div>
    );
};

export default PlaybookView;
