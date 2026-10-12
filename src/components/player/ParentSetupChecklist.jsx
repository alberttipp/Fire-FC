import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Shirt, Camera, DollarSign, FileSignature } from 'lucide-react';

// ParentSetupChecklist — a live "get set up" checklist on the parent dashboard.
// Some items auto-complete (photo added, jersey size chosen); others the parent
// checks off (deposit paid, waiver signed). Writes go through SECURITY DEFINER
// RPCs (parents can't write to players directly). Jersey sizing matches the
// Raptors chart. Prominent at the top of the parent overview.
const JERSEY_SIZES = [
    { v: 'YXS', l: 'Youth XS' }, { v: 'YS', l: 'Youth S' }, { v: 'YM', l: 'Youth M' },
    { v: 'YL', l: 'Youth L' }, { v: 'YXL', l: 'Youth XL' },
    { v: 'AS', l: 'Adult S' }, { v: 'AM', l: 'Adult M' }, { v: 'AL', l: 'Adult L' }, { v: 'AXL', l: 'Adult XL' },
];

const ParentSetupChecklist = ({ player, onPlayerChange }) => {
    const checklist = player?.parent_setup_checklist || {};
    const name = player?.first_name || 'your player';
    const [savingJersey, setSavingJersey] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    const items = [
        { key: 'photo', icon: Camera, label: `Add ${name}'s photo`, done: !!player?.avatar_url, auto: true, hint: 'Tap “Photo” under the card below.' },
        { key: 'jersey', icon: Shirt, label: 'Choose jersey size', done: !!player?.jersey_size, auto: true },
        { key: 'deposit', icon: DollarSign, label: 'Pay the $50 deposit', done: !!checklist.deposit },
        { key: 'waiver', icon: FileSignature, label: 'Sign the league waiver', done: !!checklist.waiver, hint: 'Required by the league before the first game — we’ll send it to complete.' },
    ];
    const doneCount = items.filter((i) => i.done).length;
    const allDone = doneCount === items.length;

    const setJersey = async (size) => {
        if (!player?.id) return;
        setSavingJersey(true);
        onPlayerChange?.({ jersey_size: size });            // optimistic
        try { await supabase.rpc('set_player_jersey_size', { p_player_id: player.id, p_size: size }); }
        catch (_) { /* optimistic; next load reconciles */ }
        setSavingJersey(false);
    };

    const toggleItem = async (key, next) => {
        if (!player?.id) return;
        onPlayerChange?.({ parent_setup_checklist: { ...checklist, [key]: next } });  // optimistic
        try { await supabase.rpc('set_parent_checklist_item', { p_player_id: player.id, p_key: key, p_done: next }); }
        catch (_) { /* optimistic */ }
    };

    const venmoUrl = `https://venmo.com/?txn=pay&recipients=Albert-Tipp&amount=50&note=${encodeURIComponent(`Rock City FC winter deposit - ${player?.first_name || ''} ${player?.last_name || ''}`)}`;

    if (!player?.id) return null;

    return (
        <div className="max-w-xl mx-auto mb-4 rounded-2xl border border-brand-gold/40 bg-gradient-to-br from-brand-gold/10 to-transparent overflow-hidden">
            <button type="button" onClick={() => setCollapsed((c) => !c)} className="w-full flex items-center gap-3 p-4 text-left">
                <div className="w-9 h-9 rounded-xl bg-brand-gold/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-brand-gold" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-white font-display font-bold uppercase tracking-wider text-sm">
                        {allDone ? "You're all set! ✓" : 'Get set up'}
                    </div>
                    <div className="text-[11px] text-gray-400">{doneCount} of {items.length} done — tap to {collapsed ? 'open' : 'hide'}</div>
                </div>
                {/* progress pips */}
                <div className="flex items-center gap-1 mr-1">
                    {items.map((i) => <span key={i.key} className={`w-1.5 h-1.5 rounded-full ${i.done ? 'bg-brand-green' : 'bg-white/20'}`} />)}
                </div>
                {collapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
            </button>

            {!collapsed && (
                <div className="px-4 pb-4 space-y-2">
                    {items.map((item) => {
                        const Icon = item.icon;
                        return (
                            <div key={item.key} className={`rounded-xl border p-3 ${item.done ? 'border-brand-green/30 bg-brand-green/5' : 'border-white/10 bg-white/[0.03]'}`}>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => { if (!item.auto) toggleItem(item.key, !item.done); }}
                                        disabled={item.auto}
                                        className="shrink-0"
                                        aria-label={item.done ? 'Done' : 'Mark done'}
                                    >
                                        {item.done
                                            ? <CheckCircle2 className="w-6 h-6 text-brand-green" />
                                            : <Circle className={`w-6 h-6 ${item.auto ? 'text-gray-600' : 'text-gray-400 hover:text-brand-green'}`} />}
                                    </button>
                                    <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                                    <span className={`flex-1 text-sm ${item.done ? 'text-gray-400 line-through' : 'text-white'}`}>{item.label}</span>
                                </div>

                                {/* Jersey size dropdown */}
                                {item.key === 'jersey' && (
                                    <div className="mt-2 pl-9">
                                        <select
                                            value={player.jersey_size || ''}
                                            onChange={(e) => setJersey(e.target.value)}
                                            disabled={savingJersey}
                                            className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-brand-green focus:outline-none"
                                        >
                                            <option value="" className="bg-gray-800">Select a size…</option>
                                            {JERSEY_SIZES.map((s) => <option key={s.v} value={s.v} className="bg-gray-800">{s.l}</option>)}
                                        </select>
                                        <p className="text-[11px] text-gray-500 mt-1">Use the same sizing as the Raptors jerseys.</p>
                                    </div>
                                )}

                                {/* Deposit — Venmo pay link */}
                                {item.key === 'deposit' && !item.done && (
                                    <div className="mt-2 pl-9">
                                        <a href={venmoUrl} target="_blank" rel="noopener noreferrer"
                                            className="inline-block text-center px-4 py-2 rounded-lg font-bold text-sm text-white bg-[#008CFF] hover:brightness-110">
                                            Pay $50 on Venmo (@Albert-Tipp) →
                                        </a>
                                        <p className="text-[11px] text-gray-500 mt-1">Put {name}'s name in the note. Then tap the circle to mark it paid.</p>
                                    </div>
                                )}

                                {item.hint && !item.done && item.key !== 'deposit' && (
                                    <p className="text-[11px] text-gray-500 mt-1 pl-9">{item.hint}</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ParentSetupChecklist;
