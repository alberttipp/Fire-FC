import React, { useState, useEffect, useCallback } from 'react';
import { X, Lock, Check, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useToast } from '../Toast';
import { HERO_THEMES } from './PlayerCard';

// Hero Mode picker — unlockable card themes earned through play. Shows each
// hero's unlock progress so kids see what to chase (train -> Ronaldo, juggle ->
// Messi). Reads get_player_hero_modes; writes set_player_hero_mode (guarded).
const META = {
    messi:   { emoji: '🐐', blurb: 'Magician’s touch. Earned by juggling.' },
    ronaldo: { emoji: '🤫', blurb: 'SIUU — pure work rate. Earned by training.' },
};

const HeroModeModal = ({ playerId, playerName = '', onSaved, onClose }) => {
    const toast = useToast();
    const [data, setData] = useState(null);
    const [saving, setSaving] = useState(null); // mode being saved

    const load = useCallback(async () => {
        const { data: d, error } = await supabase.rpc('get_player_hero_modes', { p_player_id: playerId });
        if (error) { toast.error("Couldn't load hero modes."); return; }
        setData(d || null);
    }, [playerId]);
    useEffect(() => { load(); }, [load]);

    const selected = data?.selected || 'default';
    const heroes = data?.heroes || [];

    const choose = async (mode) => {
        if (saving) return;
        setSaving(mode);
        const { error } = await supabase.rpc('set_player_hero_mode', { p_player_id: playerId, p_mode: mode });
        setSaving(null);
        if (error) { toast.error(/unlocked/i.test(error.message) ? 'Keep at it — not unlocked yet!' : "Couldn't set hero mode."); return; }
        toast.success(mode === 'default' ? 'Back to the classic card.' : 'Hero Mode on! ⚡');
        onSaved?.(mode === 'default' ? null : mode);
        onClose?.();
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-brand-dark border border-white/10 w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                 style={{ maxHeight: 'min(88vh, 88dvh)' }} onClick={(e) => e.stopPropagation()}>
                <div className="shrink-0 border-b border-white/10 p-4 flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-brand-gold" />
                    <h3 className="text-white font-bold flex-1">{playerName ? `${playerName}’s` : 'Your'} Hero Mode</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
                    {!data ? (
                        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>
                    ) : (
                        <>
                            {/* Classic / default */}
                            <button
                                onClick={() => choose('default')}
                                disabled={!!saving}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${selected === 'default' ? 'border-brand-gold bg-brand-gold/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                            >
                                <span className="text-2xl">⚽</span>
                                <div className="flex-1">
                                    <div className="text-white font-bold text-sm">Classic</div>
                                    <div className="text-gray-400 text-xs">The standard Fire FC card.</div>
                                </div>
                                {saving === 'default' ? <Loader2 className="w-4 h-4 animate-spin text-brand-gold" /> : selected === 'default' && <Check className="w-4 h-4 text-brand-gold" />}
                            </button>

                            {heroes.map(h => {
                                const t = HERO_THEMES[h.id];
                                const meta = META[h.id] || {};
                                const isSel = selected === h.id;
                                const pct = Math.min(100, Math.round((h.progress / h.goal) * 100));
                                const remaining = Math.max(0, h.goal - h.progress);
                                return (
                                    <button
                                        key={h.id}
                                        onClick={() => h.unlocked && choose(h.id)}
                                        disabled={!h.unlocked || !!saving}
                                        className={`w-full p-3 rounded-xl border text-left transition-colors ${isSel ? `${t.border} bg-white/10` : 'border-white/10 bg-white/5'} ${h.unlocked ? 'hover:bg-white/10 cursor-pointer' : 'opacity-90 cursor-default'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{meta.emoji}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-black text-sm uppercase tracking-wider ${t.accent}`}>{h.name}</span>
                                                    {!h.unlocked && <Lock className="w-3.5 h-3.5 text-gray-500" />}
                                                </div>
                                                <div className="text-gray-400 text-xs">{meta.blurb}</div>
                                            </div>
                                            {saving === h.id ? <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
                                                : isSel ? <Check className={`w-4 h-4 ${t.accent}`} /> : null}
                                        </div>
                                        {/* progress */}
                                        <div className="mt-2.5">
                                            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${h.unlocked ? t.badgeCls : 'bg-white/25'}`} style={{ width: `${pct}%` }} />
                                            </div>
                                            <div className="mt-1 text-[11px] font-bold">
                                                {h.unlocked
                                                    ? <span className={t.accent}>Unlocked! Tap to equip.</span>
                                                    : <span className="text-gray-400">{remaining} more {h.metric_label} to unlock ({h.progress}/{h.goal})</span>}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                            <p className="text-[10px] text-gray-600 text-center pt-1">Keep training and juggling to unlock more.</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HeroModeModal;
