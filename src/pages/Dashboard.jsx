import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVoiceCommand } from '../context/VoiceCommandContext';
import { useNavigate } from 'react-router-dom';
import useBackGuard from '../hooks/useBackGuard';
import LiveGameBanner from '../components/dashboard/LiveGameBanner';
import { LayoutDashboard, Users, Dumbbell, ChevronDown, LogOut, MessageSquare, Calendar, ClipboardCheck, Mic, Bell, Briefcase, FileText, Loader2, Eye, Target, Camera, Trophy } from 'lucide-react';
import MobileBottomNav from '../components/MobileBottomNav';
import TeamSwitcher from '../components/TeamSwitcher';
import { supabase } from '../supabaseClient';
import { isStaff as isStaffRole } from '../constants/roles';
import { useBranding } from '../context/BrandingContext';
import SponsorSlot from '../components/sponsors/SponsorSlot';
import NetworkSponsorSlot from '../components/sponsors/NetworkSponsorSlot';

const PreviewPickerModal = lazy(() => import('../components/dashboard/PreviewPickerModal'));
const OnboardingWizard = lazy(() => import('../components/onboarding/OnboardingWizard'));

// Lazy-load every tab view so the initial Dashboard bundle is small.
// Each view is its own chunk; users only download the ones they actually
// open. ClubView is the default landing view but still lazy — Suspense
// fallback covers the ~100ms first-load.
const ClubView = lazy(() => import('../components/dashboard/ClubView'));
const TeamView = lazy(() => import('../components/dashboard/TeamView'));
const TrainingView = lazy(() => import('../components/dashboard/TrainingView'));
const PrivateTrainingView = lazy(() => import('../components/dashboard/PrivateTrainingView'));
const ChatView = lazy(() => import('../components/dashboard/ChatView'));
const CalendarHub = lazy(() => import('../components/dashboard/CalendarHub'));
const FinancialView = lazy(() => import('../components/dashboard/FinancialView'));
const TryoutHub = lazy(() => import('../components/dashboard/TryoutHub'));
const GalleryView = lazy(() => import('../components/dashboard/GalleryView'));
const LiveScoringView = lazy(() => import('../components/dashboard/LiveScoringView'));
const CarpoolVolunteerView = lazy(() => import('../components/dashboard/CarpoolVolunteerView'));
const RulesView = lazy(() => import('../components/dashboard/RulesView'));
const NotificationsView = lazy(() => import('../components/notifications/NotificationsView'));
const NotificationPanel = lazy(() => import('../components/dashboard/NotificationPanel'));
const IDPHub = lazy(() => import('../components/dashboard/IDPHub'));
const CoachHQView = lazy(() => import('../components/coach-hq/CoachHQView'));

const ViewLoader = () => (
    <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-brand-green animate-spin" />
    </div>
);

