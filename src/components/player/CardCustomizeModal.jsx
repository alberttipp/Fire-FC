import React, { useState, useMemo } from 'react';
import { X, Check, Search, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useToast } from '../Toast';
import { CARD_COUNTRIES, flagUrl, DEFAULT_CARD_COUNTRY } from '../../constants/cardCountries';

// Flag picker for the player card. Parents/kids (and staff) choose the country
// shown on the card — featured nations (World Cup + local heritage) first, with
// a quick filter. Writes via the set_card_country RPC (guarded server-side).
const CardCustomizeModal = ({ playerId, playerName = '', current = DEFAULT_CARD_COUNTRY, onSaved, onClose }) => {
    const toast = useToast();
    const [saving, setSaving] = useState(null); // code being saved
    const [q, setQ] = useState('');

    const list = useMemo(() => {
        const t = q.trim().toLowerCase();
        const filtered = t
            ? CARD_COUNTRIES.filter(c => c.name.toLowerCase().includes(t))
            : CARD_COUNTRIES;
        // featured first, then keep file order
        return [...filtered].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    }, [q]);

    const pick = async (code) => {
        if (saving) return;
        setSaving(code);
        const { error } = await supabase.rpc('set_card_country', { p_player_id: playerId, p_country: code });
        setSaving(null);
        if (error) { toast.error("Couldn't save the flag."); return; }
        toast.success('Card flag updated! ⚽');
        onSaved?.(code);
        onClose?.();
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-brand-dark border border-white/10 w-full md:max-w-lg rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                 style={{ maxHeight: 'min(85vh, 85dvh)' }} onClick={(e) => e.stopPropagation()}>
                <div className="shrink-0 border-b border-white/10 p-4 flex items-center gap-3">
                    <h3 className="text-white font-bold flex-1">Pick {playerName ? `${playerName}’s` : 'your'} card flag</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                <div className="shrink-0 px-4 pt-3">
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                        <Search className="w-4 h-4 text-gray-500" />
                        <input
                            value={q} onChange={(e) => setQ(e.target.value)}
                            placeholder="Search countries…"
                            className="bg-transparent flex-1 text-white text-sm focus:outline-none placeholder-gray-500"
                        />
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {list.map(c => {
                            const isCurrent = c.code === current;
                            return (
                                <button
                                    key={c.code}
                                    onClick={() => pick(c.code)}
                                    disabled={!!saving}
                                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors ${isCurrent ? 'border-brand-gold bg-brand-gold/10' : 'border-white/10 bg-white/5 hover:bg-white/10'} ${saving ? 'opacity-60' : ''}`}
                                >
                                    <img src={flagUrl(c.code, 40)} alt="" className="w-7 h-5 object-cover rounded shadow shrink-0" loading="lazy" />
                                    <span className="text-white text-xs font-medium truncate flex-1">{c.name}</span>
                                    {saving === c.code ? <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-gold shrink-0" />
                                        : isCurrent ? <Check className="w-3.5 h-3.5 text-brand-gold shrink-0" /> : null}
                                </button>
                            );
                        })}
                    </div>
                    {list.length === 0 && <p className="text-gray-500 text-sm text-center py-6">No countries match “{q}”.</p>}
                </div>
            </div>
        </div>
    );
};

export default CardCustomizeModal;
