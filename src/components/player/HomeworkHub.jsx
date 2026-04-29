import React, { useMemo, useState } from 'react';
import { CheckCircle, ChevronDown, ChevronUp, Clipboard, Star, Dumbbell } from 'lucide-react';
import DrillDetailModal from './DrillDetailModal';

// Maps each source to its visual identity. Color-coded per Albert's request
// so kids can scan their week at a glance:
//   coach  = blue   (assignments from the head coach)
//   parent = gold   (parent-built solo sessions)
//   player = green  (drills the kid built themselves)
const SOURCE_META = {
    coach: {
        title: 'Coach Homework',
        icon: Clipboard,
        accent: 'blue',
        ring: 'border-blue-500/40',
        ringHover: 'hover:border-blue-500/70',
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        leftBar: 'border-l-blue-500',
    },
    parent: {
        title: 'Parent Solo Practice',
        icon: Star,
        accent: 'gold',
        ring: 'border-brand-gold/40',
        ringHover: 'hover:border-brand-gold/70',
        bg: 'bg-brand-gold/10',
        text: 'text-brand-gold',
        leftBar: 'border-l-brand-gold',
    },
    player: {
        title: 'My Solo Training',
        icon: Dumbbell,
        accent: 'green',
        ring: 'border-brand-green/40',
        ringHover: 'hover:border-brand-green/70',
        bg: 'bg-brand-green/10',
        text: 'text-brand-green',
        leftBar: 'border-l-brand-green',
    },
};

const SOURCE_ORDER = ['coach', 'parent', 'player'];

const formatDays = (dateStr) => {
    if (!dateStr) return null;
    const days = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { label: 'Overdue', className: 'text-red-500 font-bold' };
    if (days === 0) return { label: 'Due Today', className: 'text-brand-gold font-bold' };
    return { label: `${days}d left`, className: 'text-gray-400' };
};

