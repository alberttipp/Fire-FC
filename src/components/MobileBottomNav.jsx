import React, { useState } from 'react';
import { LayoutDashboard, Users, Dumbbell, Calendar, MoreHorizontal, X, MessageSquare, Camera, Tv, Car, Briefcase, Settings } from 'lucide-react';

const MobileBottomNav = ({ currentView, onViewChange, extraItems = [] }) => {
    const [showMore, setShowMore] = useState(false);

    const mainItems = [
        { id: 'club', label: 'Club', icon: LayoutDashboard },
        { id: 'team', label: 'Team', icon: Users },
        { id: 'practice', label: 'Practice', icon: Dumbbell },
        { id: 'calendar', label: 'Schedule', icon: Calendar },
    ];

    const moreItems = [
        { id: 'private', label: 'Private Training', icon: Briefcase },
        { id: 'chat', label: 'Messages', icon: MessageSquare },
        { id: 'gallery', label: 'Gallery', icon: Camera },
        { id: 'live', label: 'Live Scoring', icon: Tv },
        { id: 'carpool', label: 'Carpool', icon: Car },
        ...extraItems,
    ];

    const handleSelect = (id) => {
        onViewChange(id);
        setShowMore(false);
    };

    const isMoreActive = moreItems.some(item => item.id === currentView);

    return (
        <>
            {/* More menu overlay */}
            {showMore && (
                <div className="fixed inset-0 z-[90] md:hidden" onClick={() => setShowMore(false)}>
                    <div className="absolute bottom-[72px] left-0 right-0 bg-brand-dark/98 backdrop-blur-lg border-t border-white/10 rounded-t-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-center pt-2 pb-1">
                            <div className="w-10 h-1 bg-white/20 rounded-full" />
                        </div>
                        <div className="grid grid-cols-3 gap-1 p-4 pb-2">
                            {moreItems.map(item => {
                                const Icon = item.icon;
                                const active = currentView === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => handleSelect(item.id)}
                                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors min-h-[64px] ${
                                            active ? 'bg-brand-green/15 text-brand-green' : 'text-gray-400 hover:bg-white/5'
                                        }`}
                                    >
                                        <Icon className="w-6 h-6" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom nav bar */}
            <nav className="fixed bottom-0 left-0 right-0 z-[80] md:hidden bg-brand-dark/95 backdrop-blur-lg border-t border-white/10" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                <div className="flex items-stretch">
                    {mainItems.map(item => {
                        const Icon = item.icon;
                        const active = currentView === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => handleSelect(item.id)}
                                className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] transition-colors ${
                                    active ? 'text-brand-green' : 'text-gray-500'
                                }`}
                            >
                                <Icon className="w-5 h-5" />
                                <span className="text-[9px] font-bold uppercase tracking-wider">{item.label}</span>
                                {active && <div className="w-1 h-1 rounded-full bg-brand-green" />}
                            </button>
                        );
                    })}
                    <button
                        onClick={() => setShowMore(!showMore)}
                        className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] transition-colors ${
                            showMore || isMoreActive ? 'text-brand-green' : 'text-gray-500'
                        }`}
                    >
                        {showMore ? <X className="w-5 h-5" /> : <MoreHorizontal className="w-5 h-5" />}
                        <span className="text-[9px] font-bold uppercase tracking-wider">More</span>
                        {isMoreActive && !showMore && <div className="w-1 h-1 rounded-full bg-brand-green" />}
                    </button>
                </div>
            </nav>
        </>
    );
};

export default MobileBottomNav;
