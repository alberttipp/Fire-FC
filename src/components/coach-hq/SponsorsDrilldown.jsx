import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Loader2, Trash2, Star, Award, Users, Pencil } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import { useSponsors } from '../../context/SponsorContext';

// Coach HQ → Sponsors. Add a sponsor in ~60s: name, tier, logo, link. Three
// tiers with plain-English placement. Writes go through RLS (staff-only).
const TIERS = [
    { value: 'title',     label: 'Title',     icon: Star,  desc: 'Your #1 sponsor — logo on the app front door, dashboards & game-day announcements.' },
    { value: 'premier',   label: 'Premier',   icon: Award, desc: 'Logo on dashboard feeds, event pages & weekly digests.' },
    { value: 'community', label: 'Community', icon: Users, desc: 'Logo in the footer, About page & tryout confirmation.' },
];
const BLANK = { name: '', tier: 'community', logo_url: '', link_url: '', blurb: '', active: true };

const SponsorsDrilldown = ({ teamId, onClose }) => {
    const { user } = useAuth();
    const toast = useToast();
    const { reload } = useSponsors();
    const [orgId, setOrgId] = useState(null);
    const [rows, setRows] = useState(null);
    const [editing, setEditing] = useState(null); // sponsor object (existing or BLANK) | null
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [showUrl, setShowUrl] = useState(false);

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
        setOrgId(team?.org_id || null);
        const { data } = await supabase.from('sponsors').select('*').order('tier').order('sort_order');
        setRows(data || []);
    }, [teamId]);
    useEffect(() => { load(); }, [load]);

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

                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
                    {editing ? (
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

export default SponsorsDrilldown;
