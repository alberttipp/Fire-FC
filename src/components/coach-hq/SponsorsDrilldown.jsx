import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Loader2, Trash2, Star, Award, Users, Pencil, Share2, Copy, DollarSign } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import { useSponsors } from '../../context/SponsorContext';

// Coach HQ → Sponsors. Two tabs:
//  • "Wall" — add a sponsor in ~60s (name, tier, logo, link); staff-entered = free.
//  • "Sell" — publish sponsorship packages so businesses buy online (share link +
//    QR → /sponsor?club=slug); the platform fee is taken automatically.
// Writes go through RLS (staff-only).
const TIERS = [
    { value: 'title',     label: 'Title',     icon: Star,  desc: 'Your #1 sponsor — logo on the app front door, dashboards & game-day announcements.' },
    { value: 'premier',   label: 'Premier',   icon: Award, desc: 'Logo on dashboard feeds, event pages & weekly digests.' },
    { value: 'community', label: 'Community', icon: Users, desc: 'Logo in the footer, About page & tryout confirmation.' },
];
const BLANK = { name: '', tier: 'community', logo_url: '', link_url: '', blurb: '', active: true };
const BLANK_PKG = { tier: 'community', name: '', price_cents: 30000, billing_type: 'annual', max_active: null, description: '', benefits: [], active: true };
// Seeded defaults the club can edit — real inventory before they sell it.
const DEFAULT_PKGS = [
    { tier: 'community', name: 'Community Sponsor', price_cents: 30000,  billing_type: 'annual', max_active: null, sort_order: 3, description: 'Support the club and get your logo in front of every family.', benefits: ['Logo in the app footer & About page'] },
    { tier: 'premier',   name: 'Premier Sponsor',  price_cents: 75000,  billing_type: 'annual', max_active: 4,    sort_order: 2, description: 'Prominent placement across the app all season.', benefits: ['Logo on dashboards, schedule & event pages', 'Recognition in the weekly digest'] },
    { tier: 'title',     name: 'Title Sponsor',    price_cents: 150000, billing_type: 'annual', max_active: 1,    sort_order: 1, description: 'Top billing — your brand is the face of the club.', benefits: ['Top logo on the app front door & every dashboard', 'Game-day & live-score recognition', 'Season shout-out to all families'] },
];
const money = (cents, cur = 'usd') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: (cur || 'usd').toUpperCase() }).format((cents || 0) / 100);

