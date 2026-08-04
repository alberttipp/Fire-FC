import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, Plus, Pencil, Trash2, Loader2, Megaphone } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

// Platform Owner dashboard — ALL clubs + global settings + per-club fee/comp
// controls. Data + mutations come from is_platform_owner()-gated RPCs, so this is
// safe even though it's just a route: a non-owner gets "not authorized" and no data.
const FIELD = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-brand-green focus:outline-none text-sm';
const money = (c) => `$${((c || 0) / 100).toFixed(2)}`;

export default function PlatformAdmin() {
    const navigate = useNavigate();
    const { signOut } = useAuth();
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

    const logout = async () => {
        try { await signOut(); } catch { /* ignore */ }
        navigate('/login');
    };

    if (!authorized) {
        return (
            <Center>
                <div className="space-y-4">
                    <p>Not authorized. This area is for the platform owner only.</p>
                    <div className="flex items-center justify-center gap-2">
                        <button onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-1.5 text-sm font-semibold bg-white/10 hover:bg-white/20 text-white rounded-lg px-3 py-2">
                            <LayoutDashboard className="w-4 h-4" /> Exit to app
                        </button>
                        <button onClick={logout}
                            className="flex items-center gap-1.5 text-sm font-semibold bg-red-500/15 hover:bg-red-500/25 text-red-300 rounded-lg px-3 py-2">
                            <LogOut className="w-4 h-4" /> Log out
                        </button>
                    </div>
                </div>
            </Center>
        );
    }
    if (clubs === null) return <Center>Loading…</Center>;

    const paying = clubs.filter((c) => c.active && !c.comped).length;
    const comped = clubs.filter((c) => c.comped).length;
    const connected = clubs.filter((c) => c.charges_enabled).length;

    return (
        <div className="min-h-screen bg-brand-dark text-white py-6 px-4">
            <div className="max-w-5xl mx-auto space-y-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h1 className="text-2xl font-display font-bold uppercase tracking-wider">Platform Admin</h1>
                    <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-1.5 text-sm font-semibold bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2">
                            <LayoutDashboard className="w-4 h-4" /> Exit to app
                        </button>
                        <button onClick={logout}
                            className="flex items-center gap-1.5 text-sm font-semibold bg-red-500/15 hover:bg-red-500/25 text-red-300 rounded-lg px-3 py-2">
                            <LogOut className="w-4 h-4" /> Log out
                        </button>
                    </div>
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

                {/* Network sponsors — owner-sold, revenue to 815YouthSports */}
                <NetworkSponsors />
            </div>
        </div>
    );
}