const HomeworkHub = ({ assignments, onComplete }) => {
    const [selectedDrill, setSelectedDrill] = useState(null);
    const [expandedSessions, setExpandedSessions] = useState(() => new Set());

    // Group flat assignment rows into sessions. Anything sharing a session_id
    // is one session; anything without a session_id (legacy / coach one-offs)
    // becomes its own one-drill session keyed by assignment id.
    const grouped = useMemo(() => {
        const buckets = { coach: [], parent: [], player: [] };
        const sessionMap = new Map();
        for (const a of (assignments || [])) {
            const source = SOURCE_META[a.source] ? a.source : 'coach';
            const key = a.session_id ? `${source}:${a.session_id}` : `${source}:solo:${a.id}`;
            let s = sessionMap.get(key);
            if (!s) {
                s = {
                    key,
                    source,
                    sessionId: a.session_id,
                    drills: [],
                    totalMinutes: 0,
                    earliestDue: null,
                    allCompleted: true,
                    earliestCreated: a.created_at,
                };
                sessionMap.set(key, s);
                if (buckets[source]) buckets[source].push(s);
            }
            s.drills.push(a);
            s.totalMinutes += (a.custom_duration || a.drills?.duration || 15);
            if (a.due_date) {
                if (!s.earliestDue || new Date(a.due_date) < new Date(s.earliestDue)) {
                    s.earliestDue = a.due_date;
                }
            }
            if (a.status !== 'completed') s.allCompleted = false;
            if (a.created_at && (!s.earliestCreated || new Date(a.created_at) < new Date(s.earliestCreated))) {
                s.earliestCreated = a.created_at;
            }
        }
        // Sort each bucket: incomplete first, then by earliest due date asc.
        for (const k of Object.keys(buckets)) {
            buckets[k].sort((a, b) => {
                if (a.allCompleted !== b.allCompleted) return a.allCompleted ? 1 : -1;
                const ad = a.earliestDue ? new Date(a.earliestDue).getTime() : Infinity;
                const bd = b.earliestDue ? new Date(b.earliestDue).getTime() : Infinity;
                return ad - bd;
            });
        }
        return buckets;
    }, [assignments]);

    const toggleSession = (key) => {
        setExpandedSessions(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const totalSessions = grouped.coach.length + grouped.parent.length + grouped.player.length;

    if (totalSessions === 0) {
        return (
            <div className="animate-fade-in-up">
                <h3 className="text-2xl text-white font-display uppercase font-bold mb-6 flex items-center gap-3">
                    <Clipboard className="text-brand-gold w-7 h-7" />
                    This Week's Training
                </h3>
                <div className="glass-panel p-8 text-center">
                    <Dumbbell className="w-10 h-10 text-gray-700 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Nothing on your training board yet.</p>
                    <p className="text-gray-600 text-xs mt-1">Build your own session above to get started.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in-up space-y-6">
            <h3 className="text-2xl text-white font-display uppercase font-bold flex items-center gap-3">
                <Clipboard className="text-brand-gold w-7 h-7" />
                This Week's Training
            </h3>

            {SOURCE_ORDER.map(source => {
                const sessions = grouped[source];
                if (sessions.length === 0) return null;
                const meta = SOURCE_META[source];
                const Icon = meta.icon;

                return (
                    <div key={source} className="space-y-2">
                        <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${meta.text}`}>
                            <Icon className="w-4 h-4" />
                            <span>{meta.title}</span>
                            <span className="text-gray-500 font-normal normal-case">· {sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
                        </div>

                        <div className="space-y-2">
                            {sessions.map(s => {
                                const expanded = expandedSessions.has(s.key);
                                const due = formatDays(s.earliestDue);
                                const completed = s.drills.filter(d => d.status === 'completed').length;
                                const total = s.drills.length;
                                const sessionTitle = total === 1
                                    ? (s.drills[0].drills?.name || 'Drill')
                                    : `${total}-drill session`;

                                return (
                                    <div
                                        key={s.key}
                                        className={`rounded-xl border-l-4 ${meta.leftBar} border ${meta.ring} ${meta.ringHover} ${s.allCompleted ? 'bg-white/[0.02] opacity-70' : 'bg-glass'} transition-all`}
                                    >
                                        {/* Session row — tap to expand */}
                                        <button
                                            type="button"
                                            onClick={() => toggleSession(s.key)}
                                            className="w-full flex items-center gap-3 p-3 text-left"
                                        >
                                            <div className={`w-10 h-10 rounded-lg ${meta.bg} flex items-center justify-center shrink-0`}>
                                                {s.allCompleted
                                                    ? <CheckCircle className={`w-5 h-5 ${meta.text}`} />
                                                    : <Icon className={`w-5 h-5 ${meta.text}`} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className={`font-display font-bold text-base uppercase truncate ${s.allCompleted ? 'text-gray-400 line-through' : 'text-white'}`}>
                                                    {sessionTitle}
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] font-bold mt-0.5">
                                                    <span className="text-gray-400">{completed}/{total} done</span>
                                                    <span className="text-gray-600">·</span>
                                                    <span className="text-gray-400">{s.totalMinutes}m</span>
                                                    {due && (
                                                        <>
                                                            <span className="text-gray-600">·</span>
                                                            <span className={`uppercase tracking-wider ${due.className}`}>{due.label}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            {expanded
                                                ? <ChevronUp className="w-5 h-5 text-gray-500 shrink-0" />
                                                : <ChevronDown className="w-5 h-5 text-gray-500 shrink-0" />}
                                        </button>

                                        {/* Drills inside the session */}
                                        {expanded && (
                                            <div className="px-3 pb-3 space-y-1.5 border-t border-white/5 pt-2">
                                                {s.drills.map(a => {
                                                    const drillObj = {
                                                        id: a.id,
                                                        title: a.drills?.name || 'Drill',
                                                        duration: (a.custom_duration || a.drills?.duration || 15) + 'm',
                                                        completed: a.status === 'completed',
                                                        originalDrill: a.drills,
                                                    };
                                                    return (
                                                        <div
                                                            key={a.id}
                                                            onClick={() => !drillObj.completed && setSelectedDrill(drillObj)}
                                                            className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${drillObj.completed ? '' : 'hover:bg-white/5 cursor-pointer'}`}
                                                        >
                                                            {drillObj.completed
                                                                ? <CheckCircle className="w-4 h-4 text-brand-green shrink-0" />
                                                                : <div className={`w-4 h-4 rounded-full border-2 ${meta.ring} shrink-0`} />}
                                                            <div className="flex-1 min-w-0">
                                                                <div className={`text-sm truncate ${drillObj.completed ? 'text-gray-400 line-through' : 'text-white'}`}>
                                                                    {drillObj.title}
                                                                </div>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider shrink-0">{drillObj.duration}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}

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
