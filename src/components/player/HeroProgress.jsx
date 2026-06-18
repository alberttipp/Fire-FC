import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { HERO_THEMES } from './PlayerCard';

// Always-visible "how close am I?" strip under the player card — mini progress
// bars toward each Hero Mode so kids see the climb without opening the picker.
// Reads get_player_hero_modes; bump refreshKey to re-pull after equipping.
const SHORT = {
    messi:   { label: 'Messi', emoji: '🐐' },
    ronaldo: { label: 'CR7',   emoji: '🤫' },
};

const HeroProgress = ({ playerId, refreshKey = 0 }) => {
    const [heroes, setHeroes] = useState(null);

    useEffect(() => {
        if (!playerId) return;
        let cancelled = false;
        supabase.rpc('get_player_hero_modes', { p_player_id: playerId }).then(({ data }) => {
            if (!cancelled) setHeroes(data?.heroes || []);
        });
        return () => { cancelled = true; };
    }, [playerId, refreshKey]);

    if (!heroes || heroes.length === 0) return null;

    return (
        <div className="max-w-xs mx-auto mt-3 space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold text-center">Hero Mode progress</div>
            {heroes.map(h => {
                const t = HERO_THEMES[h.id] || {};
                const s = SHORT[h.id] || { label: h.name, emoji: '⭐' };
                const pct = Math.min(100, Math.round((h.progress / h.goal) * 100));
                const remaining = Math.max(0, h.goal - h.progress);
                return (
                    <div key={h.id} className="flex items-center gap-2 text-[11px]">
                        <span className="w-12 shrink-0 flex items-center gap-1">
                            <span>{s.emoji}</span><span className={`font-bold ${t.accent}`}>{s.label}</span>
                        </span>
                        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${h.unlocked ? t.badgeCls : 'bg-white/25'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`w-16 text-right shrink-0 font-bold ${h.unlocked ? t.accent : 'text-gray-400'}`}>
                            {h.unlocked ? 'Unlocked ✓' : `${h.progress}/${h.goal}`}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

export default HeroProgress;
