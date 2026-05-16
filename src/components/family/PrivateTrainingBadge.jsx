import React, { useEffect, useState } from 'react';
import { Trophy, Calendar, CreditCard, CheckCircle2, ExternalLink, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../supabaseClient';

// =====================================================================
// Phase C: parent-side badge.
// Renders nothing if the player isn't on any private_group team.
// Otherwise shows a card per group with:
//   - group name + accent color + description
//   - next upcoming session (if any)
//   - last completed session + credited minutes/touches (if any)
//   - "Pay for sessions" button when teams.payment_link is set
// All read-only — actual session management stays in the coach UI.
// =====================================================================

const PrivateTrainingBadge = ({ playerId, playerName = 'this player' }) => {
    const [groups, setGroups] = useState([]); // [{group, nextSession, lastAttended}]
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!playerId) { setLoading(false); return; }
        let cancelled = false;

        (async () => {
            setLoading(true);

            // 1) Private groups this player is on
            const { data: ptRows, error: ptErr } = await supabase
                .from('player_teams')
                .select('team_id, teams!inner(id, name, team_type, description, payment_link, color)')
                .eq('player_id', playerId)
                .eq('status', 'active');
            if (cancelled) return;
            if (ptErr) { console.error('[PrivateBadge] pt fetch:', ptErr); setGroups([]); setLoading(false); return; }

            const privateGroups = (ptRows || [])
                .map(r => r.teams)
                .filter(g => g?.team_type === 'private_group');

            if (privateGroups.length === 0) {
                setGroups([]);
                setLoading(false);
                return;
            }

            // 2) For each group: upcoming session + last completed attendance
            const enriched = await Promise.all(privateGroups.map(async (g) => {
                const now = new Date().toISOString();

                const { data: upcoming } = await supabase
                    .from('private_sessions')
                    .select('id, title, start_time, location_name, status')
                    .eq('team_id', g.id)
                    .in('status', ['scheduled'])
                    .gte('start_time', now)
                    .order('start_time', { ascending: true })
                    .limit(1);

                const { data: lastAttRows } = await supabase
                    .from('private_session_attendees')
                    .select('id, attended, minutes_credited, touches_credited, credited_at, session_id, private_sessions!inner(id, title, start_time, status)')
                    .eq('player_id', playerId)
                    .eq('attended', true)
                    .not('credited_at', 'is', null)
                    .order('credited_at', { ascending: false })
                    .limit(1);

                return {
                    group: g,
                    nextSession: (upcoming || [])[0] || null,
                    lastAttended: (lastAttRows || [])[0] || null,
                };
            }));

            if (!cancelled) {
                setGroups(enriched);
                setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [playerId]);

    if (loading) return null;
    if (groups.length === 0) return null;

    return (
        <div className="space-y-3">
            {groups.map(({ group, nextSession, lastAttended }) => {
                const accent = group.color || '#d4af37'; // default gold
                return (
                    <div
                        key={group.id}
                        className="bg-white/[0.03] border rounded-2xl p-4"
                        style={{ borderColor: `${accent}40` }}
                    >
                        <div className="flex items-center justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <Trophy className="w-4 h-4 shrink-0" style={{ color: accent }} />
                                <div className="min-w-0">
                                    <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: accent }}>
                                        Private training
                                    </div>
                                    <h4 className="text-white font-bold text-sm truncate">{group.name}</h4>
                                </div>
                            </div>
                            {group.payment_link && (
                                <a
                                    href={group.payment_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 transition-colors shrink-0"
                                >
                                    <CreditCard className="w-3.5 h-3.5" />
                                    Pay
                                    <ExternalLink className="w-3 h-3 opacity-60" />
                                </a>
                            )}
                        </div>

                        {group.description && (
                            <p className="text-gray-400 text-xs leading-relaxed mb-3">{group.description}</p>
                        )}

                        {(nextSession || lastAttended) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                {nextSession && (
                                    <div className="p-2.5 rounded bg-black/30 border border-white/5">
                                        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold flex items-center gap-1 mb-1">
                                            <Calendar className="w-3 h-3" /> Next session
                                        </div>
                                        <p className="text-white font-bold truncate">
                                            {format(new Date(nextSession.start_time), 'EEE MMM d · h:mm a')}
                                        </p>
                                        {nextSession.location_name && (
                                            <p className="text-gray-500 text-[11px] truncate">{nextSession.location_name}</p>
                                        )}
                                    </div>
                                )}
                                {lastAttended && (
                                    <div className="p-2.5 rounded bg-black/30 border border-white/5">
                                        <div className="text-[10px] uppercase tracking-wider text-emerald-300/80 font-bold flex items-center gap-1 mb-1">
                                            <CheckCircle2 className="w-3 h-3" /> Last attended
                                        </div>
                                        <p className="text-white font-bold truncate">
                                            {format(new Date(lastAttended.private_sessions.start_time), 'EEE MMM d')}
                                        </p>
                                        <p className="text-gray-500 text-[11px]">
                                            <Clock className="w-3 h-3 inline mr-1" />
                                            {lastAttended.minutes_credited} min
                                            {lastAttended.touches_credited > 0 && ` · ${lastAttended.touches_credited.toLocaleString()} touches`}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default PrivateTrainingBadge;
