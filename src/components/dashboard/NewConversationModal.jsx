import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, MessageSquare, Users, Search, Check } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useToast } from '../Toast';

// New conversation creation — DM or Group.
// Lists "messageable users" (staff + parents on teams the caller is staff
// on) via the get_messageable_users() RPC, multi-select for groups,
// single-select for DMs, then calls create_conversation() RPC which
// inserts both the conversation and member rows atomically.
//
// Designed to handle a roster that grows from 4 parents → 30+ without
// UI changes: search box filters, virtualization not needed at the
// expected scale (a 12-player team has ~25 messageable users tops).
const NewConversationModal = ({ onClose, onCreated }) => {
    const toast = useToast();
    const [type, setType] = useState('dm'); // 'dm' | 'group'
    const [people, setPeople] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(new Set());
    const [groupName, setGroupName] = useState('');
    const [search, setSearch] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data, error } = await supabase.rpc('get_messageable_users');
            if (cancelled) return;
            if (error) {
                console.error('get_messageable_users failed:', error);
                toast.error("Couldn't load contacts.");
            }
            setPeople(data || []);
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return people;
        return people.filter(p =>
            (p.display_name || '').toLowerCase().includes(q) ||
            (p.role_hint || '').toLowerCase().includes(q)
        );
    }, [people, search]);

    const togglePerson = (userId) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(userId)) {
                next.delete(userId);
            } else {
                if (type === 'dm') next.clear();
                next.add(userId);
            }
            return next;
        });
    };

    const canSubmit = type === 'dm'
        ? selected.size === 1
        : selected.size >= 1 && groupName.trim().length > 0;

    const submit = async () => {
        if (!canSubmit || creating) return;
        setCreating(true);
        const memberIds = Array.from(selected);
        // For DM, derive a name from the picked person so the sidebar has something readable
        const namesById = new Map(people.map(p => [p.user_id, p.display_name || 'Unnamed']));
        const computedName = type === 'dm'
            ? namesById.get(memberIds[0]) || 'Direct message'
            : groupName.trim();
        const { data: convoId, error } = await supabase.rpc('create_conversation', {
            p_type: type,
            p_name: computedName,
            p_member_ids: memberIds,
        });
        setCreating(false);
        if (error) {
            console.error('create_conversation failed:', error);
            toast.error(`Couldn't create: ${error.message}`);
            return;
        }
        toast.success(type === 'dm' ? `Started DM with ${computedName}.` : `Group "${computedName}" created.`);
        onCreated?.(convoId);
        onClose?.();
    };

    return (
        <div className="fixed inset-0 z-[110] bg-black/70 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
            <div
                className="w-full md:max-w-md bg-brand-dark border border-white/10 rounded-t-2xl md:rounded-2xl flex flex-col overflow-hidden max-h-[90vh]"
                style={{ maxHeight: 'min(90vh, 90dvh)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        {type === 'dm' ? <MessageSquare className="w-4 h-4 text-brand-green" /> : <Users className="w-4 h-4 text-brand-gold" />}
                        New {type === 'dm' ? 'Direct Message' : 'Group Chat'}
                    </h3>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                {/* Type toggle */}
                <div className="px-4 pt-3">
                    <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10">
                        <button
                            onClick={() => { setType('dm'); setSelected(new Set()); }}
                            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${type === 'dm' ? 'bg-brand-green text-brand-dark' : 'text-gray-400'}`}
                        >
                            DM
                        </button>
                        <button
                            onClick={() => { setType('group'); }}
                            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${type === 'group' ? 'bg-brand-gold text-brand-dark' : 'text-gray-400'}`}
                        >
                            Group
                        </button>
                    </div>
                </div>

                {/* Group name */}
                {type === 'group' && (
                    <div className="px-4 pt-3">
                        <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Group name</label>
                        <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="e.g. Coaches huddle"
                            maxLength={60}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-brand-gold focus:ring-1 focus:ring-brand-gold outline-none"
                        />
                    </div>
                )}

                {/* Search */}
                <div className="px-4 pt-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name or role"
                            className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:border-white/30 outline-none"
                        />
                    </div>
                </div>

                {/* People list */}
                <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {loading ? (
                        <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>
                    ) : filtered.length === 0 ? (
                        <p className="text-center text-gray-500 text-xs py-6">No contacts match.</p>
                    ) : (
                        <ul className="space-y-1">
                            {filtered.map(p => {
                                const isSel = selected.has(p.user_id);
                                return (
                                    <li key={p.user_id}>
                                        <button
                                            type="button"
                                            onClick={() => togglePerson(p.user_id)}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${isSel ? 'bg-brand-gold/15 ring-1 ring-brand-gold/40' : 'hover:bg-white/5'}`}
                                        >
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isSel ? 'bg-brand-gold text-brand-dark' : 'bg-white/10 text-white'}`}>
                                                {(p.display_name || '?').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white text-sm font-medium truncate">{p.display_name || 'Unnamed'}</div>
                                                <div className="text-gray-500 text-[11px] capitalize">{p.role_hint}{p.team_name ? ` · ${p.team_name}` : ''}</div>
                                            </div>
                                            {isSel && <Check className="w-4 h-4 text-brand-gold shrink-0" />}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {/* Footer */}
                <div className="shrink-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-white/10 flex items-center gap-2">
                    <span className="text-xs text-gray-500 flex-1">{selected.size} selected</span>
                    <button onClick={onClose} className="px-3 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
                    <button
                        onClick={submit}
                        disabled={!canSubmit || creating}
                        className="px-4 py-2 rounded-lg text-sm font-bold bg-brand-green text-brand-dark hover:bg-brand-green/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                        {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        Create
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewConversationModal;
