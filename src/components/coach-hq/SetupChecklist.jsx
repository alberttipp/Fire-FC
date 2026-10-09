import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { CheckCircle2, Circle, Users, CalendarDays, UserPlus, Dumbbell, ChevronRight, X } from 'lucide-react';
import { useBranding } from '../../context/BrandingContext';

// "Get your club set up" — a persistent, data-driven starter checklist for a
// coach/manager. One RPC (get_setup_checklist_progress) hydrates all four
// milestones. It HIDES itself once the team is fully set up (so established
// teams never see it) and can be dismissed per-team. Completion is read from
// real data, so ticks happen automatically as the coach does the work.
const DISMISS_PREFIX = 'ff_setup_checklist_dismissed_';

const SetupChecklist = ({ teamId, onAddRoster, onSetSchedule, onInviteFamilies, onFirstTraining }) => {
    const brand = useBranding();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (!teamId) return;
        try { setDismissed(localStorage.getItem(DISMISS_PREFIX + teamId) === '1'); } catch { /* ignore */ }
    }, [teamId]);

    const load = useCallback(async () => {
        if (!teamId) return;
        const { data: rows, error } = await supabase.rpc('get_setup_checklist_progress', { p_team_id: teamId });
        if (!error && rows) setData(Array.isArray(rows) ? rows[0] : rows);
        setLoading(false);
    }, [teamId]);

    useEffect(() => { load(); }, [load]);
    // Re-check when the coach returns to the tab (they may have just added players
    // or events on another screen), so ticks update without a manual refresh.
    useEffect(() => {
        const t = () => load();
        window.addEventListener('focus', t);
        return () => window.removeEventListener('focus', t);
    }, [load]);

    if (loading || !data || dismissed) return null;

    const roster   = data.roster_count ?? 0;
    const events   = data.events_count ?? 0;
    const fams      = data.players_with_parent ?? 0;
    const totalP    = data.total_players ?? 0;
    const training = data.training_count ?? 0;

    const items = [
        { key: 'roster', icon: Users, label: 'Add your roster', done: roster > 0,
          status: roster > 0 ? `${roster} player${roster === 1 ? '' : 's'} on the team` : 'No players yet',
          cta: 'Add players', onClick: onAddRoster },
        { key: 'schedule', icon: CalendarDays, label: 'Set your schedule', done: events > 0,
          status: events > 0 ? `${events} event${events === 1 ? '' : 's'} scheduled` : 'No events yet',
          cta: 'Add events', onClick: onSetSchedule },
        { key: 'families', icon: UserPlus, label: 'Invite families', done: fams > 0,
          status: totalP > 0 ? `${fams} of ${totalP} player${totalP === 1 ? '' : 's'} have family linked` : 'Invite parents to join',
          cta: 'Invite / share link', onClick: onInviteFamilies },
        { key: 'training', icon: Dumbbell, label: 'Send first training', done: training > 0,
          status: training > 0 ? `${training} week${training === 1 ? '' : 's'} of training sent` : 'No training sent yet',
          cta: 'Send a challenge', onClick: onFirstTraining },
    ];

    const doneCount = items.filter((i) => i.done).length;
    if (doneCount === items.length) return null; // fully set up → disappear

    const pct = Math.round((doneCount / items.length) * 100);
    const dismiss = () => {
        try { localStorage.setItem(DISMISS_PREFIX + teamId, '1'); } catch { /* ignore */ }
        setDismissed(true);
    };

    return (
        <div className="glass-panel border-l-4 border-l-brand-green p-4 relative">
            <button type="button" onClick={dismiss} aria-label="Hide setup checklist"
                className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-3 pr-6">
                <div className="shrink-0 w-11 h-11 rounded-full bg-brand-green/15 flex items-center justify-center">
                    <span className="text-brand-green font-display font-bold text-sm">{pct}%</span>
                </div>
                <div>
                    <h3 className="font-display uppercase tracking-wider text-white text-sm">
                        Get {brand?.shortName || 'your club'} set up
                    </h3>
                    <p className="text-xs text-gray-400">
                        {doneCount} of {items.length} done — finish these to get families using the app.
                    </p>
                </div>
            </div>

            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-3">
                <div className="h-full bg-brand-green transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>

            <ul className="space-y-1.5">
                {items.map((it) => (
                    <li key={it.key}
                        className={`flex items-center gap-3 rounded-lg p-2.5 ${it.done ? '' : 'bg-white/5'}`}>
                        {it.done
                            ? <CheckCircle2 className="w-5 h-5 text-brand-green shrink-0" />
                            : <Circle className="w-5 h-5 text-gray-500 shrink-0" />}
                        <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${it.done ? 'text-gray-400 line-through' : 'text-white'}`}>
                                {it.label}
                            </div>
                            <div className="text-xs text-gray-500 truncate">{it.status}</div>
                        </div>
                        {!it.done && it.onClick && (
                            <button type="button" onClick={it.onClick}
                                className="shrink-0 text-xs font-display font-bold uppercase tracking-wider text-brand-green hover:text-white flex items-center gap-1 transition-colors">
                                {it.cta}<ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default SetupChecklist;
