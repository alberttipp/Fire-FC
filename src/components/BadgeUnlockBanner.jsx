import React from 'react';
import { Sparkles } from 'lucide-react';

// Persistent alert that sits on top of the player dashboard when the kid
// has one or more unseen badges. Tapping it triggers the BadgeCelebration
// for the first unseen badge. Designed so a parent watching the screen
// can't accidentally consume the kid's celebration moment — the worst
// case is the parent taps it, which still triggers the celebration; the
// kid just gets to see the playful alert disappear and the celebration
// play.
const BadgeUnlockBanner = ({ count, badge, onClaim }) => {
    if (!count || count < 1) return null;

    const label = count === 1
        ? 'NEW BADGE EARNED!'
        : `${count} NEW BADGES EARNED!`;

    return (
        <button
            type="button"
            onClick={onClaim}
            className="w-full mb-4 group relative overflow-hidden rounded-2xl border-2 border-brand-gold/60 bg-gradient-to-r from-brand-gold/20 via-brand-gold/30 to-brand-gold/20 p-4 text-left animate-banner-glow hover:scale-[1.01] transition-transform"
            aria-label={`${label} Tap to open.`}
        >
            {/* Animated shine sweep */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <div className="relative flex items-center gap-4">
                <div className="text-5xl filter drop-shadow-[0_0_12px_rgba(255,215,0,0.8)] animate-badge-bobble">
                    {badge?.icon || '🏆'}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-brand-gold animate-pulse" />
                        <span className="text-xs font-bold uppercase tracking-widest text-brand-gold">
                            {label}
                        </span>
                    </div>
                    <p className="text-white font-display font-bold text-lg uppercase truncate mt-0.5">
                        {count === 1 ? (badge?.name || 'Achievement Unlocked') : 'Tap to celebrate'}
                    </p>
                    <p className="text-gray-300 text-xs mt-0.5">
                        Tap to open and celebrate
                    </p>
                </div>
                <div className="text-2xl text-brand-gold animate-bounce">→</div>
            </div>

            <style>{`
                @keyframes banner-glow {
                    0%, 100% {
                        box-shadow: 0 0 24px rgba(212, 175, 55, 0.4);
                    }
                    50% {
                        box-shadow: 0 0 40px rgba(212, 175, 55, 0.7);
                    }
                }
                @keyframes badge-bobble {
                    0%, 100% { transform: translateY(0) rotate(-3deg); }
                    50% { transform: translateY(-4px) rotate(3deg); }
                }
                .animate-banner-glow {
                    animation: banner-glow 2s ease-in-out infinite;
                }
                .animate-badge-bobble {
                    animation: badge-bobble 1.4s ease-in-out infinite;
                }
            `}</style>
        </button>
    );
};

export default BadgeUnlockBanner;
