import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

// Platform Owner dashboard — ALL clubs + global settings + per-club fee/comp
// controls. Data + mutations come from is_platform_owner()-gated RPCs, so this is
// safe even though it's just a route: a non-owner gets "not authorized" and no data.
const FIELD = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-brand-green focus:outline-none text-sm';
const money = (c) => `$${((c || 0) / 100).toFixed(2)}`;

export default function PlatformAdmin() {
    const navigate = useNavigate();
    const [clubs, setClubs] = useState(null);
    const [settings, setSettings] = useState(null);
    const [authorized, setAuthorized] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        const [{ data: rows, error: e1 }, { data: s, error: e2 }] = await Promise.all([
            supabase.rpc('platform_admin_overview'),
            supabase.rpc('platform_settings_read'),
        ]);
        if (e1 || e2) { setAuthorized(false); return; }
        setAuthorized(true);
        setClubs(rows || []);
        setSettings(Array.isArray(s) ? s[0] : s);
    }, []);
    useEffect(() => { load(); }, [load]);

    const rpc = async (fn, args) => {
        setError('');
        const { error } = await supabase.rpc(fn, args);
        if (error) { setError(error.message); return; }
        await load();
    };

    if (!authorized) {
        return <Center>Not authorized. This area is for the platform owner only.</Center>;
    }
    if (clubs === null) return <Center>Loading…</Center>;

    const paying = clubs.filter((c) => c.active && !c.comped).length;
    const comped = clubs.filter((c) => c.comped).length;
    const connected = clubs.filter((c) => c.charges_enabled).length;

    return (
        <div className="min-h-screen bg-brand-dark text-white py-6 px-4">
            <div className="max-w-5xl mx-auto space-y-5">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-display font-bold uppercase tracking-wider">Platform Admin</h1>
                    <button onClick={() => navigate('/dashboard')} className="text-sm text-gray-400 hover:text-white underline">← Dashboard</button>
                </div>
                {error && <div className="text-sm text-red-400">{error}</div>}

                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Stat label="Clubs" value={clubs.length} />
                    <Stat label="Paying" value={paying} accent />
                    <Stat label="Comped" value={comped} />
                    <Stat label="Stripe-connected" value={connected} />
                </div>
                <p className="text-[11px] text-gray-500 -mt-2">Actual revenue, payouts and collected fees live in your Stripe Dashboard. This is the club/config console.</p>

                {/* Global settings */}
                {settings && <GlobalSettings settings={settings} onSave={(a) => rpc('platform_update_settings', a)} />}

                {/* Clubs */}
                <div className="glass-panel p-4">
                    <div className="text-sm font-display uppercase tracking-wider text-brand-green mb-3">All clubs</div>
                    <div className="space-y-2">
                        {clubs.map((c) => (
                            <ClubRow key={c.org_id} c={c}
                                onComp={(v) => rpc('platform_set_comped', { p_org_id: c.org_id, p_comped: v })}
                                onFee={(enabled, percent, flat) => rpc('platform_set_org_fee', { p_org_id: c.org_id, p_enabled: enabled, p_percent: percent, p_flat_cents: flat })} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function GlobalSettings({ settings, onSave }) {
    const [pct, setPct] = useState(String(settings.default_fee_percent ?? ''));
    const [flat, setFlat] = useState(String(((settings.default_fee_flat_cents ?? 0) / 100)));
    const [trial, setTrial] = useState(String(settings.trial_days ?? ''));
    const [saving, setSaving] = useState(false);
    const save = async () => {
        setSaving(true);
        await onSave({ p_fee_percent: parseFloat(pct) || 0, p_fee_flat_cents: Math.round((parseFloat(flat) || 0) * 100), p_trial_days: parseInt(trial, 10) || 0 });
        setSaving(false);
    };
    return (
        <div className="glass-panel p-4">
            <div className="text-sm font-display uppercase tracking-wider text-brand-green mb-3">Global defaults</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <label className="text-xs text-gray-400">Default platform fee %
                    <input className={`${FIELD} w-full mt-1`} value={pct} onChange={(e) => setPct(e.target.value)} /></label>
                <label className="text-xs text-gray-400">+ flat fee ($)
                    <input className={`${FIELD} w-full mt-1`} value={flat} onChange={(e) => setFlat(e.target.value)} /></label>
                <label className="text-xs text-gray-400">Free trial (days)
                    <input className={`${FIELD} w-full mt-1`} value={trial} onChange={(e) => setTrial(e.target.value)} /></label>
            </div>
            <button onClick={save} disabled={saving} className="mt-3 text-sm px-4 py-2 rounded bg-brand-green text-brand-dark font-bold disabled:opacity-60">
                {saving ? 'Saving…' : 'Save defaults'}
            </button>
            <p className="text-[11px] text-gray-500 mt-2">Applies to any club without its own fee override below. Club plan prices: monthly {settings.club_monthly_price_id ? '✓' : '—'} · annual {settings.club_annual_price_id ? '✓' : '—'} (edit amounts in Stripe).</p>
        </div>
    );
}

function ClubRow({ c, onComp, onFee }) {
    const [open, setOpen] = useState(false);
    const [enabled, setEnabled] = useState(c.fee_enabled);
    const [pct, setPct] = useState(c.fee_percent != null ? String(c.fee_percent) : '');
    const [flat, setFlat] = useState(c.fee_flat_cents != null ? String(c.fee_flat_cents / 100) : '');

    return (
        <div className="bg-white/5 border border-white/10 rounded-lg">
            <div className="flex items-center gap-3 px-3 py-2 text-sm">
                <div className="flex-1 min-w-0">
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-gray-500 text-xs ml-2">/{c.slug}</span>
                    <div className="text-[11px] text-gray-400">{c.players} players · {c.teams} teams</div>
                </div>
                <Badge ok={c.active} text={c.comped ? 'comped' : c.active ? (c.sub_status || 'active') : 'inactive'} />
                <Badge ok={c.charges_enabled} text={c.charges_enabled ? 'stripe ✓' : 'no stripe'} />
                <div className="text-xs text-gray-300 w-16 text-right">{c.fee_enabled ? `${Number(c.effective_fee_percent)}%` : 'no fee'}</div>
                <button onClick={() => setOpen(!open)} className="text-[11px] px-2 py-1 rounded bg-white/10 hover:bg-white/20">{open ? 'Close' : 'Manage'}</button>
            </div>
            {open && (
                <div className="border-t border-white/10 px-3 py-3 space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                        <span className="text-gray-400">Comped (free access):</span>
                        <button onClick={() => onComp(!c.comped)} className={`text-xs px-3 py-1 rounded font-bold ${c.comped ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-gray-300'}`}>
                            {c.comped ? 'ON — click to charge' : 'OFF — click to comp'}
                        </button>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                        <label className="text-xs text-gray-400 flex items-center gap-2 mb-1">
                            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Charge a platform fee
                        </label>
                        <label className="text-xs text-gray-400">Fee %
                            <input className={`${FIELD} w-20 block mt-1`} value={pct} onChange={(e) => setPct(e.target.value)} placeholder="default" disabled={!enabled} /></label>
                        <label className="text-xs text-gray-400">+ flat ($)
                            <input className={`${FIELD} w-20 block mt-1`} value={flat} onChange={(e) => setFlat(e.target.value)} placeholder="0" disabled={!enabled} /></label>
                        <button onClick={() => onFee(enabled, pct === '' ? null : parseFloat(pct), flat === '' ? 0 : Math.round(parseFloat(flat) * 100))}
                            className="text-xs px-3 py-2 rounded bg-brand-green text-brand-dark font-bold">Save fee</button>
                    </div>
                    <p className="text-[11px] text-gray-500">Leave Fee % blank to use the global default ({c.fee_enabled ? `currently ${Number(c.effective_fee_percent)}%` : 'off'}). Turn the checkbox off to take no fee from this club.</p>
                </div>
            )}
        </div>
    );
}

const Center = ({ children }) => (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center text-gray-400 px-6 text-center">{children}</div>
);
const Stat = ({ label, value, accent }) => (
    <div className="glass-panel p-3 text-center">
        <div className={`text-2xl font-display font-bold ${accent ? 'text-brand-green' : 'text-white'}`}>{value}</div>
        <div className="text-[11px] uppercase tracking-wider text-gray-400">{label}</div>
    </div>
);
const Badge = ({ ok, text }) => (
    <span className={`text-[10px] uppercase px-2 py-0.5 rounded ${ok ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-gray-400'}`}>{text}</span>
);
