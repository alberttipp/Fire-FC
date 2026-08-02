import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useBranding } from '../context/BrandingContext';
import SponsorSlot from '../components/sponsors/SponsorSlot';

// Public, branded family registration page (Flow B). Resolves the club from
// ?club=slug (via BrandingContext), lists open programs, collects player + guardian
// + medical/emergency info and a signed waiver, then starts payment on the club's
// connected Stripe account. No login required.
const money = (cents, cur = 'usd') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: (cur || 'usd').toUpperCase() }).format((cents || 0) / 100);
const billingLabel = { one_time: 'one-time', monthly: '/month', annual: '/year' };

const FIELD = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-brand-green focus:outline-none';
const LABEL = 'block text-xs uppercase tracking-wider text-gray-400 mb-1';

const GENDERS = ['Male', 'Female', 'Other'];
const JERSEY_SIZES = ['YXS', 'YS', 'YM', 'YL', 'YXL', 'Adult S', 'Adult M', 'Adult L', 'Adult XL'];
const GRADES = ['Pre-K', 'Kindergarten', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];

const Select = ({ value, onChange, options, placeholder = 'Select…' }) => (
    <select className={FIELD} value={value} onChange={onChange}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
);

export default function Register() {
    const brand = useBranding();
    const status = new URLSearchParams(window.location.search).get('status');

    const [programs, setPrograms] = useState(null); // null = loading
    const [programId, setProgramId] = useState('');
    const [form, setForm] = useState({
        playerFirstName: '', playerLastName: '', playerDob: '', playerGender: '', jerseySize: '', grade: '', school: '',
        guardianName: '', guardianEmail: '', guardianPhone: '', emergencyName: '', emergencyPhone: '', medicalNotes: '',
        waiverSignature: '', discountCode: '',
    });
    const [discount, setDiscount] = useState(null); // { kind, value } once applied
    const [waitlisted, setWaitlisted] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        (async () => {
            const { data, error } = await supabase.rpc('get_org_programs', { p_slug: brand.slug });
            setPrograms(error ? [] : (data || []));
            if (data && data.length === 1) setProgramId(data[0].id);
        })();
    }, [brand.slug]);

    const program = programs?.find((p) => p.id === programId);
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

    const discountedCents = program
        ? Math.max(0, program.price_cents - (discount ? (discount.kind === 'percent' ? Math.floor(program.price_cents * discount.value / 100) : discount.value) : 0))
        : 0;

    const applyCode = async () => {
        setError(''); setDiscount(null);
        if (!form.discountCode || !program) return;
        const { data } = await supabase.rpc('validate_discount_code', { p_slug: brand.slug, p_code: form.discountCode.trim(), p_program_id: programId });
        const row = Array.isArray(data) ? data[0] : data;
        if (row) setDiscount(row); else setError('That code isn\'t valid for this program.');
    };

    const submit = async () => {
        setError('');
        if (!program) return setError('Please select a program.');
        if (!form.playerFirstName || !form.playerLastName) return setError("Player's first and last name are required.");
        if (!form.guardianName || !form.guardianEmail) return setError("Parent/guardian name and email are required.");
        if (program.waiver_text && !form.waiverSignature.trim()) return setError('Please type your name to sign the waiver.');
        setBusy(true);
        try {
            const { data, error } = await supabase.functions.invoke('registration-checkout', {
                body: { programId, ...form },
            });
            if (error) {
                let msg = error.message;
                try { const ctx = await error.context?.json?.(); if (ctx?.error) msg = ctx.error; } catch { /* ignore */ }
                throw new Error(msg || 'Could not start checkout.');
            }
            if (data?.error) throw new Error(data.error);
            if (data?.waitlisted) { setWaitlisted(true); setBusy(false); return; }
            if (data?.free) { window.location.href = `${window.location.pathname}?club=${brand.slug}&status=success`; return; }
            if (data?.url) { window.location.href = data.url; return; }
            throw new Error('No checkout URL returned.');
        } catch (e) {
            setError(e.message);
            setBusy(false);
        }
    };

    // Success / cancel returns from Stripe.
    if (status === 'success') {
        return (
            <Shell brand={brand}>
                <div className="text-center">
                    <div className="text-5xl mb-3">🎉</div>
                    <h2 className="text-2xl font-display font-bold uppercase tracking-wider mb-2">Registration received!</h2>
                    <p className="text-gray-400">Thanks for registering with {brand.name}. A receipt is on its way to your email.</p>
                    <SponsorSlot tier="premier" placement="register_success" className="mt-6 justify-center" />
                </div>
            </Shell>
        );
    }

    return (
        <Shell brand={brand}>
            <h2 className="text-2xl font-display font-bold uppercase tracking-wider mb-1">{brand.name} Registration</h2>
            <p className="text-gray-400 text-sm mb-6">Register your player below. Payment is secure via Stripe.</p>

            {status === 'cancelled' && (
                <div className="mb-4 text-sm text-brand-gold bg-brand-gold/10 border border-brand-gold/30 rounded-lg px-4 py-2">
                    Checkout was cancelled — your info wasn't submitted. You can try again.
                </div>
            )}

            {programs === null && <p className="text-gray-500">Loading programs…</p>}
            {programs && programs.length === 0 && (
                <p className="text-gray-400">Registration isn't open right now. Please check back soon.</p>
            )}

            {programs && programs.length > 0 && (
                <div className="space-y-5">
                    {/* Program picker */}
                    <div>
                        <label className={LABEL}>Program</label>
                        <div className="space-y-2">
                            {programs.map((p) => (
                                <button key={p.id} onClick={() => setProgramId(p.id)}
                                    className={`w-full text-left p-3 rounded-lg border transition-all ${programId === p.id ? 'border-brand-green bg-brand-green/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <div className="font-semibold">{p.name}{p.age_group ? ` · ${p.age_group}` : ''}</div>
                                            {p.season && <div className="text-xs text-gray-400">{p.season}</div>}
                                            {p.description && <div className="text-xs text-gray-400 mt-1">{p.description}</div>}
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <div className="text-lg font-display font-bold">{money(p.price_cents, p.currency)}</div>
                                            <div className="text-[11px] text-gray-400">{billingLabel[p.billing_type]}</div>
                                            {p.spots_left != null && <div className="text-[11px] text-gray-500">{p.spots_left} spots left</div>}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Player */}
                    <Section title="Player">
                        <Row><Field label="First name *"><input className={FIELD} value={form.playerFirstName} onChange={set('playerFirstName')} /></Field>
                            <Field label="Last name *"><input className={FIELD} value={form.playerLastName} onChange={set('playerLastName')} /></Field></Row>
                        <Row><Field label="Date of birth"><input type="date" className={FIELD} value={form.playerDob} onChange={set('playerDob')} /></Field>
                            <Field label="Gender"><Select value={form.playerGender} onChange={set('playerGender')} options={GENDERS} /></Field></Row>
                        <Row><Field label="Jersey size"><Select value={form.jerseySize} onChange={set('jerseySize')} options={JERSEY_SIZES} /></Field>
                            <Field label="Grade"><Select value={form.grade} onChange={set('grade')} options={GRADES} /></Field></Row>
                        <Field label="School (optional)"><input className={FIELD} value={form.school} onChange={set('school')} /></Field>
                    </Section>

                    {/* Parent / guardian */}
                    <Section title="Parent / Guardian">
                        <Row><Field label="Full name *"><input className={FIELD} value={form.guardianName} onChange={set('guardianName')} /></Field>
                            <Field label="Email *"><input type="email" className={FIELD} value={form.guardianEmail} onChange={set('guardianEmail')} /></Field></Row>
                        <Field label="Phone"><input className={FIELD} value={form.guardianPhone} onChange={set('guardianPhone')} placeholder="(815) 555-0123" /></Field>
                    </Section>

                    {/* Emergency + medical */}
                    <Section title="Emergency & Medical">
                        <Row><Field label="Emergency contact"><input className={FIELD} value={form.emergencyName} onChange={set('emergencyName')} /></Field>
                            <Field label="Emergency phone"><input className={FIELD} value={form.emergencyPhone} onChange={set('emergencyPhone')} /></Field></Row>
                        <Field label="Allergies / medical notes"><textarea className={FIELD} rows={2} value={form.medicalNotes} onChange={set('medicalNotes')} /></Field>
                    </Section>

                    {/* Waiver */}
                    {program?.waiver_text && (
                        <Section title="Waiver & Consent">
                            <div className="text-xs text-gray-400 max-h-32 overflow-y-auto bg-white/5 border border-white/10 rounded-lg p-3 mb-2 whitespace-pre-wrap">{program.waiver_text}</div>
                            <Field label="Type your full name to sign *"><input className={FIELD} value={form.waiverSignature} onChange={set('waiverSignature')} /></Field>
                        </Section>
                    )}

                    <Section title="Discount code">
                        <div className="flex gap-2">
                            <input className={FIELD} placeholder="Have a code?" value={form.discountCode} onChange={set('discountCode')} />
                            <button onClick={applyCode} type="button" className="px-4 rounded bg-white/10 hover:bg-white/20 text-sm shrink-0">Apply</button>
                        </div>
                        {discount && <div className="text-xs text-green-400 mt-1">Code applied — {discount.kind === 'percent' ? `${discount.value}% off` : `${money(discount.value)} off`}. New total: {money(discountedCents, program?.currency)}</div>}
                    </Section>

                    {waitlisted && <div className="text-sm text-brand-gold bg-brand-gold/10 border border-brand-gold/30 rounded-lg px-4 py-2">This program is full — you've been added to the waitlist. The club will reach out if a spot opens.</div>}

                    {error && <div className="text-sm text-red-400">{error}</div>}

                    <button onClick={submit} disabled={busy || !program || waitlisted} className="btn-primary w-full disabled:opacity-60">
                        {busy ? 'Starting checkout…' : program ? `Register & Pay ${money(discountedCents, program.currency)}` : 'Select a program'}
                    </button>
                    <p className="text-[11px] text-gray-500 text-center">Payments are processed securely by Stripe. {brand.name} receives your registration once payment completes.</p>
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
            <div className="mt-6 flex justify-center"><SponsorSlot tier="community" placement="register_footer" /></div>
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
