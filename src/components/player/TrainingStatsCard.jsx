import React from 'react';
import { Clock } from 'lucide-react';

// Shared training-stats display used by ParentDashboard and PlayerDashboard.
// Single source of truth for the 4-bucket minutes + touches breakdown.
//
// Props:
//   stats        — { weekly_minutes, season_minutes, yearly_minutes,
//                    training_minutes, weekly_touches, season_touches,
//                    yearly_touches, career_touches }
//   teamMins     — number, optional, total team-practice minutes derived
//                    from attended events (parent dashboard computes this
//                    locally; player dashboard skips)
//   showBreakdown — boolean, optional, show the team-vs-solo bar (parent
//                    side wants it; player side keeps it simpler)
const TrainingStatsCard = ({ stats, teamMins = null, showBreakdown = false }) => {
    const s = stats || {};
    const weekly = s.weekly_minutes || 0;
    const season = s.season_minutes || 0;
    const yearly = s.yearly_minutes || 0;
    const career = s.training_minutes || 0;
    const weeklyT = s.weekly_touches || 0;
    const seasonT = s.season_touches || 0;
    const yearlyT = s.yearly_touches || 0;
    const careerT = s.career_touches || 0;

    const soloMins = career; // training_minutes = lifetime solo challenge total
    const team = teamMins || 0;
    const totalMins = team + soloMins;

    return (
        <div className="glass-panel p-5">
            <h4 className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-3 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" /> Training Minutes
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <div className="text-center">
                    <div className="text-xl text-blue-400 font-bold font-display">{weekly}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">This Week</div>
                </div>
                <div className="text-center">
                    <div className="text-xl text-brand-green font-bold font-display">{season}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Season</div>
                </div>
                <div className="text-center">
                    <div className="text-xl text-brand-gold font-bold font-display">{yearly}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Year</div>
                </div>
                <div className="text-center">
                    <div className="text-xl text-white font-bold font-display">{career}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Career</div>
                </div>
            </div>
            <h4 className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-3 flex items-center gap-1.5">
                ⚽ Est. Ball Touches
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="text-center">
                    <div className="text-lg text-blue-400 font-bold font-display">{weeklyT.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">This Week</div>
                </div>
                <div className="text-center">
                    <div className="text-lg text-brand-green font-bold font-display">{seasonT.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Season</div>
                </div>
                <div className="text-center">
                    <div className="text-lg text-brand-gold font-bold font-display">{yearlyT.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Year</div>
                </div>
                <div className="text-center">
                    <div className="text-lg text-orange-400 font-bold font-display">{careerT.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Career</div>
                </div>
            </div>
            {showBreakdown && (
                <div className="space-y-2">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-gray-400 uppercase tracking-wider">Team Practice</span>
                            <span className="text-xs text-white font-bold">{team} min</span>
                        </div>
                        <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-green rounded-full transition-all duration-500"
                                style={{ width: totalMins > 0 ? `${(team / totalMins) * 100}%` : '0%' }} />
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-gray-400 uppercase tracking-wider">Solo Practice</span>
                            <span className="text-xs text-white font-bold">{soloMins} min</span>
                        </div>
                        <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-gold rounded-full transition-all duration-500"
                                style={{ width: totalMins > 0 ? `${(soloMins / totalMins) * 100}%` : '0%' }} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrainingStatsCard;
