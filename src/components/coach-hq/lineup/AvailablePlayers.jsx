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
            className={`flex items-center gap-2 px-2.5 py-2 rounded bg-white/5 border border-white/10 hover:bg-white/10 cursor-grab active:cursor-grabbing select-none touch-none
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
        <div className="glass-panel p-3 h-full flex flex-col">
            <div className="flex items-center justify-between mb-2 shrink-0">
                <span className="text-xs uppercase tracking-widest text-gray-300 font-bold">Bench</span>
                <span className="text-[10px] text-gray-500">{available.length} available</span>
            </div>
            {available.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-3">Everyone's on the field.</p>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-1 gap-1.5 flex-1 overflow-y-auto pr-1">
                    {available.map(p => <DraggablePlayer key={p.id} player={p} />)}
                </div>
            )}
        </div>
    );
};

export default AvailablePlayers;