function GlobalSettings({ settings, onSave }) {
    const [pct, setPct] = useState(String(settings.default_fee_percent ?? ''));
    const [flat, setFlat] = useState(String(((settings.default_fee_flat_cents ?? 0) / 100)));
    const [trial, setTrial] = useState(String(settings.trial_days ?? ''));
    const [minTeams, setMinTeams] = useState(String(settings.min_teams ?? 1));
    const [saving, setSaving] = useState(false);
    const save = async () => {
        setSaving(true);
        await onSave({ p_fee_percent: parseFloat(pct) || 0, p_fee_flat_cents: Math.round((parseFloat(flat) || 0) * 100), p_trial_days: parseInt(trial, 10) || 0, p_min_teams: parseInt(minTeams, 10) || 1 });
        setSaving(false);
    };
    return (
        <div className="glass-panel p-4">
            <div className="text-sm font-display uppercase tracking-wider text-brand-green mb-3">Global defaults</div>
            <div className="mb-3 text-xs text-gray-400 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                Software plan: <span className="text-white">{money(settings.per_team_cents)}/team/month</span> (annual = {money((settings.per_team_cents || 0) * 10)}/team, 2 months free). Change the amount in Stripe; adjust the team minimum below.
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <label className="text-xs text-gray-400">Default fee %
                    <input className={`${FIELD} w-full mt-1`} value={pct} onChange={(e) => setPct(e.target.value)} /></label>
                <label className="text-xs text-gray-400">+ flat fee ($)
                    <input className={`${FIELD} w-full mt-1`} value={flat} onChange={(e) => setFlat(e.target.value)} /></label>
                <label className="text-xs text-gray-400">Team minimum
                    <input className={`${FIELD} w-full mt-1`} value={minTeams} onChange={(e) => setMinTeams(e.target.value)} /></label>
                <label className="text-xs text-gray-400">Free trial (days)
                    <input className={`${FIELD} w-full mt-1`} value={trial} onChange={(e) => setTrial(e.target.value)} /></label>
            </div>
            <button onClick={save} disabled={saving} className="mt-3 text-sm px-4 py-2 rounded bg-brand-green text-brand-dark font-bold disabled:opacity-60">
                {saving ? 'Saving…' : 'Save defaults'}
            </button>
            <p className="text-[11px] text-gray-500 mt-2">Fee/flat apply to any club without its own override below. Team minimum = the fewest teams a club is billed for.</p>
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

const BLANK_NET = { name: '', logo_url: '', link_url: '', blurb: '', all_clubs: true, amount: '', starts_on: '', ends_on: '', active: true, orgIds: [] };

function NetworkSponsors() {
    const [rows, setRows] = useState(null);
    const [orgs, setOrgs] = useState([]);
    const [editing, setEditing] = useState(null); // sponsor obj (with orgIds) | null
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [err, setErr] = useState('');

    const load = async () => {
        const [{ data: ns }, { data: o }] = await Promise.all([
            supabase.from('network_sponsors').select('*').order('created_at', { ascending: false }),
            supabase.from('organizations').select('id, name, slug, network_sponsors_enabled').is('deleted_at', null).order('name'),
        ]);
        setRows(ns || []);
        setOrgs(o || []);
    };
    useEffect(() => { load(); }, []);

    const openEdit = async (s) => {
        let orgIds = [];
        if (s?.id && !s.all_clubs) {
            const { data } = await supabase.from('network_sponsor_orgs').select('org_id').eq('network_sponsor_id', s.id);
            orgIds = (data || []).map((r) => r.org_id);
        }
        setEditing(s ? { ...s, amount: s.amount_cents != null ? String(s.amount_cents / 100) : '', starts_on: s.starts_on || '', ends_on: s.ends_on || '', orgIds } : { ...BLANK_NET });
    };

    const uploadLogo = async (file) => {
        if (!file) return;
        if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) { setErr('Use PNG/JPG/WEBP/SVG.'); return; }
        if (file.size > 1024 * 1024) { setErr('Logo must be under 1MB.'); return; }
        setUploading(true); setErr('');
        try {
            const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/svg+xml' ? 'svg' : file.type.split('/')[1];
            const path = `network/${crypto.randomUUID()}.${ext}`;
            const { error } = await supabase.storage.from('media').upload(path, file, { contentType: file.type, upsert: true });
            if (error) throw error;
            const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
            setEditing((e) => ({ ...e, logo_url: publicUrl }));
        } catch (e) { setErr(`Upload failed: ${e.message}`); } finally { setUploading(false); }
    };

    const save = async () => {
        if (!editing.name.trim()) { setErr('Name is required.'); return; }
        setSaving(true); setErr('');
        try {
            const payload = {
                name: editing.name.trim(), logo_url: editing.logo_url?.trim() || null, link_url: editing.link_url?.trim() || null,
                blurb: editing.blurb?.trim() || null, all_clubs: !!editing.all_clubs,
                amount_cents: editing.amount === '' ? null : Math.round(parseFloat(editing.amount) * 100),
                starts_on: editing.starts_on || null, ends_on: editing.ends_on || null, active: editing.active !== false,
            };
            let id = editing.id;
            if (id) { const { error } = await supabase.from('network_sponsors').update(payload).eq('id', id); if (error) throw error; }
            else { const { data, error } = await supabase.from('network_sponsors').insert(payload).select('id').single(); if (error) throw error; id = data.id; }
            // Sync targeted clubs.
            await supabase.from('network_sponsor_orgs').delete().eq('network_sponsor_id', id);
            if (!payload.all_clubs && editing.orgIds.length) {
                await supabase.from('network_sponsor_orgs').insert(editing.orgIds.map((org_id) => ({ network_sponsor_id: id, org_id })));
            }
            setEditing(null); await load();
        } catch (e) { setErr(e.message?.includes('policy') ? 'Owner only.' : `Save failed: ${e.message}`); } finally { setSaving(false); }
    };

    const remove = async (id) => {
        if (!window.confirm('Remove this network sponsor?')) return;
        const { error } = await supabase.from('network_sponsors').delete().eq('id', id);
        if (error) { setErr('Delete failed.'); return; }
        await load();
    };

    const toggleOrg = async (org) => {
        const { error } = await supabase.rpc('platform_set_network_enabled', { p_org_id: org.id, p_enabled: !org.network_sponsors_enabled });
        if (!error) setOrgs((prev) => prev.map((o) => o.id === org.id ? { ...o, network_sponsors_enabled: !o.network_sponsors_enabled } : o));
    };

    return (
        <div className="glass-panel p-4">
            <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-display uppercase tracking-wider text-brand-green flex items-center gap-2"><Megaphone className="w-4 h-4" /> Network sponsors</div>
                {!editing && <button onClick={() => openEdit(null)} className="flex items-center gap-1 text-xs text-brand-gold hover:text-brand-gold/80"><Plus className="w-3.5 h-3.5" /> Add</button>}
            </div>
            <p className="text-[11px] text-gray-500 mb-3">Sponsors YOU sell — revenue to 815YouthSports. They show in the reserved "Powered by" strip across clubs (never in a club's own tiers). Payment is handled directly (invoice); amount is for your records.</p>
            {err && <div className="text-xs text-red-400 mb-2">{err}</div>}

            {editing ? (
                <div className="space-y-3 bg-white/5 border border-white/10 rounded-lg p-3">
                    <div className="grid grid-cols-2 gap-3">
                        <label className="text-xs text-gray-400">Sponsor name<input className={`${FIELD} w-full mt-1`} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
                        <label className="text-xs text-gray-400">Website link<input className={`${FIELD} w-full mt-1`} value={editing.link_url} onChange={(e) => setEditing({ ...editing, link_url: e.target.value })} placeholder="https://" /></label>
                    </div>
                    <div className="flex items-center gap-3">
                        {editing.logo_url ? <img src={editing.logo_url} alt="logo" className="h-10 object-contain bg-white/10 rounded p-1" /> : <div className="h-10 w-10 rounded bg-white/5 border border-white/10" />}
                        <label className="text-xs bg-white/10 hover:bg-white/20 rounded px-3 py-2 cursor-pointer flex items-center gap-1.5">
                            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {editing.logo_url ? 'Replace logo' : 'Upload logo'}
                            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { uploadLogo(e.target.files?.[0]); e.target.value = ''; }} />
                        </label>
                    </div>
                    <label className="text-xs text-gray-400 block">Blurb (logo + link only — keep it a neutral "qualified sponsorship" for the charity)<input className={`${FIELD} w-full mt-1`} value={editing.blurb} onChange={(e) => setEditing({ ...editing, blurb: e.target.value })} /></label>
                    <div className="grid grid-cols-3 gap-3">
                        <label className="text-xs text-gray-400">Amount charged ($)<input className={`${FIELD} w-full mt-1`} value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} placeholder="0" /></label>
                        <label className="text-xs text-gray-400">Start date<input type="date" className={`${FIELD} w-full mt-1`} value={editing.starts_on} onChange={(e) => setEditing({ ...editing, starts_on: e.target.value })} /></label>
                        <label className="text-xs text-gray-400">End date<input type="date" className={`${FIELD} w-full mt-1`} value={editing.ends_on} onChange={(e) => setEditing({ ...editing, ends_on: e.target.value })} /></label>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <label className="text-xs text-gray-300 flex items-center gap-2"><input type="checkbox" checked={editing.active !== false} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Active</label>
                        <label className="text-xs text-gray-300 flex items-center gap-2"><input type="checkbox" checked={!!editing.all_clubs} onChange={(e) => setEditing({ ...editing, all_clubs: e.target.checked })} /> Show in all clubs</label>
                    </div>
                    {!editing.all_clubs && (
                        <div className="text-xs text-gray-400">
                            <div className="mb-1">Show only in these clubs:</div>
                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                {orgs.map((o) => {
                                    const on = editing.orgIds.includes(o.id);
                                    return <button key={o.id} type="button" onClick={() => setEditing({ ...editing, orgIds: on ? editing.orgIds.filter((x) => x !== o.id) : [...editing.orgIds, o.id] })}
                                        className={`px-2 py-1 rounded border text-[11px] ${on ? 'border-brand-green bg-brand-green/15 text-white' : 'border-white/10 bg-white/5 text-gray-400'}`}>{o.name}</button>;
                                })}
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-3">
                        <button onClick={save} disabled={saving} className="text-sm px-4 py-2 rounded bg-brand-green text-brand-dark font-bold disabled:opacity-60">{saving ? 'Saving…' : 'Save sponsor'}</button>
                        <button onClick={() => setEditing(null)} className="text-sm text-gray-400 hover:text-white">Cancel</button>
                    </div>
                </div>
            ) : rows == null ? (
                <div className="flex justify-center py-6 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : rows.length === 0 ? (
                <p className="text-xs text-gray-600">No network sponsors yet.</p>
            ) : (
                <div className="space-y-2">
                    {rows.map((s) => (
                        <div key={s.id} className={`flex items-center gap-3 rounded-lg border p-2.5 ${s.active ? 'border-white/10 bg-white/[0.03]' : 'border-white/5 bg-white/[0.02] opacity-60'}`}>
                            {s.logo_url ? <img src={s.logo_url} alt={s.name} className="h-8 w-8 object-contain rounded bg-white/5" /> : <div className="h-8 w-8 rounded bg-white/5" />}
                            <div className="flex-1 min-w-0">
                                <div className="text-white text-sm font-semibold truncate">{s.name}{!s.active && <span className="text-gray-500 font-normal"> · off</span>}</div>
                                <div className="text-[11px] text-gray-500">{s.all_clubs ? 'all clubs' : 'selected clubs'}{s.amount_cents != null ? ` · ${money(s.amount_cents)}` : ''}{s.ends_on ? ` · ends ${s.ends_on}` : ''}</div>
                            </div>
                            <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-white"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => remove(s.id)} className="p-1.5 text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    ))}
                </div>
            )}

            {/* Per-club opt-out */}
            {!editing && orgs.length > 0 && (
                <div className="mt-4 border-t border-white/10 pt-3">
                    <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">Club visibility (turn off for Premium / white-label)</div>
                    <div className="flex flex-wrap gap-2">
                        {orgs.map((o) => (
                            <button key={o.id} onClick={() => toggleOrg(o)}
                                className={`px-2.5 py-1 rounded border text-[11px] ${o.network_sponsors_enabled ? 'border-brand-green/40 bg-brand-green/10 text-green-300' : 'border-white/10 bg-white/5 text-gray-500'}`}>
                                {o.name}: {o.network_sponsors_enabled ? 'on' : 'off'}
                            </button>
                        ))}
                    </div>
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