const SponsorsDrilldown = ({ teamId, onClose }) => {
    const { user } = useAuth();
    const toast = useToast();
    const { reload } = useSponsors();
    const [orgId, setOrgId] = useState(null);
    const [slug, setSlug] = useState(null);
    const [view, setView] = useState('wall'); // 'wall' | 'sell'
    const [rows, setRows] = useState(null);
    const [editing, setEditing] = useState(null); // sponsor object (existing or BLANK) | null
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [showUrl, setShowUrl] = useState(false);
    const [pkgs, setPkgs] = useState(null); // sponsorship_packages | null (loading)
    const [editingPkg, setEditingPkg] = useState(null); // package object | null
    const [savingPkg, setSavingPkg] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const sponsorUrl = slug ? `${window.location.origin}/sponsor?club=${slug}` : '';

    // Upload a logo image to storage (reliable) instead of relying on a pasted URL
    // (external URLs often fail to render — hotlink/CORS/not-a-direct-image).
    const uploadLogo = async (file) => {
        if (!file) return;
        if (!orgId) { toast.error('No club found for this team.'); return; }
        const okTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
        if (!okTypes.includes(file.type)) { toast.error('Use a PNG, JPG, WEBP or SVG image.'); return; }
        if (file.size > 1024 * 1024) { toast.error('Logo must be under 1MB.'); return; }
        setUploading(true);
        try {
            const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/svg+xml' ? 'svg' : file.type.split('/')[1];
            const path = `sponsors/${orgId}/${crypto.randomUUID()}.${ext}`;
            const { error: upErr } = await supabase.storage.from('media').upload(path, file, { contentType: file.type, upsert: true });
            if (upErr) throw upErr;
            const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
            setEditing((e) => ({ ...e, logo_url: publicUrl }));
            toast.success('Logo uploaded.');
        } catch (e) {
            toast.error(`Upload failed: ${e.message}`);
        } finally { setUploading(false); }
    };

    const load = useCallback(async () => {
        if (!teamId) return;
        const { data: team } = await supabase.from('teams').select('org_id').eq('id', teamId).maybeSingle();
        const oid = team?.org_id || null;
        setOrgId(oid);
        if (oid) {
            const { data: org } = await supabase.from('organizations').select('slug').eq('id', oid).maybeSingle();
            setSlug(org?.slug || null);
        }
        const { data } = await supabase.from('sponsors').select('*').order('tier').order('sort_order');
        setRows(data || []);
        const { data: p } = await supabase.from('sponsorship_packages').select('*').order('sort_order');
        setPkgs(p || []);
    }, [teamId]);
    useEffect(() => { load(); }, [load]);

    const seedDefaults = async () => {
        if (!orgId) { toast.error('No club found for this team.'); return; }
        setSeeding(true);
        try {
            const { error } = await supabase.from('sponsorship_packages')
                .insert(DEFAULT_PKGS.map((p) => ({ ...p, org_id: orgId })));
            if (error) throw error;
            toast.success('Starter packages added — edit prices anytime.');
            await load();
        } catch (e) {
            toast.error(e.message?.includes('policy') ? "You don't have permission to manage packages." : `Failed: ${e.message}`);
        } finally { setSeeding(false); }
    };

    const savePkg = async () => {
        if (!editingPkg?.name?.trim()) { toast.error('Package name is required.'); return; }
        if (!orgId) { toast.error('No club found for this team.'); return; }
        const cents = Math.round(Number(editingPkg.price_cents) || 0);
        if (cents < 100) { toast.error('Price must be at least $1.'); return; }
        setSavingPkg(true);
        try {
            const payload = {
                org_id: orgId, tier: editingPkg.tier, name: editingPkg.name.trim(),
                price_cents: cents, billing_type: editingPkg.billing_type,
                max_active: editingPkg.max_active === '' || editingPkg.max_active == null ? null : Number(editingPkg.max_active),
                description: editingPkg.description?.trim() || null,
                benefits: (editingPkg.benefits || []).map((b) => b.trim()).filter(Boolean),
                active: editingPkg.active !== false,
            };
            let error;
            if (editingPkg.id) ({ error } = await supabase.from('sponsorship_packages').update(payload).eq('id', editingPkg.id));
            else ({ error } = await supabase.from('sponsorship_packages').insert(payload));
            if (error) throw error;
            toast.success('Package saved.');
            setEditingPkg(null);
            await load();
        } catch (e) {
            toast.error(e.message?.includes('policy') ? "You don't have permission to manage packages." : `Save failed: ${e.message}`);
        } finally { setSavingPkg(false); }
    };

    const removePkg = async (id) => {
        if (!window.confirm('Remove this package? Existing sponsors keep their spot.')) return;
        const { error } = await supabase.from('sponsorship_packages').delete().eq('id', id);
        if (error) { toast.error('Delete failed.'); return; }
        await load();
    };

    const copyLink = async () => {
        try { await navigator.clipboard.writeText(sponsorUrl); toast.success('Link copied.'); }
        catch { toast.error('Could not copy — long-press the link to copy.'); }
    };

    const save = async () => {
        if (!editing?.name?.trim()) { toast.error('Sponsor name is required.'); return; }
        if (!orgId) { toast.error('No club found for this team.'); return; }
        setSaving(true);
        try {
            const payload = {
                org_id: orgId, name: editing.name.trim(), tier: editing.tier,
                logo_url: editing.logo_url?.trim() || null, link_url: editing.link_url?.trim() || null,
                blurb: editing.blurb?.trim() || null, active: editing.active !== false,
            };
            let error;
            if (editing.id) ({ error } = await supabase.from('sponsors').update(payload).eq('id', editing.id));
            else ({ error } = await supabase.from('sponsors').insert({ ...payload, created_by: user.id }));
            if (error) throw error;
            toast.success('Sponsor saved.');
            setEditing(null);
            await load(); reload();
        } catch (e) {
            toast.error(e.message?.includes('policy') || e.message?.includes('permission')
                ? "You don't have permission to manage sponsors."
                : `Save failed: ${e.message}`);
        } finally { setSaving(false); }
    };

    const remove = async (id) => {
        if (!window.confirm('Remove this sponsor?')) return;
        const { error } = await supabase.from('sponsors').delete().eq('id', id);
        if (error) { toast.error('Delete failed.'); return; }
        await load(); reload();
    };

    const overlay = (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-stretch sm:items-center sm:justify-center sm:p-4">
            <div className="w-full sm:max-w-lg bg-[#0f0f12] sm:rounded-2xl border border-white/10 flex flex-col h-[100dvh] sm:h-[85dvh] overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
                    <Star className="w-5 h-5 text-brand-gold shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="text-white font-bold text-base leading-tight">Sponsors</div>
                        <div className="text-[11px] text-gray-400">Your sponsors' logos, in front of every family.</div>
                    </div>
                    <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-white" aria-label="Close"><X className="w-5 h-5" /></button>
                </div>

                <div className="flex gap-1 px-3 pt-2 shrink-0">
                    {[['wall', 'Sponsor wall'], ['sell', 'Sell sponsorships']].map(([v, label]) => (
                        <button key={v} onClick={() => { setView(v); setEditing(null); setEditingPkg(null); }}
                            className={`flex-1 text-xs font-bold rounded-lg py-2 transition-colors ${view === v ? 'bg-brand-gold/15 text-brand-gold border border-brand-gold/40' : 'text-gray-400 hover:text-white border border-transparent'}`}>
                            {label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
                    {view === 'sell' ? (
                        <SellPanel {...{ pkgs, editingPkg, setEditingPkg, savingPkg, savePkg, removePkg, seedDefaults, seeding, sponsorUrl, copyLink, rows }} />
                    ) : editing ? (
                        <div className="space-y-3">
                            <div>
                                <label className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">Sponsor name</label>
                                <input autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                                    placeholder="e.g. Rockford Toyota"
                                    className="mt-1 w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-gold outline-none" />
                            </div>
                            <div>
                                <label className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">Tier</label>
                                <div className="mt-1 grid grid-cols-3 gap-2">
                                    {TIERS.map((t) => {
                                        const Icon = t.icon; const on = editing.tier === t.value;
                                        return (
                                            <button key={t.value} type="button" onClick={() => setEditing({ ...editing, tier: t.value })}
                                                className={`p-2.5 rounded-lg border flex flex-col items-center gap-1 transition-all ${on ? 'bg-brand-gold/10 border-brand-gold' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                                                <Icon className={`w-4 h-4 ${on ? 'text-brand-gold' : 'text-gray-400'}`} />
                                                <span className="text-[11px] font-bold text-gray-200">{t.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="mt-1.5 text-[11px] text-gray-500">{TIERS.find((t) => t.value === editing.tier)?.desc}</p>
                            </div>
                            <div>
                                <label className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">Logo</label>
                                <div className="mt-1 flex items-center gap-3">
                                    {editing.logo_url
                                        ? <img src={editing.logo_url} alt="logo" className="h-10 w-10 object-contain rounded bg-white/10 p-1" />
                                        : <div className="h-10 w-10 rounded bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 text-lg">{(editing.name || '?').charAt(0).toUpperCase()}</div>}
                                    <label className="cursor-pointer text-sm bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 flex items-center gap-1.5">
                                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                        {editing.logo_url ? 'Replace logo' : 'Upload logo'}
                                        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
                                            onChange={(e) => { uploadLogo(e.target.files?.[0]); e.target.value = ''; }} />
                                    </label>
                                    {editing.logo_url && <button type="button" onClick={() => setEditing({ ...editing, logo_url: '' })} className="text-xs text-gray-400 hover:text-red-400 underline">Remove</button>}
                                </div>
                                <button type="button" onClick={() => setShowUrl(!showUrl)} className="mt-1 text-[11px] text-gray-500 hover:text-gray-300 underline">{showUrl ? 'Hide URL field' : 'or paste an image URL'}</button>
                                {showUrl && (
                                    <input value={editing.logo_url} onChange={(e) => setEditing({ ...editing, logo_url: e.target.value })}
                                        placeholder="https://…/logo.png"
                                        className="mt-1 w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-gold outline-none" />
                                )}
                                <p className="mt-1 text-[11px] text-gray-500">PNG, JPG, WEBP or SVG, under 1MB. Uploading is more reliable than a pasted URL.</p>
                            </div>
                            <div>
                                <label className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">Website link (optional)</label>
                                <input value={editing.link_url} onChange={(e) => setEditing({ ...editing, link_url: e.target.value })}
                                    placeholder="https://sponsor.com"
                                    className="mt-1 w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-gold outline-none" />
                            </div>
                            <div className="flex items-center gap-3 pt-1">
                                <button onClick={save} disabled={saving}
                                    className="flex items-center gap-1.5 bg-brand-gold text-black text-sm font-bold rounded-lg px-4 py-2 disabled:opacity-40">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Save sponsor
                                </button>
                                <button onClick={() => setEditing(null)} className="text-sm text-gray-400 hover:text-white">Cancel</button>
                            </div>
                        </div>
                    ) : rows == null ? (
                        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
                    ) : (
                        <>
                            <button onClick={() => setEditing({ ...BLANK })}
                                className="w-full flex items-center justify-center gap-2 bg-brand-gold text-black font-bold rounded-xl py-3">
                                <Plus className="w-5 h-5" /> Add a sponsor
                            </button>
                            {TIERS.map((t) => {
                                const list = rows.filter((r) => r.tier === t.value);
                                const Icon = t.icon;
                                return (
                                    <div key={t.value}>
                                        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gray-500 font-bold mt-2 mb-1">
                                            <Icon className="w-3.5 h-3.5" /> {t.label}
                                        </div>
                                        {list.length === 0 ? (
                                            <div className="text-[12px] text-gray-600 pl-1">No {t.label.toLowerCase()} sponsor yet.</div>
                                        ) : list.map((s) => (
                                            <div key={s.id} className={`flex items-center gap-3 rounded-lg border p-2.5 ${s.active ? 'border-white/10 bg-white/[0.03]' : 'border-white/5 bg-white/[0.02] opacity-60'}`}>
                                                {s.logo_url
                                                    ? <img src={s.logo_url} alt={s.name} className="h-8 w-8 object-contain rounded bg-white/5 shrink-0" />
                                                    : <div className="h-8 w-8 rounded bg-white/5 flex items-center justify-center text-[10px] text-gray-500 shrink-0">{(s.name || '?')[0]}</div>}
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-white text-sm font-semibold truncate">{s.name}{!s.active && <span className="text-gray-500 font-normal"> · hidden</span>}</div>
                                                    {s.link_url && <div className="text-[11px] text-gray-500 truncate">{s.link_url}</div>}
                                                </div>
                                                <button onClick={() => setEditing(s)} className="p-1.5 text-gray-400 hover:text-white" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
                                                <button onClick={() => remove(s.id)} className="p-1.5 text-gray-400 hover:text-red-400" aria-label="Remove"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(overlay, document.body);
};

// "Sell sponsorships" tab — publish packages + share the public buy link/QR.
const PKG_FIELD = 'mt-1 w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-gold outline-none';
const PKG_LABEL = 'text-[11px] uppercase tracking-wider text-gray-400 font-bold';

const SellPanel = ({ pkgs, editingPkg, setEditingPkg, savingPkg, savePkg, removePkg, seedDefaults, seeding, sponsorUrl, copyLink, rows }) => {
    if (editingPkg) {
        const p = editingPkg;
        const upd = (patch) => setEditingPkg({ ...p, ...patch });
        return (
            <div className="space-y-3">
                <div>
                    <label className={PKG_LABEL}>Package name</label>
                    <input autoFocus value={p.name} onChange={(e) => upd({ name: e.target.value })} placeholder="e.g. Premier Sponsor" className={PKG_FIELD} />
                </div>
                <div>
                    <label className={PKG_LABEL}>Tier (drives where the logo shows)</label>
                    <div className="mt-1 grid grid-cols-3 gap-2">
                        {TIERS.map((t) => {
                            const Icon = t.icon; const on = p.tier === t.value;
                            return (
                                <button key={t.value} type="button" onClick={() => upd({ tier: t.value })}
                                    className={`p-2.5 rounded-lg border flex flex-col items-center gap-1 transition-all ${on ? 'bg-brand-gold/10 border-brand-gold' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                                    <Icon className={`w-4 h-4 ${on ? 'text-brand-gold' : 'text-gray-400'}`} />
                                    <span className="text-[11px] font-bold text-gray-200">{t.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={PKG_LABEL}>Price (USD)</label>
                        <input type="number" min="1" step="1" value={p.price_cents / 100} onChange={(e) => upd({ price_cents: Math.round(Number(e.target.value) * 100) })} className={PKG_FIELD} />
                    </div>
                    <div>
                        <label className={PKG_LABEL}>Billing</label>
                        <select value={p.billing_type} onChange={(e) => upd({ billing_type: e.target.value })} className={PKG_FIELD}>
                            <option value="annual">Yearly (auto-renews)</option>
                            <option value="one_time">One-time</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label className={PKG_LABEL}>Max sponsors at this tier (blank = unlimited)</label>
                    <input type="number" min="1" step="1" value={p.max_active ?? ''} onChange={(e) => upd({ max_active: e.target.value })} placeholder="Unlimited" className={PKG_FIELD} />
                </div>
                <div>
                    <label className={PKG_LABEL}>Description (shown to the business)</label>
                    <textarea rows={2} value={p.description || ''} onChange={(e) => upd({ description: e.target.value })} className={PKG_FIELD} />
                </div>
                <div>
                    <label className={PKG_LABEL}>Benefits (one per line)</label>
                    <textarea rows={3} value={(p.benefits || []).join('\n')} onChange={(e) => upd({ benefits: e.target.value.split('\n') })} placeholder={'Logo on dashboards\nWeekly digest shout-out'} className={PKG_FIELD} />
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-300">
                    <input type="checkbox" checked={p.active !== false} onChange={(e) => upd({ active: e.target.checked })} />
                    Available to buy on the public page
                </label>
                <div className="flex items-center gap-3 pt-1">
                    <button onClick={savePkg} disabled={savingPkg} className="flex items-center gap-1.5 bg-brand-gold text-black text-sm font-bold rounded-lg px-4 py-2 disabled:opacity-40">
                        {savingPkg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Save package
                    </button>
                    <button onClick={() => setEditingPkg(null)} className="text-sm text-gray-400 hover:text-white">Cancel</button>
                </div>
            </div>
        );
    }

    if (pkgs == null) return <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;

    const anyActive = pkgs.some((p) => p.active);
    const soldFor = (pkgId, tier) => (rows || []).filter((r) => (r.package_id === pkgId || (r.tier === tier && r.source === 'self_serve')) && r.status !== 'canceled').length;

    return (
        <div className="space-y-4">
            {/* Share block — the product: send a link/QR, get paid */}
            {anyActive ? (
                <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-3">
                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-brand-gold font-bold mb-2">
                        <Share2 className="w-3.5 h-3.5" /> Your Sponsor Us link
                    </div>
                    <div className="flex gap-3 items-start">
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(sponsorUrl)}`}
                            alt="QR code" className="w-24 h-24 rounded-lg bg-white p-1 shrink-0" />
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-gray-400 mb-1.5">Text or post this — businesses pick a level, upload their logo, and pay. Their logo goes live instantly.</p>
                            <div className="text-[11px] text-gray-300 break-all bg-black/30 rounded px-2 py-1.5 mb-2">{sponsorUrl}</div>
                            <button onClick={copyLink} className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5">
                                <Copy className="w-3.5 h-3.5" /> Copy link
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
                    <DollarSign className="w-6 h-6 text-brand-gold mx-auto mb-1.5" />
                    <p className="text-sm text-gray-300 font-semibold">Sell sponsorships online</p>
                    <p className="text-[12px] text-gray-500 mt-1 mb-3">Publish packages, then share a link or QR. Businesses pay in the app and their logo goes live automatically.</p>
                    <button onClick={seedDefaults} disabled={seeding}
                        className="inline-flex items-center gap-1.5 bg-brand-gold text-black text-sm font-bold rounded-lg px-4 py-2 disabled:opacity-40">
                        {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add starter packages
                    </button>
                </div>
            )}

            {pkgs.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Packages</div>
                        <button onClick={() => setEditingPkg({ ...BLANK_PKG })} className="flex items-center gap-1 text-xs text-brand-gold hover:text-brand-gold/80">
                            <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                    </div>
                    {pkgs.map((p) => {
                        const sold = soldFor(p.id, p.tier);
                        return (
                            <div key={p.id} className={`flex items-center gap-3 rounded-lg border p-2.5 ${p.active ? 'border-white/10 bg-white/[0.03]' : 'border-white/5 bg-white/[0.02] opacity-60'}`}>
                                <div className="flex-1 min-w-0">
                                    <div className="text-white text-sm font-semibold truncate">
                                        {p.name} <span className="text-[10px] uppercase tracking-wider text-gray-500 ml-1">{p.tier}</span>
                                        {!p.active && <span className="text-gray-500 font-normal"> · hidden</span>}
                                    </div>
                                    <div className="text-[11px] text-gray-500">
                                        {money(p.price_cents, p.currency)}{p.billing_type === 'annual' ? '/yr' : ''}
                                        {p.max_active != null && ` · ${sold}/${p.max_active} sold`}
                                        {p.max_active == null && sold > 0 && ` · ${sold} sold`}
                                    </div>
                                </div>
                                <button onClick={() => setEditingPkg(p)} className="p-1.5 text-gray-400 hover:text-white" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
                                <button onClick={() => removePkg(p.id)} className="p-1.5 text-gray-400 hover:text-red-400" aria-label="Remove"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SponsorsDrilldown;
