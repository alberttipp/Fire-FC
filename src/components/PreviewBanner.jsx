import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, X } from 'lucide-react';

// Sticky banner shown at the top of the parent and player dashboards when
// a coach/manager is previewing what a parent or player would see. Lets
// them exit cleanly back to their own dashboard.
//
// Renders nothing when isPreview is false — safe to drop in unconditionally.

const PreviewBanner = ({ isPreview, role, playerName, onExit }) => {
    const navigate = useNavigate();
    if (!isPreview) return null;

    const exit = () => {
        if (onExit) onExit();
        navigate('/dashboard');
    };

    return (
        <div className="sticky top-0 z-[60] bg-brand-gold text-brand-dark border-b-2 border-brand-gold/80 shadow-lg">
            <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
                <Eye className="w-4 h-4 shrink-0" />
                <p className="text-xs sm:text-sm font-bold uppercase tracking-wider flex-1 min-w-0 truncate">
                    Preview · {role === 'player' ? 'Player view' : 'Parent view'}
                    {playerName ? ` · ${playerName}` : ''}
                </p>
                <button
                    onClick={exit}
                    className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded border border-brand-dark/30 hover:bg-brand-dark/10 transition-colors flex items-center gap-1.5 shrink-0"
                >
                    <X className="w-3 h-3" /> Exit
                </button>
            </div>
        </div>
    );
};

export default PreviewBanner;
