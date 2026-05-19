import React from 'react';
import { useDraggable } from '@dnd-kit/core';

// Single draggable player chip in the available list.
const DraggablePlayer = ({ player }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `player:${player.id}` });
    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={`flex items-center gap-2 px-2.5 py-2 rounded bg-white/10 border border-white/15 hover:bg-white/15 cursor-grab active:cursor-grabbing select-none touch-none shrink-0
                ${isDragging ? 'opacity-30' : ''}`}
        >
            <span className="w-7 h-7 rounded-full bg-brand-green/20 text-brand-green text-xs font-bold flex items-center justify-center shrink-0">
                {player.jersey_number ?? '—'}
            </span>
            <span className="text-white text-sm truncate">{player.first_name} {player.last_name?.charAt(0)}.</span>
        </div>
    );
};

// Available players list — anyone on the roster not currently assigned
// to a starting slot. Drag-source for the pitch.
const AvailablePlayers = ({ players, assignments, readOnly }) => {
    const assignedIds = new Set(Object.values(assignments).filter(Boolean).map(a => a.player_id));
    const available = players.filter(p => !assignedIds.has(p.id));

    if (readOnly) return null;

    return (
        // Floating overlay: blurred dark backdrop so the pitch stays visible
        // through it, max-height so it never grows past its allotted strip.
        <div className="bg-black/55 backdrop-blur border border-white/15 rounded-xl shadow-2xl p-2 md:p-2.5 flex flex-col max-h-[28vh] md:max-h-full md:h-full">
            <div className="flex items-center justify-between mb-1.5 shrink-0">
                <span className="text-[10px] md:text-xs uppercase tracking-widest text-white font-bold">Bench · drag to field</span>
                <span className="text-[10px] text-gray-300">{available.length}</span>
            </div>
            {available.length === 0 ? (
                <p className="text-gray-300 text-xs text-center py-2">Everyone's on the field.</p>
            ) : (
                // Mobile: horizontal scrolling strip. Desktop: vertical list.
                <div className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto flex-1 pr-1">
                    {available.map(p => <DraggablePlayer key={p.id} player={p} />)}
                </div>
            )}
        </div>
    );
};

export default AvailablePlayers;
