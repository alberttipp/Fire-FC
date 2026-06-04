import React from 'react';
import { Heart, ExternalLink } from 'lucide-react';

// Compact "Support the Team" card — opens the hosted Zeffy donation/sponsor
// form for 815YouthSports (501c3, EIN 33-4868694). Shown to parents (the
// donors). The full version with sponsor tiers lives in FinancialView.
export const ZEFFY_URL = 'https://www.zeffy.com/en-US/donation-form/donate-to-change-lives-15404';

const SupportTeamCard = () => (
    <a
        href={ZEFFY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="block glass-panel p-5 border-l-4 border-l-brand-green hover:bg-brand-green/5 transition-colors"
    >
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-brand-green/15 border-2 border-brand-green/40 flex items-center justify-center shrink-0">
                <Heart className="w-6 h-6 text-brand-green" />
            </div>
            <div className="min-w-0 flex-1">
                <h4 className="text-white font-bold text-base leading-tight">Support the Team</h4>
                <p className="text-gray-400 text-xs mt-0.5">
                    Donate or sponsor — tax-deductible, 100% goes to the kids. ⚽
                </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-green text-brand-dark font-display font-bold text-sm uppercase tracking-wider shrink-0">
                Give <ExternalLink className="w-3.5 h-3.5" />
            </span>
        </div>
    </a>
);

export default SupportTeamCard;
