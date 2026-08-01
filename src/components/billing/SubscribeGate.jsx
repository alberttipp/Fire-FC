import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useBranding } from '../../context/BrandingContext';
import { useAuth } from '../../context/AuthContext';

// Flow A paywall — shown to a club's staff when the club has no active platform
// subscription. Starts Stripe Checkout (subscription mode) via the club-checkout
// edge function. Comped clubs never see this.
const PLANS = [
    { id: 'monthly', label: 'Monthly', price: '$49', per: '/month', note: 'Cancel anytime' },
    { id: 'annual', label: 'Annual', price: '$490', per: '/year', note: '2 months free', best: true },
];

export default function SubscribeGate({ orgId, onRefresh }) {
    const brand = useBranding();
    const { signOut } = useAuth();
    const [plan, setPlan] = useState('annual');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

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

    return (
        <div className="min-h-screen bg-brand-dark text-white flex flex-col items-center justify-center p-4">
            <div className="glass-panel p-8 max-w-lg w-full text-center">
                <img src={brand.logoUrl} alt={brand.name} className="w-16 h-16 object-contain mx-auto mb-4" />
                <h1 className="text-2xl font-display font-bold uppercase tracking-wider mb-1">{brand.name}</h1>
                <p className="text-gray-400 text-sm mb-6">
                    Activate your club's subscription to unlock the coaching platform — rosters,
                    training, evaluations, chat, scheduling and more.
                </p>

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

                <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500">
                    <button onClick={onRefresh} className="hover:text-gray-300 underline">Already subscribed? Refresh</button>
                    <button onClick={signOut} className="hover:text-gray-300 underline">Sign out</button>
                </div>
            </div>
        </div>
    );
}
