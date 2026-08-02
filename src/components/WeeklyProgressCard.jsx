import React, { useEffect, useState } from 'react';
import { Flame, Clock, Target, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

// Development Autopilot — the family's weekly proof-of-development. Reads the
// latest player_weekly_reports row via the SECURITY DEFINER RPC. Renders NOTHING
// until a report exists (feature is self-gating by data), so dropping it on any
// dashboard is safe. Style-matched to the FIFA card; it visually replaces the
// retired IDP card.
const FOCUS_LABEL = {
    pace: 'Pace', shooting: 'Finishing', passing: 'Passing',
    dribbling: 'Dribbling', defending: 'Defending', physical: 'Strength',
};
const FOCUS_TIP = {
    pace: 'sprints & first-step speed', shooting: 'shooting reps on goal',
    passing: 'wall-passing & weak foot', dribbling: 'close control & 1v1 moves',
    defending: 'jockeying & tackling', physical: 'core & conditioning',
};

export default function WeeklyProgressCard({ playerId, className = '' }) {
    const [report, setReport] = useState(undefined); // undefined=loading, null=none

    useEffect(() => {
        let active = true;
        if (!playerId) { setReport(null); return; }
        (async () => {
            const { data, error } = await supabase.rpc('get_player_weekly_report', { p_player_id: playerId });
            if (!active) return;
            setReport(error ? null : (Array.isArray(data) ? data[0] : data) || null);
        })();
        return () => { active = false; };
    }, [playerId]);

    if (!report) return null; // loading or no data → render nothing

    const trained = (report.minutes || 0) > 0;
    const focus = report.focus_area && FOCUS_LABEL[report.focus_area];

    return (
        <div className={`rounded-2xl border border-white/10 bg-gradient-to-br from-brand-green/10 to-white/[0.02] p-4 ${className}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-display uppercase tracking-wider text-brand-green">This week</div>
                {report.streak_weeks >= 2 && (
                    <div className="flex items-center gap-1 text-brand-gold text-sm font-bold">
                        <Flame className="w-4 h-4" /> {report.streak_weeks}-week streak
                    </div>
                )}
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
                <Stat icon={Clock} value={report.minutes || 0} label="minutes" accent={trained} />
                <Stat icon={CheckCircle2} value={`${report.assignments_done || 0}/${report.assignments_total || 0}`} label="drills" accent={report.assignments_done > 0} />
                <Stat icon={Flame} value={report.juggle_best ?? '—'} label="juggle PB" />
            </div>

            {focus && (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-white/5 border border-white/10 p-3">
                    <Target className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <span className="text-gray-400">This week's mission: </span>
                        <span className="font-bold text-white">{focus}</span>
                        <span className="text-gray-400"> — {FOCUS_TIP[report.focus_area]}.</span>
                    </div>
                </div>
            )}

            {!trained && (
                <p className="mt-2 text-[11px] text-gray-500 text-center">Log a session this week to keep the streak alive 🔥</p>
            )}
        </div>
    );
}

const Stat = ({ icon: Icon, value, label, accent }) => (
    <div>
        <Icon className={`w-4 h-4 mx-auto mb-1 ${accent ? 'text-brand-green' : 'text-gray-500'}`} />
        <div className={`text-xl font-display font-bold ${accent ? 'text-white' : 'text-gray-300'}`}>{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
    </div>
);
