import React, { useState, useEffect } from 'react';
import { Flame, Target, Trophy } from 'lucide-react';
import { supabase } from '../supabaseClient';

// Team grind tracker: always shows daily/weekly "who logged" participation (the
// reason to open + log every day). When staff set a weekly team goal, a progress
// bar appears too. Effort/participation-based on purpose — every kid moves it
// equally, so nobody gets left behind.
const defaultLabel = (metric) => ({
    participation: 'Team goal — everyone logs this week',
    touches: 'Team goal — juggling touches',
    minutes: 'Team goal — training minutes',
}[metric] || 'Team goal');

const TeamGoalBar = ({ teamId }) => {
    const [data, setData] = useState(null);

    useEffect(() => {
        if (!teamId) return;
        let cancelled = false;
        (async () => {
            const { data: d } = await supabase.rpc('get_team_goal_progress', { p_team_id: teamId });
            if (!cancelled) setData(d);
        })();
        return () => { cancelled = true; };
    }, [teamId]);

    if (!data || !data.roster) return null;
    const { roster, logged_today, logged_week, goal } = data;

    return (
        <div className="glass-panel p-4 border-l-4 border-l-brand-green">
            <div className="flex items-center gap-2 text-sm text-gray-300">
                <Flame className="w-4 h-4 text-brand-gold shrink-0" />
                <span><span className="text-white font-bold">{logged_today}</span>/{roster} logged today</span>
                <span className="text-gray-600">·</span>
                <span><span className="text-white font-bold">{logged_week}</span>/{roster} this week</span>
            </div>

            {goal ? (
                <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-300 font-medium flex items-center gap-1.5">
                            {goal.achieved ? <Trophy className="w-3.5 h-3.5 text-brand-gold" /> : <Target className="w-3.5 h-3.5 text-brand-green" />}
                            {goal.label || defaultLabel(goal.metric)}
                        </span>
                        <span className="text-white font-bold">
                            {goal.progress.toLocaleString()}/{goal.target.toLocaleString()}{goal.achieved ? ' 🎉' : ''}
                        </span>
                    </div>
                    <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-brand-green to-brand-gold rounded-full transition-all" style={{ width: `${goal.pct}%` }} />
                    </div>
                    {goal.achieved && <p className="text-[11px] text-brand-gold mt-1.5 font-bold">Team goal smashed — let's go! 🔥</p>}
                </div>
            ) : (
                <p className="text-[11px] text-gray-500 mt-1.5">Log a quick session today to move the team forward. ⚽</p>
            )}
        </div>
    );
};

export default TeamGoalBar;
