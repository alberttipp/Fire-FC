import React from 'react';
import { Loader2 } from 'lucide-react';

// Single tile for the Coach HQ landing. Six of these sit at the top of
// the dashboard. Each shows a headline metric, a subtitle, and opens a
// drilldown sheet on tap.
//
// Props:
//   label       — small uppercase header (e.g. "Practice")
//   value       — big number (or React node)
//   sub         — small text below (e.g. "going")
//   icon        — lucide-react icon component
//   accent      — 'green' | 'gold' | 'red' | 'blue' | 'purple' — color of the icon + value
//   onClick     — optional tap handler (opens drilldown)
//   loading     — show spinner instead of value
const accentMap = {
    green:  { icon: 'text-brand-green',  value: 'text-brand-green',  ring: 'group-hover:ring-brand-green/40' },
    gold:   { icon: 'text-brand-gold',   value: 'text-brand-gold',   ring: 'group-hover:ring-brand-gold/40' },
    red:    { icon: 'text-red-400',      value: 'text-red-400',      ring: 'group-hover:ring-red-500/40' },
    blue:   { icon: 'text-blue-400',     value: 'text-blue-400',     ring: 'group-hover:ring-blue-500/40' },
    purple: { icon: 'text-purple-400',   value: 'text-purple-400',   ring: 'group-hover:ring-purple-500/40' },
};

const CoachHQTile = ({ label, value, sub, icon: Icon, accent = 'green', onClick, loading = false }) => {
    const cls = accentMap[accent] || accentMap.green;
    const interactive = !!onClick;
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!interactive}
            className={`group glass-panel p-3 sm:p-4 text-left flex flex-col gap-1.5 transition-all ${interactive ? `hover:bg-white/[0.07] ring-1 ring-transparent ${cls.ring} cursor-pointer` : 'cursor-default'}`}
        >
            <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">{label}</span>
                {Icon && <Icon className={`w-4 h-4 ${cls.icon}`} />}
            </div>
            <div className={`text-2xl sm:text-3xl font-bold font-display leading-none ${cls.value}`}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-500" /> : value}
            </div>
            {sub && <span className="text-[10px] text-gray-500 leading-tight">{sub}</span>}
        </button>
    );
};

export default CoachHQTile;
