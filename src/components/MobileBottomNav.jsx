import React, { useState } from 'react';
import { LayoutDashboard, Users, Dumbbell, Calendar, MoreHorizontal, X, MessageSquare, Camera, Tv, Car, Briefcase, Settings, FileText, LogOut, Target } from 'lucide-react';

const MobileBottomNav = ({
    currentView,
    onViewChange,
    extraItems = [],
    onLogout = null,
    // Optional overrides — when provided, replace the staff-default
    // mainItems / moreItems sets. Parent dashboard passes its own so the
    // bottom nav matches its tabs (Overview/Schedule/Messages + Gallery/Rules
    // in More) instead of staff tabs (Club/Team/Development).
    mainItems: mainItemsOverride,
    moreItems: moreItemsOverride,
}) => {
    const [showMore, setShowMore] = useState(false);

    const mainItems = mainItemsOverride || [
        { id: 'club', label: 'Club', icon: LayoutDashboard },
        { id: 'team', label: 'Team', icon: Users },
        { id: 'practice', label: 'Development', icon: Dumbbell },
        { id: 'calendar', label: 'Schedule', icon: Calendar },
    ];

    const moreItems = moreItemsOverride
        ? [...moreItemsOverride, ...extraItems]
        : [
            { id: 'idp', label: 'Player Plans', icon: Target },
            { id: 'private', label: 'Private Training', icon: Briefcase },
            { id: 'chat', label: 'Messages', icon: MessageSquare },
            { id: 'rules', label: 'Rules', icon: FileText },
            // Gallery / Live Scoring / Carpool intentionally hidden until those
            // features are tested with a real team. Re-add the entries here when
            // ready — components and routes are still wired up in Dashboard.jsx.
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
                                // Items can either navigate (id) or fire a callback (action) — used
                                // for things like "Invite another parent" which open a modal instead
                                // of switching views.
                                const onTap = item.action
                                    ? () => { setShowMore(false); item.action(); }
                                    : () => handleSelect(item.id);
                                return (
                                    <button
                                        key={item.id}
                                        onClick={onTap}
                                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors min-h-[64px] ${
                                            active ? 'bg-brand-green/15 text-brand-green' : 'text-gray-400 hover:bg-white/5'
                                        }`}
                                    >
                                        <Icon className="w-6 h-6" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
                                    </button>
                                );
                            })}
                            {/* Defensive logout entry — accessible from the mobile More
                                menu in addition to the navbar button, so the user can
                                always reach signout regardless of where they are. */}
                            {onLogout && (
                                <button
                                    onClick={() => { setShowMore(false); onLogout(); }}
                                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors min-h-[64px]"
                                >
                                    <LogOut className="w-6 h-6" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Logout</span>
                                </button>
                            )}
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
