import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { isStaff as isStaffRole } from '../constants/roles';
import { useClubSubscription } from '../hooks/useClubSubscription';

const money = (c, cur = 'usd') => new Intl.NumberFormat('en-US', { style: 'currency', currency: (cur || 'usd').toUpperCase() }).format((c || 0) / 100);
const FIELD = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-brand-green focus:outline-none text-sm';

// Club admin hub: platform subscription, Stripe Connect (get paid), registration
// programs, and incoming registrations. Staff only.
export default function ClubBilling() {
    const { profile } = useAuth();
    const brand = useBranding();
    const navigate = useNavigate();
    const { orgId, active } = useClubSubscription(profile);
    const isStaff = isStaffRole(profile?.role);

    const [connect, setConnect] = useState(null);
    const [programs, setPrograms] = useState([]);
    const [regs, setRegs] = useState([]);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        if (!orgId) return;
        const [{ data: cs }, { data: progs }, { data: rs }] = await Promise.all([
            supabase.functions.invoke('connect-status', { body: { orgId } }).then((r) => ({ data: r.data })).catch(() => ({ data: null })),
            supabase.from('registration_programs').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
            supabase.from('registrations').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(100),
        ]);
        setConnect(cs); setPrograms(progs || []); setRegs(rs || []);
    }, [orgId]);
    useEffect(() => { load(); }, [load]);

    const call = async (fn, label) => {
        setBusy(label); setError('');
        try {
            const { data, error } = await supabase.functions.invoke(fn, { body: { orgId } });
            if (error) { let m = error.message; try { const c = await error.context?.json?.(); if (c?.error) m = c.error; } catch { /* ignore */ } throw new Error(m); }
            if (data?.error) throw new Error(data.error);
            if (data?.url) { window.location.href = data.url; return; }
        } catch (e) { setError(e.message); }
        setBusy('');
    };

    if (!isStaff) return <div className="min-h-screen bg-brand-dark flex items-center justify-center text-gray-400">Staff only.</div>;

    const chargesReady = connect?.charges_enabled;

    return (
        <div className="min-h-screen bg-brand-dark text-white py-6 px-4">
            <div className="max-w-3xl mx-auto space-y-5">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-display font-bold uppercase tracking-wider">Billing & Registration</h1>
                    <button onClick={() => navigate('/dashboard')} className="text-sm text-gray-400 hover:text-white underline">← Dashboard</button>
                </div>
                {error && <div className="text-sm text-red-400">{error}</div>}

                {/* Platform subscription (Flow A) */}
                <Card title="Platform subscription">
                    <p className="text-sm text-gray-300 mb-3">
                        Status: <span className={active ? 'text-green-400' : 'text-brand-gold'}>{active ? 'Active' : 'Inactive'}</span>
                    </p>
                    <button onClick={() => call('club-billing-portal', 'portal')} disabled={busy === 'portal'} className="text-sm px-4 py-2 rounded bg-white/10 hover:bg-white/20 disabled:opacity-60">
                        {busy === 'portal' ? 'Opening…' : 'Manage billing'}
                    </button>
                </Card>

                {/* Stripe Connect (Flow B — get paid) */}
                <Card title="Get paid (Stripe)">
                    {chargesReady ? (
                        <p className="text-sm text-green-400">✓ Connected — your club can accept registration payments. Payouts go to your bank.</p>
                    ) : (
                        <>
                            <p className="text-sm text-gray-300 mb-3">
                                Connect your club's Stripe account so registration payments land in <em>your</em> bank.
                                {connect?.connected && !chargesReady && ' Setup is started but not finished.'}
                            </p>
                            <button onClick={() => call('connect-onboard', 'connect')} disabled={busy === 'connect'} className="btn-primary text-sm">
                                {busy === 'connect' ? 'Opening…' : connect?.connected ? 'Finish Stripe setup' : 'Connect Stripe'}
                            </button>
                        </>
                    )}
                </Card>

                {/* Programs */}
                <Card title="Registration programs">
                    <ProgramForm orgId={orgId} onCreated={load} disabled={!chargesReady} />
                    <div className="mt-4 space-y-2">
                        {programs.length === 0 && <p className="text-sm text-gray-500">No programs yet.</p>}
                        {programs.map((p) => (
                            <div key={p.id} className="flex justify-between items-center bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm">
                                <div><span className="font-semibold">{p.name}</span> {p.age_group && <span className="text-gray-400">· {p.age_group}</span>}
                                    <span className={`ml-2 text-[10px] uppercase px-1.5 py-0.5 rounded ${p.active ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-gray-400'}`}>{p.active ? 'open' : 'closed'}</span></div>
                                <div className="text-right">{money(p.price_cents, p.currency)} <span className="text-gray-500 text-xs">{p.billing_type.replace('_', '-')}</span></div>
                            </div>
                        ))}
                    </div>
                    {chargesReady && brand.slug && (
                        <p className="text-[11px] text-gray-500 mt-3">Share your public registration link: <span className="text-brand-green">{window.location.origin}/register?club={brand.slug}</span></p>
                    )}
                </Card>

                {/* Registrations */}
                <Card title={`Registrations (${regs.length})`}>
                    {regs.length === 0 && <p className="text-sm text-gray-500">No registrations yet.</p>}
                    {regs.length > 0 && (
                        <div className="space-y-1">
                            {regs.map((r) => (
                                <div key={r.id} className="flex justify-between items-center bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm">
                                    <div><span className="font-semibold">{r.player_first_name} {r.player_last_name}</span>
                                        <span className="text-gray-400 text-xs ml-2">{r.guardian_name} · {r.guardian_email}</span></div>
                                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded ${['paid', 'active', 'approved'].includes(r.status) ? 'bg-green-500/20 text-green-300' : r.status === 'pending' ? 'bg-white/10 text-gray-400' : 'bg-brand-gold/20 text-brand-gold'}`}>{r.status}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}

function ProgramForm({ orgId, onCreated, disabled }) {
    const [f, setF] = useState({ name: '', price: '', billing_type: 'one_time', age_group: '', season: '', capacity: '', waiver_text: '' });
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

    const create = async () => {
        setErr('');
        if (!f.name || !f.price) return setErr('Name and price are required.');
        setSaving(true);
        const { error } = await supabase.from('registration_programs').insert({
            org_id: orgId, name: f.name, price_cents: Math.round(parseFloat(f.price) * 100),
            billing_type: f.billing_type, age_group: f.age_group || null, season: f.season || null,
            capacity: f.capacity ? parseInt(f.capacity, 10) : null, waiver_text: f.waiver_text || null,
        });
        setSaving(false);
        if (error) return setErr(error.message);
        setF({ name: '', price: '', billing_type: 'one_time', age_group: '', season: '', capacity: '', waiver_text: '' });
        onCreated();
    };

    return (
        <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">New program</div>
            {disabled && <p className="text-[11px] text-brand-gold mb-2">Connect Stripe first to collect payments.</p>}
            <div className="grid grid-cols-2 gap-2">
                <input className={FIELD} placeholder="Name (e.g. Summer 2026)" value={f.name} onChange={set('name')} />
                <input className={FIELD} placeholder="Price (USD)" value={f.price} onChange={set('price')} />
                <select className={FIELD} value={f.billing_type} onChange={set('billing_type')}>
                    <option value="one_time">One-time</option><option value="monthly">Monthly</option><option value="annual">Annual</option>
                </select>
                <input className={FIELD} placeholder="Age group (U10)" value={f.age_group} onChange={set('age_group')} />
                <input className={FIELD} placeholder="Season" value={f.season} onChange={set('season')} />
                <input className={FIELD} placeholder="Capacity (optional)" value={f.capacity} onChange={set('capacity')} />
            </div>
            <textarea className={`${FIELD} mt-2`} rows={2} placeholder="Waiver text (optional — families type their name to sign)" value={f.waiver_text} onChange={set('waiver_text')} />
            {err && <div className="text-xs text-red-400 mt-1">{err}</div>}
            <button onClick={create} disabled={saving} className="mt-2 text-sm px-4 py-2 rounded bg-brand-green text-brand-dark font-bold disabled:opacity-60">
                {saving ? 'Saving…' : 'Create program'}
            </button>
        </div>
    );
}

const Card = ({ title, children }) => (
    <div className="glass-panel p-4">
        <div className="text-sm font-display uppercase tracking-wider text-brand-green mb-3">{title}</div>
        {children}
    </div>
);
