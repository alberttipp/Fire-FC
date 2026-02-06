import React from 'react';
import { DollarSign, CreditCard, TrendingUp, Receipt } from 'lucide-react';

const FinancialView = () => {
    return (
        <div className="max-w-2xl mx-auto text-center space-y-8 animate-fade-in py-12">
            {/* Icon */}
            <div className="w-20 h-20 bg-brand-green/10 rounded-full flex items-center justify-center mx-auto">
                <DollarSign className="w-10 h-10 text-brand-green" />
            </div>

            {/* Title */}
            <div>
                <h2 className="text-3xl text-white font-display uppercase font-bold tracking-wider">Billing Center</h2>
                <p className="text-gray-400 mt-2">Coming Soon</p>
            </div>

            {/* Description */}
            <p className="text-gray-400 max-w-md mx-auto leading-relaxed">
                We're building a complete financial hub for your club. Track dues, send invoices, and manage payments — all in one place.
            </p>

            {/* Planned Features */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto">
                <div className="glass-panel p-4 rounded-xl">
                    <CreditCard className="w-6 h-6 text-brand-gold mx-auto mb-2" />
                    <p className="text-white text-sm font-bold">Payments</p>
                    <p className="text-gray-500 text-xs mt-1">Collect fees online</p>
                </div>
                <div className="glass-panel p-4 rounded-xl">
                    <Receipt className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                    <p className="text-white text-sm font-bold">Invoicing</p>
                    <p className="text-gray-500 text-xs mt-1">Auto-send invoices</p>
                </div>
                <div className="glass-panel p-4 rounded-xl">
                    <TrendingUp className="w-6 h-6 text-brand-green mx-auto mb-2" />
                    <p className="text-white text-sm font-bold">Reports</p>
                    <p className="text-gray-500 text-xs mt-1">Revenue dashboards</p>
                </div>
            </div>

            <p className="text-gray-600 text-xs">Payment integration is on the roadmap. Stay tuned!</p>
        </div>
    );
};

export default FinancialView;
