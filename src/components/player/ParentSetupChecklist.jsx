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
    const [numberDraft, setNumberDraft] = useState(player?.jersey_number ?? '');
    const [collapsed, setCollapsed] = useState(false);

    const items = [
        { key: 'photo', icon: Camera, label: `Add ${name}'s photo`, done: !!player?.avatar_url, auto: true, hint: 'Tap “Photo” under the card below.' },
        { key: 'jersey', icon: Shirt, label: 'Choose jersey size & number', done: !!player?.jersey_size, auto: true },
        { key: 'deposit', icon: DollarSign, label: 'Pay the $50 deposit', done: !!checklist.deposit },
        { key: 'waiver', icon: FileSignature, label: 'Sign the league waiver', done: !!checklist.waiver },
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

    const saveNumber = async () => {
        if (!player?.id) return;
        const n = numberDraft === '' ? null : Math.max(0, Math.min(99, parseInt(numberDraft, 10) || 0));
        onPlayerChange?.({ jersey_number: n });             // optimistic
        try { await supabase.rpc('set_player_jersey_number', { p_player_id: player.id, p_number: n }); }
        catch (_) { /* optimistic */ }
    };

    const toggleItem = async (key, next) => {
        if (!player?.id) return;
        onPlayerChange?.({ parent_setup_checklist: { ...checklist, [key]: next } });  // optimistic
        try { await supabase.rpc('set_parent_checklist_item', { p_player_id: player.id, p_key: key, p_done: next }); }
        catch (_) { /* optimistic */ }
    };

    // Electronic waiver signature — records the typed name + timestamp server-side
    // (sign_waiver RPC) and alerts club staff. Not a plain checkbox.
    const [waiverName, setWaiverName] = useState('');
    const [waiverAgree, setWaiverAgree] = useState(false);
    const [signing, setSigning] = useState(false);
    const signWaiver = async () => {
        if (!player?.id || !waiverName.trim() || !waiverAgree) return;
        setSigning(true);
        onPlayerChange?.({ parent_setup_checklist: { ...checklist, waiver: true } });  // optimistic
        try {
            const { error } = await supabase.rpc('sign_waiver', {
                p_player_id: player.id, p_waiver_key: 'isl-indoor-2026-27', p_signer_name: waiverName.trim(),
                p_relationship: null, p_user_agent: (typeof navigator !== 'undefined' ? navigator.userAgent : null),
            });
            if (error) throw error;
        } catch (_) { /* optimistic; next load reconciles */ }
        setSigning(false);
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
                                        onClick={() => { if (!item.auto && item.key !== 'waiver') toggleItem(item.key, !item.done); }}
                                        disabled={item.auto || item.key === 'waiver'}
                                        className="shrink-0"
                                        aria-label={item.done ? 'Done' : 'Mark done'}
                                    >
                                        {item.done
                                            ? <CheckCircle2 className="w-6 h-6 text-brand-green" />
                                            : <Circle className={`w-6 h-6 ${(item.auto || item.key === 'waiver') ? 'text-gray-600' : 'text-gray-400 hover:text-brand-green'}`} />}
                                    </button>
                                    <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                                    <span className={`flex-1 text-sm ${item.done ? 'text-gray-400 line-through' : 'text-white'}`}>{item.label}</span>
                                </div>

                                {/* Jersey size dropdown + preferred number */}
                                {item.key === 'jersey' && (
                                    <div className="mt-2 pl-9 space-y-2">
                                        <div className="flex gap-2">
                                            <select
                                                value={player.jersey_size || ''}
                                                onChange={(e) => setJersey(e.target.value)}
                                                disabled={savingJersey}
                                                className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-brand-green focus:outline-none"
                                            >
                                                <option value="" className="bg-gray-800">Select a size…</option>
                                                {JERSEY_SIZES.map((s) => <option key={s.v} value={s.v} className="bg-gray-800">{s.l}</option>)}
                                            </select>
                                            <input
                                                type="number" min="0" max="99" inputMode="numeric"
                                                placeholder="#"
                                                value={numberDraft}
                                                onChange={(e) => setNumberDraft(e.target.value)}
                                                onBlur={saveNumber}
                                                className="w-20 bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm text-center focus:border-brand-green focus:outline-none"
                                            />
                                        </div>
                                        <p className="text-[11px] text-gray-500">Use the same sizing as the Raptors jerseys. Number is a preference — the coach confirms if two players pick the same.</p>
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

                                {/* Waiver — real electronic signature */}
                                {item.key === 'waiver' && !item.done && (
                                    <div className="mt-2 pl-9 space-y-2">
                                        <a href="/docs/2026-27-waiver.pdf" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-green hover:underline">
                                            <FileSignature className="w-3.5 h-3.5" /> Read the waiver
                                        </a>
                                        <input
                                            type="text" value={waiverName} onChange={(e) => setWaiverName(e.target.value)}
                                            placeholder="Type your full legal name"
                                            className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-brand-green focus:outline-none"
                                        />
                                        <label className="flex items-start gap-2 text-[12px] text-gray-300 cursor-pointer">
                                            <input type="checkbox" checked={waiverAgree} onChange={(e) => setWaiverAgree(e.target.checked)} className="mt-0.5" />
                                            <span>I have read and agree to the league <b>waiver, medical release &amp; code of conduct</b> on behalf of {name}.</span>
                                        </label>
                                        <button
                                            type="button" onClick={signWaiver} disabled={signing || !waiverName.trim() || !waiverAgree}
                                            className="px-4 py-2 rounded-lg font-bold text-sm text-brand-dark bg-brand-green hover:bg-white disabled:opacity-40"
                                        >
                                            {signing ? 'Signing…' : 'Sign electronically'}
                                        </button>
                                        <p className="text-[11px] text-gray-500">Your typed name + today's date is recorded as your electronic signature and sent to the club.</p>
                                    </div>
                                )}
                                {item.key === 'waiver' && item.done && (
                                    <p className="text-[11px] text-brand-green mt-1 pl-9">✓ Signed electronically — thank you.</p>
                                )}

                                {item.hint && !item.done && item.key !== 'deposit' && item.key !== 'waiver' && (
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
