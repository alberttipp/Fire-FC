import React from 'react';
import { Minus, Plus } from 'lucide-react';

// Inline, tap-friendly "actual minutes trained" adjuster for a drill.
// Defaults to the drill's set time — the parent/kid only touches it if they
// trained longer or shorter. stopPropagation so adjusting the number never
// triggers a row-level "tap to complete" click. Steps by 5, clamped 1–180.
const DrillMinutesStepper = ({ minutes, onChange, disabled = false }) => {
    const set = (v) => onChange(Math.max(1, Math.min(180, v)));
    return (
        <div
            className="inline-flex items-center gap-0.5 rounded-full bg-white/5 border border-white/10 px-1 py-0.5 select-none"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
        >
            <button
                type="button" disabled={disabled} aria-label="Less time"
                onClick={() => set(minutes - 5)}
                className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:bg-white/10 active:bg-white/20 disabled:opacity-40"
            >
                <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="min-w-[46px] text-center text-xs font-bold text-white tabular-nums">{minutes} min</span>
            <button
                type="button" disabled={disabled} aria-label="More time"
                onClick={() => set(minutes + 5)}
                className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:bg-white/10 active:bg-white/20 disabled:opacity-40"
            >
                <Plus className="w-3.5 h-3.5" />
            </button>
        </div>
    );
};

export default DrillMinutesStepper;
