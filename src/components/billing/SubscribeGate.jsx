import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useBranding } from '../../context/BrandingContext';
import { useAuth } from '../../context/AuthContext';

// Flow A paywall — shown to a club's staff when the club has no active platform
// subscription. Per-team pricing (quantity = # of teams, min applies). Starts
// Stripe Checkout via club-checkout. Comped clubs never see this.
const dollars = (c) => `$${Math.round((c || 0) / 100)}`;

export default function SubscribeGate({ orgId, onRefresh }) {
    const brand = useBranding();
    const { signOut } = useAuth();
    const [plan, setPlan] = useState('annual');
    const [quote, setQuote] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [couponOpen, setCouponOpen] = useState(false);
    const [coupon, setCoupon] = useState('');
    const [couponBusy, setCouponBusy] = useState(false);
    const [couponError, setCouponError] = useState('');
    const [couponDays, setCouponDays] = useState(null); // trial_days after a successful redeem

    useEffect(() => {
        if (!orgId) return;
        supabase.rpc('club_billing_quote', { p_org_id: orgId })
            .then(({ data }) => setQuote(Array.isArray(data) ? data[0] : data)).catch(() => {});
    }, [orgId]);

    const billedTeams = quote ? Math.max(quote.team_count, quote.min_teams) : null;
    const PLANS = [
        { id: 'monthly', label: 'Monthly', price: quote ? dollars(quote.monthly_cents) : '—', per: '/month', note: 'Cancel anytime' },
        { id: 'annual', label: 'Annual', price: quote ? dollars(quote.annual_cents) : '—', per: '/year', note: '2 months free', best: true },
    ];

    const params = new URLSearchParams(window.location.search);
    const cancelled = params.get('billing') === 'cancelled';

    const startCheckout = async () => {
        setBusy(true); setError('');
        try {
            const { data, error } = await supabase.functions.invoke('club-checkout', { body: { plan, orgId } });
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

    // Coupon redemption — redeem_club_coupon starts a DB-side free trial
    // (org_subscriptions.trial_ends_at), so the club unlocks without Stripe.
    const applyCoupon = async () => {
        if (!coupon.trim() || couponBusy) return;
        setCouponBusy(true); setCouponError('');
        try {
            const { data, error } = await supabase.rpc('redeem_club_coupon', { p_org_id: orgId, p_code: coupon });
            if (error) throw new Error(error.message || 'Could not apply that code.');
            setCouponDays(data?.trial_days || null);
            // Let the success note render, then re-run the subscription check —
            // the gate unmounts once the org resolves active.
            setTimeout(() => onRefresh?.(), 1200);
        } catch (e) {
            // Supabase surfaces the RAISE EXCEPTION text; strip any pg prefix.
            setCouponError((e.message || 'Could not apply that code.').replace(/^.*?P0001:\s*/, ''));
            setCouponBusy(false);
        }
    };

    return (
        <div className="min-h-screen bg-brand-dark text-white flex flex-col items-center justify-center p-4">
            <div className="glass-panel p-8 max-w-lg w-full text-center">
                <img src={brand.logoUrl} alt={brand.name} className="w-16 h-16 object-contain mx-auto mb-4" />
                <h1 className="text-2xl font-display font-bold uppercase tracking-wider mb-1">{brand.name}</h1>
                <p className="text-gray-400 text-sm mb-4">
                    Activate your club's subscription to unlock the coaching platform — rosters,
                    training, evaluations, chat, scheduling and more.
                </p>

                {quote && (
                    <div className="mb-5 text-xs text-gray-400 bg-white/5 border border-white/10 rounded-lg px-4 py-2">
                        Pricing is <span className="text-white">{dollars(quote.per_team_cents)}/team</span>. You have <span className="text-white">{quote.team_count} {quote.team_count === 1 ? 'team' : 'teams'}</span>
                        {quote.team_count < quote.min_teams && <> (billed at the {quote.min_teams}-team minimum)</>} — so <span className="text-white">{billedTeams} × {dollars(quote.per_team_cents)}</span>.
                    </div>
                )}

                {cancelled && (
                    <div className="mb-4 text-sm text-brand-gold bg-brand-gold/10 border border-brand-gold/30 rounded-lg px-4 py-2">
                        Checkout was cancelled — you can try again anytime.
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-5">
                    {PLANS.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => setPlan(p.id)}
                            className={`relative p-4 rounded-xl border text-left transition-all ${plan === p.id ? 'border-brand-green bg-brand-green/10 ring-2 ring-brand-green/40' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                        >
                            {p.best && <span className="absolute -top-2 right-3 text-[10px] uppercase tracking-wider bg-brand-gold text-brand-dark font-bold px-2 py-0.5 rounded">Best value</span>}
                            <div className="text-sm text-gray-300 uppercase tracking-wide">{p.label}</div>
                            <div className="text-2xl font-display font-bold">{p.price}<span className="text-sm text-gray-400 font-sans">{p.per}</span></div>
                            <div className="text-[11px] text-gray-400 mt-1">{p.note}</div>
                        </button>
                    ))}
                </div>

                {error && <div className="mb-3 text-sm text-red-400">{error}</div>}

                <button onClick={startCheckout} disabled={busy} className="btn-primary w-full disabled:opacity-60">
                    {busy ? 'Starting checkout…' : `Subscribe ${plan === 'annual' ? 'Annually' : 'Monthly'}`}
                </button>

                {/* Coupon code — unlocks a free trial without Stripe checkout */}
                <div className="mt-4">
                    {couponDays ? (
                        <div className="text-sm text-brand-green bg-brand-green/10 border border-brand-green/30 rounded-lg px-4 py-2">
                            Coupon applied — your club is free for {couponDays} days. Loading your app…
                        </div>
                    ) : !couponOpen ? (
                        <button onClick={() => setCouponOpen(true)} className="text-xs text-gray-500 hover:text-gray-300 underline">
                            Have a coupon code?
                        </button>
                    ) : (
                        <div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={coupon}
                                    onChange={(e) => { setCoupon(e.target.value); setCouponError(''); }}
                                    onKeyDown={(e) => { if (e.key === 'Enter') applyCoupon(); }}
                                    placeholder="Coupon code"
                                    autoFocus
                                    className="flex-1 bg-black/50 border border-white/10 rounded-lg py-2 px-3 text-white text-sm uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                                />
                                <button
                                    onClick={applyCoupon}
                                    disabled={couponBusy || !coupon.trim()}
                                    className="px-4 py-2 rounded-lg border border-brand-green/50 text-brand-green text-sm font-bold uppercase tracking-wider hover:bg-brand-green/10 transition-colors disabled:opacity-50"
                                >
                                    {couponBusy ? 'Applying…' : 'Apply'}
                                </button>
                            </div>
                            {couponError && <div className="mt-2 text-sm text-red-400 text-left">{couponError}</div>}
                        </div>
                    )}
                </div>

                <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500">
                    <button onClick={onRefresh} className="hover:text-gray-300 underline">Already subscribed? Refresh</button>
                    <button onClick={signOut} className="hover:text-gray-300 underline">Sign out</button>
                </div>
            </div>
        </div>
    );
}