const Dashboard = () => {
    const { user, profile, session, signOut } = useAuth(); // Added profile
    const navigate = useNavigate();
    const brand = useBranding();
    const [currentView, setCurrentView] = useState('club');
    // Deep link from a push notification: ?view=&conv=&event=
    const [deepLink] = useState(() => {
        const p = new URLSearchParams(window.location.search);
        return { view: p.get('view'), conv: p.get('conv'), event: p.get('event') };
    });
    const [hasPickedView, setHasPickedView] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showPreviewPicker, setShowPreviewPicker] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);
    // Active team (name + age group) for the header — a coach running U11 AND
    // U12 squads must always see which team they're looking at.
    const [activeTeam, setActiveTeam] = useState(null);

    useEffect(() => {
        if (!profile?.team_id) { setActiveTeam(null); return; }
        let cancelled = false;
        (async () => {
            const { data } = await supabase
                .from('teams')
                .select('name, age_group')
                .eq('id', profile.team_id)
                .maybeSingle();
            if (!cancelled && data) setActiveTeam(data);
        })();
        return () => { cancelled = true; };
    }, [profile?.team_id]);

    // Lock the body's scroll while a top-level overlay is open so the
    // dashboard behind it doesn't drift when the user interacts with it.
    useEffect(() => {
        const anyOpen = showNotifications || showPreviewPicker;
        if (!anyOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [showNotifications, showPreviewPicker]);

    // Close any open top-level overlay when the user switches tabs, so
    // the overlay doesn't stay mounted on top of the new view.
    useEffect(() => {
        setShowNotifications(false);
        setShowPreviewPicker(false);
        setMobileMenuOpen(false);
    }, [currentView]);

    // Track a wrapper so a button click prevents the staff default from
    // overriding the user's pick after profile loads late.
    // Track visited views so the back button can step back through them.
    const viewHistory = useRef([]);
    const pickView = (v) => {
        if (v !== currentView) viewHistory.current.push(currentView);
        setHasPickedView(true);
        setCurrentView(v);
    };

    // Phone back button → close an open overlay, else step back one tab, else
    // (at the home tab) let the app exit. Never dumps the user on login.
    useBackGuard(() => {
        if (showPreviewPicker) { setShowPreviewPicker(false); return true; }
        if (showNotifications) { setShowNotifications(false); return true; }
        if (mobileMenuOpen) { setMobileMenuOpen(false); return true; }
        if (viewHistory.current.length > 0) {
            setCurrentView(viewHistory.current.pop());
            return true;
        }
        return false;
    });

    // Voice command integration
    const voiceCommand = useVoiceCommand();

    // Fetch unread notification count
    useEffect(() => {
        // Guard against teardown / signed-out states. Without this, the
        // channel below subscribes with filter `user_id=eq.undefined` on
        // signout and leaves a dangling subscription with no clean way
        // to remove it — contributed to the 2026-05-22 logout regression.
        if (!user?.id) {
            setUnreadCount(0);
            return;
        }

        const fetchUnreadCount = async () => {
            const { count, error } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('read', false);

            if (!error) {
                setUnreadCount(count || 0);
            }
        };

        fetchUnreadCount();

        const channel = supabase
            .channel(`notifications:${user.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, () => {
                fetchUnreadCount();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    // Handle auto-generate from notification
    const handleAutoGenerate = (actionData) => {
        // Navigate to training view which has the assignment modal
        setCurrentView('training');
        // The training view will need to handle opening the modal with auto-generate
    };

    // Register dashboard controls with voice command system
    useEffect(() => {
        if (voiceCommand?.registerDashboardControls) {
            voiceCommand.registerDashboardControls(setCurrentView);
        }
    }, [voiceCommand]);

    // Weekly auto-clear: trigger on Sunday/Monday for coach/manager
    useEffect(() => {
        const checkWeeklyClear = async () => {
            if (!user?.id) return;
            const role = profile?.role;
            if (role !== 'coach' && role !== 'manager') return;

            const today = new Date();
            const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon
            if (dayOfWeek > 1) return; // Only check Sun/Mon

            const lastCheck = localStorage.getItem('last_weekly_clear_check');
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - dayOfWeek);
            weekStart.setHours(0, 0, 0, 0);

            if (lastCheck && new Date(lastCheck) >= weekStart) return;

            console.log('[Dashboard] Running weekly clear check...');
            try {
                const { data, error } = await supabase.rpc('clear_weekly_assignments');
                if (error) {
                    console.error('[Dashboard] Weekly clear error:', error);
                } else {
                    console.log('[Dashboard] Weekly clear result:', data);
                }
                localStorage.setItem('last_weekly_clear_check', new Date().toISOString());
            } catch (err) {
                console.error('[Dashboard] Weekly clear failed:', err);
            }
        };

        checkWeeklyClear();
    }, [user?.id, profile?.role]);

    const handleLogout = async () => {
        await signOut();
        navigate('/login');
    }

    const renderView = () => {
        switch (currentView) {
            case 'club': return <ClubView />;
            case 'team': return <TeamView />;
            case 'practice': return <TrainingView />;
            case 'idp': return <IDPHub />;
            case 'private': return <PrivateTrainingView />;
            case 'chat': return <ChatView initialConversationId={deepLink.conv} />;
            case 'calendar': return <CalendarHub initialEventId={deepLink.event} />;
            case 'gallery': return <GalleryView />;
            case 'live': return <LiveScoringView />;
            case 'carpool': return <CarpoolVolunteerView />;
            case 'rules': return <RulesView />;
            case 'notifications': return <NotificationsView />;
            case 'financial': return <FinancialView />;
            case 'tryouts': return <TryoutHub />;
            case 'coach_hq': return <CoachHQView onJumpToChat={() => pickView('chat')} onJumpToTeam={() => pickView('team')} />;
            default: return <ClubView />;
        }
    }

    // Check profile.role (Real User) or user.role (Demo User)
    const isManager = profile?.role === 'manager' || user?.role === 'manager';
    const effectiveRole = profile?.role || user?.role;
    const isStaff = isStaffRole(effectiveRole);

    // Staff land on Coach HQ instead of Club by default. Wait until profile
    // is resolved so we don't flicker. Set hasPickedView once applied so
    // the effect never re-fires and a later click on 'Club' isn't reverted.
    useEffect(() => {
        if (!effectiveRole || hasPickedView) return;
        // A parent/player can land here from a notification deep link (the SW
        // navigates to the URL the trigger emitted). Send them to their own
        // dashboard, carrying the ?view=&conv=&event= params so it deep-links.
        if (!isStaff) {
            const dest = effectiveRole === 'player' ? '/player-dashboard' : '/parent-dashboard';
            navigate(dest + window.location.search, { replace: true });
            return;
        }
        // Staff: honor the deep-linked view, else default to Coach HQ.
        setCurrentView(deepLink.view || 'coach_hq');
        setHasPickedView(true);
    }, [effectiveRole, isStaff, hasPickedView]);

    // Self-serve onboarding wizard — auto-opens ONLY for a brand-new club:
    // a real signed-in staff account with NO team in scope. profile.team_id is
    // the existing signal AuthContext resolves from team_memberships, so any
    // established club's staff (e.g. Rockford) always has one and NEVER sees
    // this. Requiring a real Supabase session also excludes demo/kid-mode
    // virtual users. Dismissable; TeamView's empty state re-opens it manually.
    useEffect(() => {
        if (!session?.user || !isStaff) return;
        if (profile?.team_id) return; // has a team — established club
        try {
            if (localStorage.getItem('ff_onboarding_dismissed') === '1') return;
        } catch (_) { /* localStorage blocked — don't auto-open */ return; }
        setShowOnboarding(true);
    }, [session?.user, isStaff, profile?.team_id]);
    return (
        <div className="min-h-screen bg-brand-dark pb-20 overflow-x-hidden">
            {/* Top Navigation Bar */}
            <div className="sticky top-0 z-50 bg-brand-dark/95 backdrop-blur border-b border-white/10 px-3 sm:px-6 py-3 sm:py-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center gap-2">
                    {/* Brand lockup: fixed-size crest + two-line identity that
                        truncates instead of colliding with the nav. Line 1 = club
                        name, line 2 = role + active team + age group so a coach
                        running multiple squads always knows which team this is. */}
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <div className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 flex items-center justify-center">
                            <img src={brand.logoUrl} alt={brand.shortName} className="max-h-full max-w-full object-contain drop-shadow-[0_0_10px_rgba(59,130,246,0.4)]" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-sm sm:text-base lg:text-lg text-white font-display uppercase font-bold tracking-wide leading-tight truncate" title={brand.name}>
                                {brand.name}
                            </h1>
                            <p className="text-[10px] sm:text-[11px] uppercase tracking-widest font-bold leading-tight truncate">
                                <span className="text-brand-green">{isManager ? 'Director' : 'Coach'}</span>
                                <TeamSwitcher fallbackName={activeTeam?.name} fallbackAge={activeTeam?.age_group} />
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 shrink-0 max-w-[75%]">
                        {/* View Switcher Dropdown (Styled as buttons for now for simplicity/touch).
                            min-w-0 + overflow-x-auto: on narrower laptops the row scrolls
                            instead of overlapping the brand lockup. */}
                        <div className="hidden md:flex bg-white/5 rounded-lg p-1 border border-white/10 min-w-0 overflow-x-auto no-scrollbar [&>button]:whitespace-nowrap [&>button]:shrink-0">
                            {isStaff && (
                                <button
                                    onClick={() => pickView('coach_hq')}
                                    className={`px-4 py-1.5 rounded-md text-sm font-display uppercase tracking-wider transition-all flex items-center gap-1 ${currentView === 'coach_hq' ? 'bg-brand-green text-brand-dark font-bold shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                >
                                    <LayoutDashboard className="w-3 h-3" /> Coach HQ
                                </button>
                            )}
                            <button
                                onClick={() => pickView('club')}
                                className={`px-4 py-1.5 rounded-md text-sm font-display uppercase tracking-wider transition-all ${currentView === 'club' ? 'bg-brand-green text-brand-dark font-bold shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                Club
                            </button>
                            <button
                                onClick={() => pickView('team')}
                                className={`px-4 py-1.5 rounded-md text-sm font-display uppercase tracking-wider transition-all ${currentView === 'team' ? 'bg-brand-green text-brand-dark font-bold shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                Team
                            </button>
                            <button
                                onClick={() => pickView('practice')}
                                className={`px-4 py-1.5 rounded-md text-sm font-display uppercase tracking-wider transition-all flex items-center gap-1 ${currentView === 'practice' ? 'bg-brand-green text-brand-dark font-bold shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                <Dumbbell className="w-3 h-3" /> Development
                            </button>
                            <button
                                onClick={() => pickView('chat')}
                                className={`px-4 py-1.5 rounded-md text-sm font-display uppercase tracking-wider transition-all ${currentView === 'chat' ? 'bg-brand-green text-brand-dark font-bold shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                Chat
                            </button>
                            <button
                                onClick={() => pickView('calendar')}
                                className={`px-4 py-1.5 rounded-md text-sm font-display uppercase tracking-wider transition-all ${currentView === 'calendar' ? 'bg-brand-green text-brand-dark font-bold shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                Schedule
                            </button>
                            <button
                                onClick={() => pickView('rules')}
                                className={`px-4 py-1.5 rounded-md text-sm font-display uppercase tracking-wider transition-all flex items-center gap-1 ${currentView === 'rules' ? 'bg-brand-green text-brand-dark font-bold shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                <FileText className="w-3 h-3" /> Rules
                            </button>
                            {/* Alerts removed from nav (the top-right bell covers it);
                                Tryouts hidden (season passed; the club uses BYGA for it). */}
                        </div>

                        <button
                            onClick={() => setShowPreviewPicker(true)}
                            className="text-xs text-brand-gold border border-brand-gold/30 px-2 sm:px-3 py-1.5 rounded hover:bg-brand-gold/10 uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5 shrink-0"
                            title="Preview the parent or player view of any player on your teams"
                        >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Preview as…</span>
                        </button>

                        {/* Mobile View Switcher — abbreviated when navbar is tight */}
                        <div className="md:hidden relative shrink-0">
                            <button
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="flex items-center gap-1 text-brand-green font-display font-bold uppercase border border-brand-green/30 px-2 py-1.5 rounded bg-brand-green/5 text-xs"
                            >
                                <span className="max-w-[60px] truncate">{currentView.toUpperCase()}</span>
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform shrink-0 ${mobileMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {mobileMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setMobileMenuOpen(false)} />
                                    <div className="absolute right-0 top-full mt-2 w-36 bg-gray-900 border border-white/10 rounded shadow-xl z-50 max-h-[70vh] overflow-y-auto">
                                        {[
                                            ...(isStaff ? [{ id: 'coach_hq', label: 'Coach HQ' }] : []),
                                            { id: 'club', label: 'Club' },
                                            { id: 'team', label: 'Team' },
                                            { id: 'practice', label: 'Development' },
                                            { id: 'chat', label: 'Chat' },
                                            { id: 'calendar', label: 'Schedule' },
                                            { id: 'rules', label: 'Rules' },
                                            // Player Plans / Private / Live / Gallery pruned from nav
                                            // (0-usage per the Aug audit); routes still exist.
                                        ].map(tab => (
                                            <button
                                                key={tab.id}
                                                onClick={() => { pickView(tab.id); setMobileMenuOpen(false); }}
                                                className={`block w-full text-left px-4 py-2.5 text-sm uppercase ${currentView === tab.id ? 'text-brand-green bg-brand-green/10 font-bold' : 'text-gray-300 hover:bg-white/5'}`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Notification Bell — hide on smallest screens; users
                            still get the alert badge on the More tab if needed */}
                        <button
                            onClick={() => setShowNotifications(true)}
                            className="hidden xs:flex sm:flex relative text-gray-400 hover:text-white transition-colors p-1.5 rounded hover:bg-white/5 shrink-0"
                            title="Notifications"
                        >
                            <Bell className="w-5 h-5" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand-green text-brand-dark text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>

                        <button onClick={handleLogout} className="flex items-center gap-1 text-gray-400 hover:text-red-400 transition-colors px-2 py-1.5 rounded hover:bg-red-500/10 shrink-0" title="Logout">
                            <LogOut className="w-4 h-4 shrink-0" />
                            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider">Logout</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-[calc(8rem+env(safe-area-inset-bottom))] md:pb-8">
                {/* Title sponsor "presented by" strip — renders nothing until a sponsor exists */}
                <SponsorSlot tier="title" placement="coach_dashboard" className="mb-4" />
                {currentView !== 'live' && <LiveGameBanner onOpen={() => pickView('live')} />}
                <Suspense fallback={<ViewLoader />}>
                    {renderView()}
                </Suspense>
                {/* Community sponsor footer strip */}
                <SponsorSlot tier="community" placement="coach_dashboard_footer" className="mt-6 justify-center" />
                <NetworkSponsorSlot className="mt-4 justify-center" />
            </main>

            {/* Mobile Bottom Nav */}
            <MobileBottomNav
                currentView={currentView}
                onViewChange={pickView}
                onLogout={handleLogout}
                extraItems={[
                    ...(isStaff ? [{ id: 'coach_hq', label: 'Coach HQ', icon: LayoutDashboard }] : []),
                    // Alerts kept here for phones (the top-right bell hides on small screens);
                    // Tryouts hidden (season passed; club uses BYGA).
                    { id: 'notifications', label: 'Alerts', icon: Bell },
                ]}
            />

            {/* Notification Panel */}
            {showNotifications && (
                <Suspense fallback={null}>
                    <NotificationPanel
                        onClose={() => {
                            setShowNotifications(false);
                            supabase
                                .from('notifications')
                                .select('*', { count: 'exact', head: true })
                                .eq('user_id', user?.id)
                                .eq('read', false)
                                .then(({ count }) => setUnreadCount(count || 0));
                        }}
                        onAutoGenerate={handleAutoGenerate}
                    />
                </Suspense>
            )}

            {/* Preview Picker — coach/manager previews parent or player view */}
            {showPreviewPicker && (
                <Suspense fallback={null}>
                    <PreviewPickerModal onClose={() => setShowPreviewPicker(false)} />
                </Suspense>
            )}

            {/* Self-serve club onboarding wizard (new clubs only; portals to
                document.body internally, so it's never trapped by an ancestor). */}
            {showOnboarding && (
                <Suspense fallback={null}>
                    <OnboardingWizard onClose={() => setShowOnboarding(false)} />
                </Suspense>
            )}
        </div>
    );
};

export default Dashboard;
