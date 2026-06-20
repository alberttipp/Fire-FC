import React, { useRef, useState, useEffect } from 'react';
import PositionSlot from './PositionSlot';
import { FORMATIONS } from './formations';

// Vertical soccer pitch (our half at the bottom). Pure SVG markings; the
// drop targets are absolute-positioned divs overlaying it so dnd-kit can
// hit-test in DOM space rather than SVG space.
//
// Sizing: a ResizeObserver measures the wrapper and we compute the
// largest 2:3 box that fits inside it. CSS-only solutions with
// aspect-ratio + max-width + max-height don't shrink reliably when
// both axes clamp — this approach is bulletproof across browsers.
const SoccerPitch = ({ formation = '4-4-2', assignments = {}, players = [], onUnassign, readOnly = false, selectedPlayerId = null, onSlotTap }) => {
    const def = FORMATIONS[formation] || FORMATIONS['4-4-2'];
    const wrapperRef = useRef(null);
    const [size, setSize] = useState({ w: 0, h: 0 });

    useEffect(() => {
        const node = wrapperRef.current;
        if (!node) return;
        const fit = (w, h) => {
            if (w <= 0 || h <= 0) return;
            const wFromH = h * (2 / 3);
            if (wFromH <= w) setSize({ w: Math.floor(wFromH), h: Math.floor(h) });
            else             setSize({ w: Math.floor(w), h: Math.floor(w * (3 / 2)) });
        };
        const obs = new ResizeObserver(entries => {
            const r = entries[0].contentRect;
            fit(r.width, r.height);
        });
        obs.observe(node);
        const r = node.getBoundingClientRect();
        fit(r.width, r.height);
        return () => obs.disconnect();
    }, []);

    return (
        <div ref={wrapperRef} className="w-full h-full flex items-center justify-center min-h-0 min-w-0">
            {size.w > 0 && size.h > 0 && (
                <div
                    style={{ width: size.w, height: size.h }}
                    className="relative bg-gradient-to-b from-emerald-700 to-emerald-800 rounded-lg overflow-hidden border-2 border-white/20 shadow-xl"
                >
                    {/* Pitch lines */}
                    <svg viewBox="0 0 100 150" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                        <rect x="2" y="2" width="96" height="146" fill="none" stroke="white" strokeWidth="0.4" strokeOpacity="0.7" />
                        <line x1="2" y1="75" x2="98" y2="75" stroke="white" strokeWidth="0.3" strokeOpacity="0.6" />
                        <circle cx="50" cy="75" r="9" fill="none" stroke="white" strokeWidth="0.3" strokeOpacity="0.6" />
                        <circle cx="50" cy="75" r="0.6" fill="white" fillOpacity="0.7" />
                        <rect x="22" y="120" width="56" height="20" fill="none" stroke="white" strokeWidth="0.3" strokeOpacity="0.6" />
                        <rect x="35" y="135" width="30" height="8"  fill="none" stroke="white" strokeWidth="0.3" strokeOpacity="0.6" />
                        <circle cx="50" cy="128" r="0.6" fill="white" fillOpacity="0.7" />
                        <rect x="22" y="10"  width="56" height="20" fill="none" stroke="white" strokeWidth="0.3" strokeOpacity="0.6" />
                        <rect x="35" y="7"   width="30" height="8"  fill="none" stroke="white" strokeWidth="0.3" strokeOpacity="0.6" />
                        <circle cx="50" cy="22" r="0.6" fill="white" fillOpacity="0.7" />
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
                            selectedPlayerId={selectedPlayerId}
                            onSlotTap={onSlotTap}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default SoccerPitch;
