import React from 'react';
import { FORMATION_IDS } from './formations';

// Four-button row for switching formations. Switching does NOT reset
// assignments — slot ids that exist in both formations carry over;
// players whose slot disappears go back to the bench automatically
// (LineupBuilder reconciles).
const FormationPicker = ({ value, onChange, readOnly }) => (
    <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold shrink-0 hidden sm:inline">Formation</span>
        <div className="flex bg-white/5 rounded-lg p-1 border border-white/10 overflow-x-auto no-scrollbar">
            {FORMATION_IDS.map(id => (
                <button
                    key={id}
                    type="button"
                    onClick={() => !readOnly && onChange(id)}
                    disabled={readOnly}
                    className={`shrink-0 px-2 py-1 rounded-md text-[11px] sm:text-xs font-display font-bold tracking-wider transition-all
                        ${value === id ? 'bg-brand-green text-brand-dark shadow' : 'text-gray-400 hover:text-white'}
                        ${readOnly ? 'cursor-default opacity-60' : ''}`}
                >
                    {id}
                </button>
            ))}
        </div>
    </div>
);

export default FormationPicker;
