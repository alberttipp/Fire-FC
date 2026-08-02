import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useBranding } from '../context/BrandingContext';
import SponsorSlot from '../components/sponsors/SponsorSlot';

// Public, branded "Sponsor Us" page (Flow C). Resolves the club from ?club=slug
// (via BrandingContext), lists the club's sponsorship packages, collects the
// business's info + logo, then starts payment on the club's connected Stripe
// account (platform sponsor fee applied). No login required.
const money = (cents, cur = 'usd') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: (cur || 'usd').toUpperCase() }).format((cents || 0) / 100);
const billingLabel = { one_time: 'one-time', annual: '/year' };
const TIER_LABEL = { title: 'Title', premier: 'Premier', community: 'Community' };

const FIELD = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-brand-green focus:outline-none';
const LABEL = 'block text-xs uppercase tracking-wider text-gray-400 mb-1';

export default function SponsorUs() {
    const brand = useBranding();
    const status = new URLSearchParams(window.location.search).get('status');

    const [packages, setPackages] = useState(null); // null = loading
    const [packageId, setPackageId] = useState('');
    const [form, setForm] = useState({
        businessName: '', contactName: '', contactEmail: '', website: '', blurb: '',
    });
    const [logoDataUrl, setLogoDataUrl] = useState('');
    const [attest, setAttest] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        (async () => {
            const { data, error } = await supabase.rpc('get_org_sponsor_packages', { p_slug: brand.slug });
            const list = error ? [] : (data || []).filter((p) => p.spots_left == null || p.spots_left > 0);
            setPackages(list);
            if (list.length === 1) setPackageId(list[0].id);
        })();
    }, [brand.slug]);

    const pkg = packages?.find((p) => p.id === packageId);
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

    const onLogo = (e) => {
        setError('');
        const file = e.target.files?.[0];
        if (!file) return;
        if (!/^image\/(png|jpeg|jpg|webp|svg\+xml)$/.test(file.type)) return setError('Logo must be a PNG, JPG, WEBP or SVG.');
        if (file.size > 1_000_000) return setError('Logo must be under 1MB.');
        const reader = new FileReader();
        reader.onload = () => setLogoDataUrl(reader.result);
        reader.readAsDataURL(file);
    };

    const submit = async () => {
        setError('');
        if (!pkg) return setError('Please choose a sponsorship level.');
        if (!form.businessName.trim()) return setError('Business name is required.');
        if (!form.contactEmail.trim()) return setError('A contact email is required.');
        if (!attest) return setError('Please confirm your business meets the sponsorship guidelines.');
        setBusy(true);
        try {
            const { data, error } = await supabase.functions.invoke('sponsor-checkout', {
                body: { packageId, ...form, logoDataUrl },
            });
            if (error) {
                let msg = error.message;
                try { const ctx = await error.context?.json?.(); if (ctx?.error) msg = ctx.error; } catch { /* ignore */ }
                throw new Error(msg || 'Could not start checkout.');
            }
            if (data?.error) throw new Error(data.error);
            if (data?.url) { window.location.href = data.url; return; }
            throw new Error('No checkout URL returned.');
        } catch (e) {
            setError(e.message);
            setBusy(false);
        }
    };

    if (status === 'success') {
        return (
            <Shell brand={brand}>
                <div className="text-center">
                    <div className="text-5xl mb-3">🎉</div>
                    <h2 className="text-2xl font-display font-bold uppercase tracking-wider mb-2">Thank you for sponsoring!</h2>
                    <p className="text-gray-400">Your support of {brand.name} means the world. Your logo will appear across the club's app, and a receipt is on its way to your email.</p>
                </div>
            </Shell>
        );
    }

    return (
        <Shell brand={brand}>
            <h2 className="text-2xl font-display font-bold uppercase tracking-wider mb-1">Sponsor {brand.name}</h2>
            <p className="text-gray-400 text-sm mb-6">Support local youth soccer and put your business in front of our families. Choose a level below — your logo goes live in the club app as soon as payment completes.</p>

            {status === 'cancelled' && (
                <div className="mb-4 text-sm text-brand-gold bg-brand-gold/10 border border-brand-gold/30 rounded-lg px-4 py-2">
                    Checkout was cancelled — nothing was charged. You can try again.
                </div>
            )}

            {packages === null && <p className="text-gray-500">Loading sponsorship levels…</p>}
            {packages && packages.length === 0 && (
                <p className="text-gray-400">Sponsorships aren't open right now. Please check back soon.</p>
            )}

            {packages && packages.length > 0 && (
                <div className="space-y-5">
                    {/* Package picker */}
                    <div>
                        <label className={LABEL}>Sponsorship level</label>
                        <div className="space-y-2">
                            {packages.map((p) => (
                                <button key={p.id} onClick={() => setPackageId(p.id)}
                                    className={`w-full text-left p-3 rounded-lg border transition-all ${packageId === p.id ? 'border-brand-green bg-brand-green/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-semibold">{p.name} <span className="text-[10px] uppercase tracking-wider text-gray-500 ml-1">{TIER_LABEL[p.tier]}</span></div>
                                            {p.description && <div className="text-xs text-gray-400 mt-0.5">{p.description}</div>}
                                            {Array.isArray(p.benefits) && p.benefits.length > 0 && (
                                                <ul className="text-[11px] text-gray-400 mt-1 space-y-0.5">
                                                    {p.benefits.map((bnf, i) => <li key={i}>• {bnf}</li>)}
                                                </ul>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <div className="text-lg font-display font-bold">{money(p.price_cents, p.currency)}</div>
                                            <div className="text-[11px] text-gray-400">{billingLabel[p.billing_type] || ''}</div>
                                            {p.spots_left != null && <div className="text-[11px] text-gray-500">{p.spots_left} left</div>}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Business */}
                    <Section title="Your business">
                        <Field label="Business name *"><input className={FIELD} value={form.businessName} onChange={set('businessName')} /></Field>
                        <Row><Field label="Contact name"><input className={FIELD} value={form.contactName} onChange={set('contactName')} /></Field>
                            <Field label="Contact email *"><input type="email" className={FIELD} value={form.contactEmail} onChange={set('contactEmail')} /></Field></Row>
                        <Field label="Website (your logo links here)"><input className={FIELD} value={form.website} onChange={set('website')} placeholder="https://" /></Field>
                        <Field label="Short blurb (optional)"><textarea className={FIELD} rows={2} value={form.blurb} onChange={set('blurb')} placeholder="One line about your business" /></Field>
                    </Section>

                    {/* Logo */}
                    <Section title="Logo">
                        <div className="flex items-center gap-3">
                            {logoDataUrl
                                ? <img src={logoDataUrl} alt="logo preview" className="h-12 object-contain bg-white/10 rounded p-1" />
                                : <div className="h-12 w-12 rounded bg-white/5 border border-white/10 flex items-center justify-center text-gray-600 text-xs">Logo</div>}
                            <label className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-sm cursor-pointer">
                                {logoDataUrl ? 'Change logo' : 'Upload logo'}
                                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={onLogo} />
                            </label>
                        </div>
                        <p className="text-[11px] text-gray-500">PNG, JPG, WEBP or SVG, under 1MB. You can add or change your logo later too.</p>
                    </Section>

                    <label className="flex items-start gap-2 text-xs text-gray-400">
                        <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} className="mt-0.5" />
                        <span>I confirm my business is family-friendly and not in a restricted category (alcohol, tobacco, gambling, firearms, political, or adult content).</span>
                    </label>

                    {error && <div className="text-sm text-red-400">{error}</div>}

                    <button onClick={submit} disabled={busy || !pkg} className="btn-primary w-full disabled:opacity-60">
                        {busy ? 'Starting checkout…' : pkg ? `Sponsor for ${money(pkg.price_cents, pkg.currency)}${pkg.billing_type === 'annual' ? '/yr' : ''}` : 'Choose a level'}
                    </button>

                    {/* Social proof — current community sponsors; renders nothing until one exists */}
                    <SponsorSlot tier="community" placement="sponsor_us_wall" className="justify-center" />

                    <p className="text-[11px] text-gray-500 text-center">Payments are processed securely by Stripe. {brand.name} receives your sponsorship once payment completes.</p>
                </div>
            )}
        </Shell>
    );
}

const Shell = ({ brand, children }) => (
    <div className="min-h-screen bg-brand-dark text-white py-8 px-4">
        <div className="max-w-xl mx-auto">
            <div className="flex items-center gap-3 mb-6 justify-center">
                <img src={brand.logoUrl} alt={brand.name} className="w-12 h-12 object-contain" />
                <span className="text-xl font-display font-bold uppercase tracking-wider">{brand.name}</span>
            </div>
            <div className="glass-panel p-6">{children}</div>
        </div>
    </div>
);
const Section = ({ title, children }) => (
    <div><div className="text-sm font-display uppercase tracking-wider text-brand-green mb-2">{title}</div><div className="space-y-3">{children}</div></div>
);
const Row = ({ children }) => <div className="grid grid-cols-2 gap-3">{children}</div>;
const Field = ({ label, children }) => (
    <div><label className={LABEL}>{label}</label>{children}</div>
);
