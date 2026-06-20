import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { X } from 'lucide-react';
import { SLOT_LABELS } from './formations';

// One position bubble on the pitch. Droppable area for AvailablePlayers
// drags. When filled, shows the player's jersey + last name. Tap the X
// to unassign (staff only).
const PositionSlot = ({ slot, assignment, onUnassign, readOnly, selectedPlayerId = null, onSlotTap }) => {
    const { setNodeRef, isOver } = useDroppable({ id: `slot:${slot.id}`, disabled: readOnly });
    const filled = !!assignment;
    // This slot already holds the player the coach just picked up.
    const isSelectedHere = filled && assignment.player_id === selectedPlayerId;
    // A bench player is selected and waiting for a spot — invite the tap.
    const inviting = !readOnly && !!selectedPlayerId && !isSelectedHere;

    return (
        <div
            ref={setNodeRef}
            onClick={() => !readOnly && onSlotTap?.(slot.id)}
            style={{ left: `${slot.x}%`, top: `${slot.y}%`, transform: 'translate(-50%, -50%)' }}
            className={`absolute ${readOnly ? '' : 'cursor-pointer'}`}
            title={SLOT_LABELS[slot.id] || slot.id}
        >
            <div className={`relative flex flex-col items-center group ${filled ? '' : 'opacity-90'}`}>
                <div
                    className={`w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center font-bold text-sm md:text-base transition-all border-2
                        ${filled ? 'bg-brand-green text-brand-dark border-white shadow-lg' : 'bg-white/15 text-white border-dashed border-white/60'}
                        ${isOver && !filled ? 'scale-110 bg-brand-gold/40 border-brand-gold' : ''}
                        ${isOver && filled ? 'ring-2 ring-brand-gold' : ''}
                        ${isSelectedHere ? 'ring-2 ring-brand-gold scale-110' : ''}
                        ${inviting ? 'ring-2 ring-brand-gold/70 animate-pulse' : ''}
                    `}
                >
                    {filled ? (assignment.jersey ?? slot.id) : slot.id}
                </div>
                <div className="absolute -bottom-4 md:-bottom-5 left-1/2 -translate-x-1/2 text-[9px] sm:text-[10px] md:text-xs font-semibold text-white whitespace-nowrap bg-brand-dark/70 px-1.5 rounded leading-tight max-w-[100px] truncate">
                    {filled ? assignment.name : slot.id}
                </div>
                {filled && !readOnly && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onUnassign?.(slot.id); }}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-400 text-white rounded-full flex items-center justify-center shadow transition-opacity"
                        title="Remove"
                    >
                        <X className="w-3 h-3" strokeWidth={3} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default PositionSlot;
