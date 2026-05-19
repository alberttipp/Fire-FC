import React from 'react';
import { useDraggable } from '@dnd-kit/core';

// One draggable bench chip. Designed to live in a horizontally-scrolling
// strip at the bottom of the lineup builder — narrow, single-row, fixed
// width so the row stays predictable and the pitch above is unobscured.
//
// `touch-action: pan-x` lets a horizontal swipe scroll the strip without
// triggering a drag, while a press-and-hold (TouchSensor delay 250ms)
// initiates the drag normally. Vertical pulls also initiate drag because
// pan-x only permits horizontal scrolling — anything else gets handed
// over to the pointer/touch listeners.
const DraggablePlayer = ({ player }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `player:${player.id}` });
    const shortName = player.first_name || player.last_name || '—';

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            style={{ touchAction: 'pan-x' }}
            className={`shrink-0 w-[78px] flex flex-col items-center gap-0.5 px-1 py-1 rounded bg-white/10 border border-white/15 hover:bg-white/20 cursor-grab active:cursor-grabbing select-none
                ${isDragging ? 'opacity-30' : ''}`}
        >
            <span className="w-7 h-7 rounded-full bg-brand-green/25 text-brand-green text-[11px] font-bold flex items-center justify-center shrink-0">
                {player.jersey_number ?? '—'}
            </span>
            <span className="text-white text-[10px] leading-tight truncate w-full text-center">{shortName}</span>
        </div>
    );
};

// Bottom-rail bench. Renders as a flex-sibling of the pitch so it never
// covers the field — the passdown's "no flex sibling" rule was tied to
// the old aspect-ratio sizing trap; ResizeObserver in SoccerPitch lets
// the pitch reflow into whatever vertical space is left. Two visual rows
// fit ~19 chips with smooth horizontal scroll.
const AvailablePlayers = ({ players, assignments, readOnly }) => {
    const assignedIds = new Set(Object.values(assignments).filter(Boolean).map(a => a.player_id));
    const available = players.filter(p => !assignedIds.has(p.id));

    if (readOnly) return null;

    // Split into 2 rows: first half on top, second half on bottom. Both
    // rows scroll in lockstep inside the same horizontal scroll container.
    const half = Math.ceil(available.length / 2);
    const row1 = available.slice(0, half);
    const row2 = available.slice(half);

    return (
        <div className="shrink-0 border-t border-white/10 bg-black/30 px-2 pt-1.5 pb-2">
            <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-widest text-white font-bold">Bench · hold to drag</span>
                <span className="text-[10px] text-gray-300">{available.length}</span>
            </div>
            {available.length === 0 ? (
                <p className="text-gray-300 text-xs text-center py-2">Everyone's on the field.</p>
            ) : (
                <div
                    className="overflow-x-auto no-scrollbar"
                    style={{ touchAction: 'pan-x' }}
                >
                    <div className="flex flex-col gap-1 min-w-max">
                        <div className="flex gap-1.5">
                            {row1.map(p => <DraggablePlayer key={p.id} player={p} />)}
                        </div>
                        {row2.length > 0 && (
                            <div className="flex gap-1.5">
                                {row2.map(p => <DraggablePlayer key={p.id} player={p} />)}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AvailablePlayers;
