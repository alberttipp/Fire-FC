import React from 'react';
import { ShoppingBag } from 'lucide-react';

// Rock City Store — placeholder until the real shop (gear / jerseys / merch) is wired up.
const StoreView = () => (
    <div className="max-w-2xl mx-auto px-4 md:px-6 pt-10 pb-24 text-center">
        <div className="glass-panel p-8 md:p-12">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-gold/15 border border-brand-gold/40 flex items-center justify-center">
                <ShoppingBag className="w-8 h-8 text-brand-gold" />
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold uppercase tracking-wider text-white mt-5">Rock City Store</h1>
            <p className="text-brand-gold font-bold uppercase tracking-[0.3em] text-sm mt-2">Coming Soon</p>
            <p className="text-gray-400 mt-4 max-w-md mx-auto">
                Official Rock City FC gear, jerseys, and merch — all in one place. We're setting it up now. Check back soon! 🖤💛
            </p>
        </div>
    </div>
);

export default StoreView;
