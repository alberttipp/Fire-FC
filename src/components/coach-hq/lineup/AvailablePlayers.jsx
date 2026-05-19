import React from 'react';
import { useDraggable } from '@dnd-kit/core';

// One draggable player chip. Intentionally compact so all 19+ roster
// players fit in the floating bench panel without needing to scroll
// off-screen to find someone.
//
// Notable absence of `touch-none`: combined with the TouchSensor's 250ms
// activation delay in LineupBuilder, this lets the user swipe through
// the bench (scrolling the panel) without immediately initiating a
// drag. Press-and-hold for a beat to start dragging.
const DraggablePlayer = ({ player }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `player:${player.id}` });
    // Show first name (or last if first missing) — shorter than full name.
    const shortName = player.first_name || player.last_name || '—';
    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={`flex items-center gap-1.5 px-1.5 py-1.5 rounded bg-white/10 border border-white/15 hover:bg-white/20 cursor-grab active:cursor-grabbing select-none min-h-[34px]
                ${isDragging ? 'opacity-30' : ''}`}
        >
            <span className="w-6 h-6 rounded-full bg-brand-green/25 text-brand-green text-[10px] font-bold flex items-center justify-center shrink-0">
                {player.jersey_number ?? '—'}
            </span>
            <span className="text-white text-xs truncate flex-1 min-w-0">{shortName}</span>
        </div>
    );
};

const AvailablePlayers = ({ players, assignments, readOnly }) => {
    const assignedIds = new Set(Object.values(assignments).filter(Boolean).map(a => a.player_id));
    const available = players.filter(p => !assignedIds.has(p.id));

    if (readOnly) return null;

    return (
        // Floating overlay: blurred dark backdrop so the pitch shows through.
        // max-h-[42vh] on mobile (50% taller than before) lets the whole
        // roster fit in a 4-column grid without overflow. Desktop: full
        // height of the right column.
        <div className="bg-black/55 backdrop-blur border border-white/15 rounded-xl shadow-2xl p-2 md:p-2.5 flex flex-col max-h-[42vh] md:max-h-full md:h-full">
            <div className="flex items-center justify-between mb-1.5 shrink-0">
                <span className="text-[10px] md:text-xs uppercase tracking-widest text-white font-bold">Bench · hold to drag</span>
                <span className="text-[10px] text-gray-300">{available.length}</span>
            </div>
            {available.length === 0 ? (
                <p className="text-gray-300 text-xs text-center py-2">Everyone's on the field.</p>
            ) : (
                // Mobile: 4-col grid (all 19+ players visible without scroll).
                // Desktop: single column list.
                <div className="grid grid-cols-4 md:grid-cols-1 gap-1.5 overflow-y-auto flex-1 pr-1">
                    {available.map(p => <DraggablePlayer key={p.id} player={p} />)}
                </div>
            )}
        </div>
    );
};

export default AvailablePlayers;
