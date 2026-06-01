import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVoiceCommand } from '../context/VoiceCommandContext';
import { useNavigate } from 'react-router-dom';
import useBackGuard from '../hooks/useBackGuard';
import { LayoutDashboard, Users, Dumbbell, ChevronDown, LogOut, MessageSquare, Calendar, ClipboardCheck, Mic, Bell, Briefcase, FileText, Loader2, Eye, Target, Camera } from 'lucide-react';
import MobileBottomNav from '../components/MobileBottomNav';
import { supabase } from '../supabaseClient';
import { isStaff as isStaffRole } from '../constants/roles';

const PreviewPickerModal = lazy(() => import('../components/dashboard/PreviewPickerModal'));

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
    const { user, profile, signOut } = useAuth(); // Added profile
    const navigate = useNavigate();
    const [currentView, setCurrentView] = useState('club');
    const [hasPickedView, setHasPickedView] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showPreviewPicker, setShowPreviewPicker] = useState(false);

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
            case 'chat': return <ChatView />;
            case 'calendar': return <CalendarHub />;
            case 'gallery': return <GalleryView />;
            case 'live': return <LiveScoringView />;
            case 'carpool': return <CarpoolVolunteerView />;
            case 'rules': return <RulesView />;
            case 'notifications': return <NotificationsView />;
            case 'financial': return <FinancialView />;
            case 'tryouts': return <TryoutHub />;
            case 'coach_hq': return <CoachHQView onJumpToChat={() => pickView('chat')} />;
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
        if (isStaff) setCurrentView('coach_hq');
        setHasPickedView(true);
    }, [effectiveRole, isStaff, hasPickedView]);
    return (
        <div className="min-h-screen bg-brand-dark pb-20 overflow-x-hidden">
            {/* Top Navigation Bar */}
            <div className="sticky top-0 z-50 bg-brand-dark/95 backdrop-blur border-b border-white/10 px-3 sm:px-6 py-3 sm:py-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center filter drop-shadow-[0_0_10px_rgba(59,130,246,0.4)] shrink-0">
                            <img src="/branding/logo.png" alt="Rockford Fire FC" className="w-full h-full object-contain" />
                        </div>
                        <h1 className="hidden md:block text-2xl text-white font-display uppercase font-bold tracking-wider">
                            Rockford Fire <span className="text-brand-green">{isManager ? 'Director' : 'Coach'}</span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-6 shrink-0">
                        {/* View Switcher Dropdown (Styled as buttons for now for simplicity/touch) */}
                        <div className="hidden md:flex bg-white/5 rounded-lg p-1 border border-white/10">
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
                                onClick={() => pickView('idp')}
                                className={`px-4 py-1.5 rounded-md text-sm font-display uppercase tracking-wider transition-all flex items-center gap-1 ${currentView === 'idp' ? 'bg-brand-gold text-brand-dark font-bold shadow-lg' : 'text-brand-gold/80 hover:text-brand-gold'}`}
                            >
                                <Target className="w-3 h-3" /> Player Plans
                            </button>
                            <button
                                onClick={() => pickView('private')}
                                className={`px-4 py-1.5 rounded-md text-sm font-display uppercase tracking-wider transition-all flex items-center gap-1 ${currentView === 'private' ? 'bg-brand-gold text-brand-dark font-bold shadow-lg' : 'text-brand-gold/70 hover:text-brand-gold'}`}
                            >
                                <Briefcase className="w-3 h-3" /> Private
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
                            <button
                                onClick={() => pickView('gallery')}
                                className={`px-4 py-1.5 rounded-md text-sm font-display uppercase tracking-wider transition-all flex items-center gap-1 ${currentView === 'gallery' ? 'bg-brand-green text-brand-dark font-bold shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                <Camera className="w-3 h-3" /> Gallery
                            </button>
                            <button
                                onClick={() => pickView('notifications')}
                                className={`px-4 py-1.5 rounded-md text-sm font-display uppercase tracking-wider transition-all flex items-center gap-1 ${currentView === 'notifications' ? 'bg-brand-green text-brand-dark font-bold shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                title="Push notifications + device management"
                            >
                                <Bell className="w-3 h-3" /> Alerts
                            </button>
                            {/* Live / Carpool still hidden until tested with real team. */}

                            {/* Manager Only Tabs */}
                            {isManager && (
                                <>
                                    <button
                                        onClick={() => pickView('tryouts')}
                                        className={`px-4 py-1.5 rounded-md text-sm font-display uppercase tracking-wider transition-all flex items-center gap-1 ${currentView === 'tryouts' ? 'bg-brand-gold text-brand-dark font-bold shadow-lg' : 'text-brand-gold hover:text-white'}`}
                                    >
                                        <ClipboardCheck className="w-3 h-3" /> Tryouts
                                    </button>
                                </>
                            )}
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
                                            { id: 'idp', label: 'Player Plans' },
                                            { id: 'private', label: 'Private Training' },
                                            { id: 'chat', label: 'Chat' },
                                            { id: 'calendar', label: 'Schedule' },
                                            { id: 'rules', label: 'Rules' },
                                            { id: 'gallery', label: 'Gallery' },
                                            // live / carpool still hidden — re-add when those features are tested
                                        ].map(tab => (
                                            <button
                                                key={tab.id}
                                                onClick={() => { pickView(tab.id); setMobileMenuOpen(false); }}
                                                className={`block w-full text-left px-4 py-2.5 text-sm uppercase ${currentView === tab.id ? 'text-brand-green bg-brand-green/10 font-bold' : 'text-gray-300 hover:bg-white/5'}`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                        {isManager && (
                                            <>
                                                <button onClick={() => { pickView('tryouts'); setMobileMenuOpen(false); }} className={`block w-full text-left px-4 py-2.5 text-sm uppercase ${currentView === 'tryouts' ? 'text-brand-gold bg-brand-gold/10 font-bold' : 'text-brand-gold hover:bg-white/5'}`}>Tryouts</button>
                                            </>
                                        )}
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
                <Suspense fallback={<ViewLoader />}>
                    {renderView()}
                </Suspense>
            </main>

            {/* Mobile Bottom Nav */}
            <MobileBottomNav
                currentView={currentView}
                onViewChange={pickView}
                onLogout={handleLogout}
                extraItems={[
                    ...(isStaff ? [{ id: 'coach_hq', label: 'Coach HQ', icon: LayoutDashboard }] : []),
                    { id: 'notifications', label: 'Alerts', icon: Bell },
                    ...(isManager ? [
                        { id: 'tryouts', label: 'Tryouts', icon: ClipboardCheck },
                    ] : []),
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
        </div>
    );
};

export default Dashboard;
