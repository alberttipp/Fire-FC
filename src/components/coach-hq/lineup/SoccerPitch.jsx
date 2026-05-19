import React from 'react';
import PositionSlot from './PositionSlot';
import { FORMATIONS } from './formations';

// Vertical soccer pitch (our half at the bottom). Pure SVG markings; the
// drop targets are absolute-positioned divs overlaying it so dnd-kit can
// hit-test in DOM space rather than SVG space.
//
// Props:
//   formation     — '4-4-2' | '4-3-3' | '4-2-3-1' | '3-5-2'
//   assignments   — { [slotId]: { player_id, name, jersey } | null }
//   players       — full roster (for name/jersey lookups + unassign popover)
//   onUnassign    — (slotId) => void
//   readOnly      — disables drag targets + popovers (parent view)
const SoccerPitch = ({ formation = '4-4-2', assignments = {}, players = [], onUnassign, readOnly = false }) => {
    const def = FORMATIONS[formation] || FORMATIONS['4-4-2'];
    return (
        <div className="relative w-full max-w-md mx-auto aspect-[2/3] bg-gradient-to-b from-emerald-700 to-emerald-800 rounded-lg overflow-hidden border-2 border-white/20 shadow-xl">
            {/* Pitch lines */}
            <svg viewBox="0 0 100 150" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                {/* outer */}
                <rect x="2" y="2" width="96" height="146" fill="none" stroke="white" strokeWidth="0.4" strokeOpacity="0.7" />
                {/* halfway */}
                <line x1="2" y1="75" x2="98" y2="75" stroke="white" strokeWidth="0.3" strokeOpacity="0.6" />
                {/* center circle */}
                <circle cx="50" cy="75" r="9" fill="none" stroke="white" strokeWidth="0.3" strokeOpacity="0.6" />
                <circle cx="50" cy="75" r="0.6" fill="white" fillOpacity="0.7" />
                {/* our penalty box */}
                <rect x="22" y="120" width="56" height="20" fill="none" stroke="white" strokeWidth="0.3" strokeOpacity="0.6" />
                <rect x="35" y="135" width="30" height="8"  fill="none" stroke="white" strokeWidth="0.3" strokeOpacity="0.6" />
                <circle cx="50" cy="128" r="0.6" fill="white" fillOpacity="0.7" />
                {/* opposition penalty box */}
                <rect x="22" y="10"  width="56" height="20" fill="none" stroke="white" strokeWidth="0.3" strokeOpacity="0.6" />
                <rect x="35" y="7"   width="30" height="8"  fill="none" stroke="white" strokeWidth="0.3" strokeOpacity="0.6" />
                <circle cx="50" cy="22" r="0.6" fill="white" fillOpacity="0.7" />
                {/* grass stripes */}
                {[0,1,2,3,4,5,6].map(i => (
                    <rect key={i} x="0" y={i * 21} width="100" height="10.5" fill="black" fillOpacity={i % 2 === 0 ? '0.06' : '0'} />
                ))}
            </svg>

            {/* Slot overlay */}
            {def.slots.map(slot => (
                <PositionSlot
                    key={slot.id}
                    slot={slot}
                    assignment={assignments[slot.id] || null}
                    onUnassign={onUnassign}
                    readOnly={readOnly}
                />
            ))}
        </div>
    );
};

export default SoccerPitch;
