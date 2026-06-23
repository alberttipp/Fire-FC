import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useToast } from '../Toast';

// Add / improve a parent's or sibling's best juggle run for the Family
// Juggle-Off. Deliberately tiny: who's juggling (Parent vs Sibling), their
// name, and their best run. Writes to the SEPARATE juggle_family_attempts
// table via log_family_juggle — never touches the kids' competition.
//
// Portaled to document.body so the fixed overlay is never trapped by a
// glass-panel (backdrop-filter) ancestor. See feedback-firefc-glass-panel-trap.
// Quick-pick relationships. Each sets the name AND the parent/sibling kind so
// most families never have to type — tap "Dad", enter a number, done. "Other"
// opens a free-text name + a grown-up/sibling toggle for anyone else
// (Grandpa, a cousin, a second brother, etc.).
const PRESETS = [
    { id: 'dad',     label: 'Dad',     kind: 'parent',  emoji: '👨' },
    { id: 'mom',     label: 'Mom',     kind: 'parent',  emoji: '👩' },
    { id: 'brother', label: 'Brother', kind: 'sibling', emoji: '👦' },
    { id: 'sister',  label: 'Sister',  kind: 'sibling', emoji: '👧' },
    { id: 'other',   label: 'Other',   kind: 'parent',  emoji: '✏️' },
];

const LogFamilyJuggleModal = ({ playerId, playerName, onClose, onDone }) => {
    const toast = useToast();
    const [preset, setPreset] = useState(null);
    const [kind, setKind] = useState('parent');
    const [label, setLabel] = useState('');
    const [best, setBest] = useState('');
    const [saving, setSaving] = useState(false);

    const choosePreset = (p) => {
        setPreset(p.id);
        setKind(p.kind);
        setLabel(p.id === 'other' ? '' : p.label);
    };
    const isOther = preset === 'other';

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    const handleSave = async () => {
        if (saving) return;
        const name = label.trim();
        const bestN = parseInt(best, 10);
        if (!name) { toast.error('Add a name (like "Dad" or "Mia").'); return; }
        if (!Number.isFinite(bestN) || bestN < 0) { toast.error('Enter their best run in a row.'); return; }
        setSaving(true);
        try {
            const { data, error } = await supabase.rpc('log_family_juggle', {
                p_player_id: playerId, p_label: name, p_kind: kind, p_best: bestN,
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.message || 'Could not save.');
            toast.success(`${name}'s score is in — game on! ⚽`);
            onDone?.();
            onClose();
        } catch (err) {
            console.error('[family-juggle] save error', err);
            toast.error(err.message || "Couldn't save. Try again.");
        } finally {
            setSaving(false);
        }
    };

    const onSubmit = (e) => { e.preventDefault(); handleSave(); };

    return createPortal(
        <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <form
                className="bg-brand-dark border border-white/10 w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl relative overflow-hidden max-h-[90vh] flex flex-col"
                style={{ maxHeight: 'min(90vh, 90dvh)' }}
                onClick={(e) => e.stopPropagation()}
                onSubmit={onSubmit}
            >
                <div className="shrink-0 flex items-center gap-3 p-6 pb-4 border-b border-white/10">
                    <div className="w-11 h-11 rounded-full bg-brand-gold/15 border-2 border-brand-gold/40 flex items-center justify-center text-xl">🆚</div>
                    <div className="min-w-0">
                        <h3 className="text-white font-bold text-lg leading-tight">Add a challenger</h3>
                        <p className="text-gray-400 text-xs">{playerName ? `Can they out-juggle ${playerName}?` : 'Family Juggle-Off'}</p>
                    </div>
                    <button type="button" onClick={onClose} className="ml-auto text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
                    {/* Who's juggling — quick relationship picks */}
                    <div>
                        <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-1.5">Add a parent or sibling</label>
                        <div className="grid grid-cols-3 gap-2">
                            {PRESETS.map((p) => (
                                <button key={p.id} type="button" onClick={() => choosePreset(p)}
                                        className={`py-2.5 rounded-lg border text-sm font-bold transition-colors flex flex-col items-center gap-0.5 ${preset === p.id ? 'bg-brand-green/15 border-brand-green/50 text-brand-green' : 'bg-white/5 border-white/10 text-gray-300'}`}>
                                    <span className="text-lg leading-none">{p.emoji}</span>
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom name + grown-up/sibling — only when "Other" is picked */}
                    {isOther && (
                        <>
                            <div>
                                <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-1.5">Their name</label>
                                <input
                                    type="text" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus
                                    placeholder="Grandpa, cousin Leo, little bro…"
                                    maxLength={24}
                                    className="w-full bg-black/50 border border-white/10 rounded-lg py-3 px-4 text-white text-lg focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-1.5">Grown-up or sibling?</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[['parent', '👤 Grown-up'], ['sibling', '🧒 Sibling']].map(([k, lbl]) => (
                                        <button key={k} type="button" onClick={() => setKind(k)}
                                                className={`py-2.5 rounded-lg border text-sm font-bold transition-colors ${kind === k ? 'bg-brand-green/15 border-brand-green/50 text-brand-green' : 'bg-white/5 border-white/10 text-gray-300'}`}>
                                            {lbl}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Best run — appears once they've chosen who's juggling */}
                    {preset && (
                        <div>
                            <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-1.5">
                                {label.trim() ? `${label.trim()}'s best juggles in a row` : 'Best juggles in a row'}
                            </label>
                            <input
                                type="number" inputMode="numeric" min="0" value={best}
                                onChange={(e) => setBest(e.target.value)} placeholder="0"
                                autoFocus={!isOther}
                                className="w-full bg-black/50 border border-white/10 rounded-lg py-3 px-4 text-white text-2xl font-mono text-center focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                            />
                            <p className="text-[11px] text-gray-500 mt-1">Just for fun — this does NOT affect the kids' competition or prizes. Log again to update their best.</p>
                        </div>
                    )}
                </div>

                <div className="shrink-0 border-t border-white/10 bg-brand-dark p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                    <button type="submit" disabled={saving || !preset}
                            className="w-full py-3.5 rounded-lg bg-brand-green text-brand-dark font-display font-bold uppercase tracking-wider hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                        {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving…</> : 'Add to the Juggle-Off'}
                    </button>
                </div>
            </form>
        </div>,
        document.body,
    );
};

export default LogFamilyJuggleModal;
