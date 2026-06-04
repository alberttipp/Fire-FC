import React from 'react';
import { Heart, Award, ExternalLink, ShieldCheck, CreditCard, Receipt, TrendingUp } from 'lucide-react';
import { ZEFFY_URL } from '../SupportTeamCard';

// Hosted Zeffy donation/sponsorship form for 815YouthSports (501c3, EIN
// 33-4868694). Zeffy is free for nonprofits — 100% of the gift reaches the
// org. We never touch card data; the button just opens the hosted form.
// ZEFFY_URL is single-sourced from SupportTeamCard.

const SPONSOR_TIERS = [
    { name: 'Bronze', amount: '$100', perk: 'Shout-out + our thanks' },
    { name: 'Silver', amount: '$250', perk: 'Logo on the team page' },
    { name: 'Gold', amount: '$500', perk: 'Logo + jersey/banner mention' },
];

const FinancialView = () => {
    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-fade-in py-8">
            {/* Support / Sponsor hero */}
            <div className="glass-panel border-l-4 border-l-brand-green p-6 sm:p-8 text-center space-y-5">
                <div className="w-20 h-20 bg-brand-green/10 rounded-full flex items-center justify-center mx-auto">
                    <Heart className="w-10 h-10 text-brand-green" />
                </div>

                <div>
                    <h2 className="text-3xl text-white font-display uppercase font-bold tracking-wider">Support the Team</h2>
                    <p className="text-gray-400 mt-2 max-w-md mx-auto leading-relaxed">
                        Your gift keeps the app running and helps cover equipment, fields, and player development for our kids. Every dollar makes a difference. ⚽
                    </p>
                </div>

                <a
                    href={ZEFFY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 rounded-lg bg-brand-green text-brand-dark font-display font-bold text-lg uppercase tracking-wider hover:bg-white transition-colors"
                >
                    <Heart className="w-5 h-5" /> Donate / Sponsor
                    <ExternalLink className="w-4 h-4 opacity-70" />
                </a>

                {/* Tax-deductible note */}
                <div className="flex items-start gap-2 text-left max-w-md mx-auto rounded-lg bg-white/[0.03] border border-white/5 p-3">
                    <ShieldCheck className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-400 leading-relaxed">
                        <span className="text-white font-semibold">815YouthSports</span> is a registered 501(c)(3) nonprofit (EIN 33-4868694). Your donation is <span className="text-white font-semibold">tax-deductible</span>, and Zeffy passes 100% of it through — no platform fees.
                    </p>
                </div>
            </div>

            {/* Sponsorship tiers */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <Award className="w-5 h-5 text-brand-gold" />
                    <h3 className="text-white font-display uppercase font-bold tracking-wider">Business Sponsorships</h3>
                </div>
                <p className="text-gray-400 text-sm mb-4">
                    Own a business? Sponsor the team and get recognized. Choose an amount on the donation form and add your business name in the note.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {SPONSOR_TIERS.map((t) => (
                        <a
                            key={t.name}
                            href={ZEFFY_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="glass-panel p-4 rounded-xl text-center hover:border-brand-gold/40 hover:bg-brand-gold/5 transition-colors"
                        >
                            <p className="text-brand-gold font-display uppercase text-xs tracking-widest">{t.name}</p>
                            <p className="text-white text-2xl font-display font-bold mt-1">{t.amount}</p>
                            <p className="text-gray-500 text-xs mt-1">{t.perk}</p>
                        </a>
                    ))}
                </div>
            </div>

            {/* Billing — still on the roadmap */}
            <div className="border-t border-white/10 pt-6">
                <p className="text-gray-500 text-xs uppercase tracking-wider font-bold mb-3 text-center">Coming soon: full billing center</p>
                <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto opacity-60">
                    <div className="glass-panel p-3 rounded-xl text-center">
                        <CreditCard className="w-5 h-5 text-brand-gold mx-auto mb-1.5" />
                        <p className="text-white text-xs font-bold">Dues & Fees</p>
                    </div>
                    <div className="glass-panel p-3 rounded-xl text-center">
                        <Receipt className="w-5 h-5 text-blue-400 mx-auto mb-1.5" />
                        <p className="text-white text-xs font-bold">Invoicing</p>
                    </div>
                    <div className="glass-panel p-3 rounded-xl text-center">
                        <TrendingUp className="w-5 h-5 text-brand-green mx-auto mb-1.5" />
                        <p className="text-white text-xs font-bold">Reports</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinancialView;
