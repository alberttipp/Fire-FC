import React from 'react';
import { DollarSign, TrendingUp, Users, CreditCard, PieChart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const FinancialView = () => {
    const revenueData = [
        { name: 'Jan', revenue: 45000 },
        { name: 'Feb', revenue: 52000 },
        { name: 'Mar', revenue: 48000 },
        { name: 'Apr', revenue: 61000 },
        { name: 'May', revenue: 55000 },
        { name: 'Jun', revenue: 67000 },
    ];

    const expenses = [
        { category: 'Staff Salaries', amount: 25000, color: '#3b82f6' },
        { category: 'Facilities', amount: 12000, color: '#10b981' },
        { category: 'Equipment', amount: 5000, color: '#f59e0b' },
        { category: 'Travel', amount: 8000, color: '#ef4444' },
    ];

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl text-white font-display uppercase font-bold tracking-wider">Financial Overview</h2>
                    <p className="text-gray-400 text-sm">Fiscal Year 2025-2026</p>
                </div>
                <button className="btn-primary flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Download Report
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass-panel p-6 border-l-4 border-l-brand-green">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-brand-green/10 rounded-lg">
                            <TrendingUp className="w-6 h-6 text-brand-green" />
                        </div>
                        <span className="text-brand-green text-xs font-bold uppercase py-1 px-2 bg-brand-green/10 rounded">+12%</span>
                    </div>
                    <div className="space-y-1">
                        <p className="text-gray-400 text-xs uppercase font-bold tracking-wider">Total Revenue</p>
                        <h3 className="text-3xl text-white font-mono font-bold">$328,000</h3>
                    </div>
                </div>

                <div className="glass-panel p-6 border-l-4 border-l-brand-gold">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-brand-gold/10 rounded-lg">
                            <Users className="w-6 h-6 text-brand-gold" />
                        </div>
                        <span className="text-brand-gold text-xs font-bold uppercase py-1 px-2 bg-brand-gold/10 rounded">+45 New</span>
                    </div>
                    <div className="space-y-1">
                        <p className="text-gray-400 text-xs uppercase font-bold tracking-wider">Membership Fees</p>
                        <h3 className="text-3xl text-white font-mono font-bold">$185,500</h3>
                    </div>
                </div>

                <div className="glass-panel p-6 border-l-4 border-l-blue-500">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-500/10 rounded-lg">
                            <CreditCard className="w-6 h-6 text-blue-500" />
                        </div>
                        <span className="text-gray-400 text-xs font-bold uppercase py-1 px-2 bg-white/5 rounded">Pending</span>
                    </div>
                    <div className="space-y-1">
                        <p className="text-gray-400 text-xs uppercase font-bold tracking-wider">Outstanding Invoices</p>
                        <h3 className="text-3xl text-white font-mono font-bold">$12,450</h3>
                    </div>
                </div>

                <div className="glass-panel p-6 border-l-4 border-l-red-500">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-red-500/10 rounded-lg">
                            <PieChart className="w-6 h-6 text-red-500" />
                        </div>
                        <span className="text-red-500 text-xs font-bold uppercase py-1 px-2 bg-red-500/10 rounded">-2%</span>
                    </div>
                    <div className="space-y-1">
                        <p className="text-gray-400 text-xs uppercase font-bold tracking-wider">Monthly Burn</p>
                        <h3 className="text-3xl text-white font-mono font-bold">$48,200</h3>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Revenue Chart */}
                <div className="lg:col-span-2 glass-panel p-6">
                    <h3 className="text-xl text-white font-display uppercase font-bold mb-6">Revenue Trend</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={revenueData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value / 1000}k`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']}
                                />
                                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Expense Breakdown */}
                <div className="glass-panel p-6">
                    <h3 className="text-xl text-white font-display uppercase font-bold mb-6">Monthly Expenses</h3>
                    <div className="space-y-6">
                        {expenses.map((item, index) => (
                            <div key={index}>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-300">{item.category}</span>
                                    <span className="text-white font-bold">${item.amount.toLocaleString()}</span>
                                </div>
                                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full"
                                        style={{ width: `${(item.amount / 50000) * 100}%`, backgroundColor: item.color }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 p-4 bg-white/5 rounded-lg border border-dashed border-white/10">
                        <p className="text-center text-xs text-gray-400 italic">
                            "Recruitment budget is currently 15% underutilized. Consider increasing scout allocation."
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinancialView;
