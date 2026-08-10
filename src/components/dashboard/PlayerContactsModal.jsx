import React, { useEffect, useState } from 'react';
import { X, Mail, Phone, User, Loader2, Copy, Check } from 'lucide-react';
import { supabase } from '../../supabaseClient';

// Staff-only rolodex for one player: the parent/guardian contacts preloaded
// from the roster. Reads public.player_contacts (RLS restricts to team staff).
// mailto:/tel: links make it one tap to reach a family from the coach's phone.
const PlayerContactsModal = ({ player, onClose }) => {
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState('');

    useEffect(() => {
        let active = true;
        (async () => {
            const { data, error } = await supabase
                .from('player_contacts')
                .select('id, full_name, email, phone, relationship')
                .eq('player_id', player.id)
                .order('created_at', { ascending: true });
            if (!active) return;
            if (error) console.warn('[PlayerContactsModal] load failed', error);
            setContacts(data || []);
            setLoading(false);
        })();
        return () => { active = false; };
    }, [player.id]);

    const copy = async (val, key) => {
        try {
            await navigator.clipboard.writeText(val);
            setCopied(key);
            setTimeout(() => setCopied(''), 1600);
        } catch { /* ignore */ }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end md:items-center justify-center md:p-4 animate-fade-in">
            <div className="bg-brand-dark border border-white/10 rounded-t-2xl md:rounded-2xl w-full md:max-w-md max-h-[90vh] overflow-y-auto shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                </button>

                <div className="p-6 md:p-7 pb-[max(1.5rem,env(safe-area-inset-bottom)+1rem)]">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="p-2.5 bg-brand-green/15 rounded-xl">
                            <User className="w-6 h-6 text-brand-green" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg font-display font-bold text-white uppercase tracking-wider truncate">
                                {player.name} — Contacts
                            </h2>
                            <p className="text-gray-400 text-xs">Parent / guardian info on file</p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
                        </div>
                    ) : contacts.length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed border-white/5 rounded-xl">
                            <p className="text-gray-500 text-sm">No contacts on file for this player yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {contacts.map((c) => (
                                <div key={c.id} className="bg-white/[0.04] border border-white/10 rounded-xl p-3.5">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <span className="text-white font-bold truncate">{c.full_name}</span>
                                        {c.relationship && (
                                            <span className="text-[10px] uppercase tracking-wider text-gray-500 bg-black/40 px-2 py-0.5 rounded shrink-0">
                                                {c.relationship}
                                            </span>
                                        )}
                                    </div>
                                    {c.phone && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <a href={`tel:${c.phone.replace(/[^0-9+]/g, '')}`}
                                               className="flex items-center gap-2 text-brand-green hover:underline min-w-0">
                                                <Phone className="w-3.5 h-3.5 shrink-0" />
                                                <span className="truncate">{c.phone}</span>
                                            </a>
                                            <button onClick={() => copy(c.phone, `p${c.id}`)} className="text-gray-500 hover:text-white ml-auto shrink-0" title="Copy">
                                                {copied === `p${c.id}` ? <Check className="w-3.5 h-3.5 text-brand-green" /> : <Copy className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                    )}
                                    {c.email && (
                                        <div className="flex items-center gap-2 text-sm mt-1.5">
                                            <a href={`mailto:${c.email}`}
                                               className="flex items-center gap-2 text-brand-gold hover:underline min-w-0">
                                                <Mail className="w-3.5 h-3.5 shrink-0" />
                                                <span className="truncate">{c.email}</span>
                                            </a>
                                            <button onClick={() => copy(c.email, `e${c.id}`)} className="text-gray-500 hover:text-white ml-auto shrink-0" title="Copy">
                                                {copied === `e${c.id}` ? <Check className="w-3.5 h-3.5 text-brand-green" /> : <Copy className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <p className="text-[11px] text-gray-500 mt-4 leading-snug">
                        Preloaded from the team roster. Families keep their own info current once they sign up.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PlayerContactsModal;
