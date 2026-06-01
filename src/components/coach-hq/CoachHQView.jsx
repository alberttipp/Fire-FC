import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { MessageSquare, Calendar, Trophy, Clock, Activity, Target, ChevronRight, Bell, Dumbbell, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import { useConfirm } from '../ConfirmDialog';
import CoachHQTile from './CoachHQTile';
import UpcomingWeek from '../dashboard/UpcomingWeek';
import SetupHealthPanel from './SetupHealthPanel';

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
    const toast = useToast();
    const confirm = useConfirm();
    const [teamId, setTeamId] = useState(profile?.team_id || null);
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sendingChallenge, setSendingChallenge] = useState(false);
    const [drilldown, setDrilldown] = useState(null); // 'practice' | 'game' | 'mins' | 'touches' | 'idp'

    // "Send this week's solo challenge to the whole team" — assigns the weekly
    // solo set to every active player who doesn't already have this week's
    // drills (per-player; leaves already-set kids untouched).
    const handleSendChallenge = async () => {
        if (!teamId || sendingChallenge) return;
        const ok = await confirm({
            title: "Send this week's solo challenge?",
            body: "Every player who doesn't already have this week's drills gets a fresh solo set. Kids who already have drills this week are left untouched.",
            confirmLabel: 'Send to team',
        });
        if (!ok) return;
        setSendingChallenge(true);
        try {
            const { data, error } = await supabase.rpc('assign_weekly_solo_to_team_now', { p_team_id: teamId });
            if (error) throw error;
            const n = data ?? 0;
            toast.success(n > 0
                ? "Sent! This week's solo challenge is on the way to the team."
                : "Everyone already has this week's drills — nothing to send.");
        } catch (err) {
            console.error('[CoachHQ] send challenge error', err);
            toast.error("Couldn't send the challenge. Try again.");
        } finally {
            setSendingChallenge(false);
        }
    };

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
            {/* Rollout setup-health tracker — onboarding progress + chase
                list. Renders nothing for non-staff (RPC self-checks). */}
            <SetupHealthPanel />

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

            {/* Send this week's solo challenge to the whole team */}
            <button
                type="button"
                onClick={handleSendChallenge}
                disabled={sendingChallenge || !teamId}
                className="w-full glass-panel border-l-4 border-l-brand-green p-3 flex items-center gap-3 hover:bg-brand-green/5 transition-colors disabled:opacity-50"
            >
                {sendingChallenge
                    ? <Loader2 className="w-5 h-5 text-brand-green shrink-0 animate-spin" />
                    : <Dumbbell className="w-5 h-5 text-brand-green shrink-0" />}
                <span className="flex-1 text-left text-white text-sm font-medium">
                    Send this week's solo challenge to the whole team
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>

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
