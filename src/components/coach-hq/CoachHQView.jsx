import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { MessageSquare, Calendar, Trophy, Clock, Activity, Target, ChevronRight, Bell } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import CoachHQTile from './CoachHQTile';
import UpcomingWeek from '../dashboard/UpcomingWeek';

const AttendanceDrilldown   = lazy(() => import('./AttendanceDrilldown'));
const RosterStatsDrilldown  = lazy(() => import('./RosterStatsDrilldown'));
const IDPProgressDrilldown  = lazy(() => import('./IDPProgressDrilldown'));

// Coach HQ — landing surface for coach + manager. Six live tiles + an
// unread chat banner + the existing UpcomingWeek list. Each tile opens
// a focused drilldown. Single round-trip to get_coach_hq_metrics RPC
// for all 6 tile values; auto-refresh on focus + every 60s.
//
// Props:
//   onJumpToChat — () => void; called when user taps the unread banner
//                   or the Unread Chat tile. Dashboard wires this to
//                   setCurrentView('chat').
const CoachHQView = ({ onJumpToChat }) => {
    const { user, profile } = useAuth();
    const [teamId, setTeamId] = useState(profile?.team_id || null);
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [drilldown, setDrilldown] = useState(null); // 'practice' | 'game' | 'mins' | 'touches' | 'idp'

    // Resolve team_id from team_memberships if not on profile (coach with
    // multiple teams: pick the most recently joined for now).
    useEffect(() => {
        if (teamId || !user?.id) return;
        let cancelled = false;
        (async () => {
            const { data } = await supabase
                .from('team_memberships')
                .select('team_id')
                .eq('user_id', user.id)
                .order('joined_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (!cancelled && data?.team_id) setTeamId(data.team_id);
        })();
        return () => { cancelled = true; };
    }, [user?.id, teamId]);

    const loadMetrics = useCallback(async () => {
        if (!teamId) return;
        const { data, error } = await supabase.rpc('get_coach_hq_metrics', { p_team_id: teamId });
        if (error) { console.warn('[CoachHQ] metrics error:', error); return; }
        setMetrics(data);
        setLoading(false);
    }, [teamId]);

    useEffect(() => { loadMetrics(); }, [loadMetrics]);

    // Refresh on focus + every 60s (matches ChatView's polling cadence)
    useEffect(() => {
        if (!teamId) return;
        const tick = () => loadMetrics();
        window.addEventListener('focus', tick);
        document.addEventListener('visibilitychange', tick);
        const id = setInterval(tick, 60_000);
        return () => {
            window.removeEventListener('focus', tick);
            document.removeEventListener('visibilitychange', tick);
            clearInterval(id);
        };
    }, [teamId, loadMetrics]);

    const unread     = metrics?.unread_chat_count ?? 0;
    const prac       = metrics?.practice_attendance ?? { going: 0, total: 0, pct: 0 };
    const game       = metrics?.game_attendance     ?? { going: 0, total: 0, pct: 0 };
    const mins       = metrics?.avg_weekly_minutes ?? 0;
    const touches    = metrics?.avg_weekly_touches ?? 0;
    const idp        = metrics?.idp ?? { active: 0, total_players: 0, avg_mastered_this_block: 0 };

    return (
        <div className="space-y-5">
            {/* Unread chat banner — only when unread > 0 */}
            {unread > 0 && (
                <button
                    type="button"
                    onClick={onJumpToChat}
                    className="w-full glass-panel border-l-4 border-l-brand-gold p-3 flex items-center gap-3 hover:bg-brand-gold/5 transition-colors"
                >
                    <Bell className="w-5 h-5 text-brand-gold shrink-0" />
                    <span className="flex-1 text-left text-white text-sm font-medium">
                        {unread} unanswered message{unread === 1 ? '' : 's'} · tap to open chat
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
            )}

            {/* 6 tiles */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
                <CoachHQTile
                    label="Unread"
                    value={unread}
                    sub={unread === 1 ? 'message' : 'messages'}
                    icon={MessageSquare}
                    accent={unread > 0 ? 'gold' : 'green'}
                    onClick={onJumpToChat}
                    loading={loading}
                />
                <CoachHQTile
                    label="Practice"
                    value={`${prac.pct}%`}
                    sub={`${prac.going}/${prac.total} · 30d`}
                    icon={Calendar}
                    accent={prac.pct >= 75 ? 'green' : prac.pct >= 50 ? 'gold' : 'red'}
                    onClick={() => setDrilldown('practice')}
                    loading={loading}
                />
                <CoachHQTile
                    label="Game"
                    value={`${game.pct}%`}
                    sub={`${game.going}/${game.total} · 30d`}
                    icon={Trophy}
                    accent={game.pct >= 75 ? 'green' : game.pct >= 50 ? 'gold' : 'red'}
                    onClick={() => setDrilldown('game')}
                    loading={loading}
                />
                <CoachHQTile
                    label="Mins"
                    value={mins}
                    sub="avg / week"
                    icon={Clock}
                    accent="blue"
                    onClick={() => setDrilldown('mins')}
                    loading={loading}
                />
                <CoachHQTile
                    label="Touches"
                    value={touches.toLocaleString()}
                    sub="avg / week"
                    icon={Activity}
                    accent="purple"
                    onClick={() => setDrilldown('touches')}
                    loading={loading}
                />
                <CoachHQTile
                    label="IDPs"
                    value={`${idp.active}/${idp.total_players}`}
                    sub={`${idp.avg_mastered_this_block} avg mastered`}
                    icon={Target}
                    accent="gold"
                    onClick={() => setDrilldown('idp')}
                    loading={loading}
                />
            </div>

            {/* Upcoming events — UpcomingWeek already shows live attendance + tap-to-modal */}
            <UpcomingWeek teamId={teamId} />

            {/* Drilldowns */}
            <Suspense fallback={null}>
                {drilldown === 'practice' && <AttendanceDrilldown teamId={teamId} eventType="practice" label="Practice Attendance" onClose={() => setDrilldown(null)} />}
                {drilldown === 'game'     && <AttendanceDrilldown teamId={teamId} eventType="game"     label="Game Attendance"     onClose={() => setDrilldown(null)} />}
                {drilldown === 'mins'     && <RosterStatsDrilldown teamId={teamId} metric="weekly_minutes" label="Weekly Training Minutes" onClose={() => setDrilldown(null)} />}
                {drilldown === 'touches'  && <RosterStatsDrilldown teamId={teamId} metric="weekly_touches" label="Weekly Ball Touches"     onClose={() => setDrilldown(null)} />}
                {drilldown === 'idp'      && <IDPProgressDrilldown teamId={teamId} onClose={() => setDrilldown(null)} />}
            </Suspense>
        </div>
    );
};

export default CoachHQView;
