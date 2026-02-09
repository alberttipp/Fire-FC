import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVoiceCommand } from '../context/VoiceCommandContext';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Dumbbell, ChevronDown, LogOut, MessageSquare, Calendar, DollarSign, ClipboardCheck, Mic, Bell, Camera, Tv, Car } from 'lucide-react';
import ClubView from '../components/dashboard/ClubView';
import TeamView from '../components/dashboard/TeamView';
import TrainingView from '../components/dashboard/TrainingView';
import ChatView from '../components/dashboard/ChatView';
import CalendarHub from '../components/dashboard/CalendarHub';
import FinancialView from '../components/dashboard/FinancialView';
import TryoutHub from '../components/dashboard/TryoutHub';
import GalleryView from '../components/dashboard/GalleryView';
import LiveScoringView from '../components/dashboard/LiveScoringView';
import CarpoolVolunteerView from '../components/dashboard/CarpoolVolunteerView';
import NotificationPanel from '../components/dashboard/NotificationPanel';
import { supabase } from '../supabaseClient';

const Dashboard = () => {
    const { user, profile, signOut } = useAuth(); // Added profile
    const navigate = useNavigate();
    const [currentView, setCurrentView] = useState('club');
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Voice command integration
    const voiceCommand = useVoiceCommand();

    // Fetch unread notification count
    useEffect(() => {
        const fetchUnreadCount = async () => {
            if (!user?.id) return;
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

        // Subscribe to new notifications
        const channel = supabase
            .channel('notifications')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user?.id}`
            }, () => {
                fetchUnreadCount();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

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
            case 'training': return <TrainingView />;
            case 'chat': return <ChatView />;
            case 'calendar': return <CalendarHub />;
            case 'gallery': return <GalleryView />;
            case 'live': return <LiveScoringView />;
            case 'carpool': return <CarpoolVolunteerView />;
            case 'financial': return <FinancialView />;
            case 'tryouts': return <TryoutHub />;
            default: return <ClubView />;
        }
    }

    // Check profile.role (Real User) or user.role (Demo User)
    const isManager = profile?.role === 'manager' || user?.role === 'manager';
    return (
        <div className="min-h-screen bg-brand-dark pb-20">
            {/* Top Navigation Bar */}
            <div className="sticky top-0 z-50 bg-brand-dark/95 backdrop-blur border-b border-white/10 px-6 py-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 flex items-center justify-center filter drop-shadow-[0_0_10px_rgba(59,130,246,0.4)]">
                            <img src="/branding/logo.png" alt="Rockford Fire FC" className="w-full h-full object-contain" />
                        </div>
                        <h1 className="hidden md:block text-2xl text-white font-display uppercase font-bold tracking-wider">
                            Rockford Fire <span className="text-brand-green">{isManager ? 'Director' : 'Coach'}</span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* View Switcher Dropdown (Styled as buttons for now for simplicity/touch) */}
                        <div className="hidden md:flex bg-white/5 rounded-lg p-1 border border-white/10">
                            <button
                                onClick={() => setCurrentView('club')}
                                className={`px-4 py-1.5 rounded-md text-sm font-display uppercase tracking-wider transition-all ${currentView === 'club' ? 'bg-brand-green text-brand-dark font-bold shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                Club
                            </button>
                            <button
                                onClick={() => setCurrentView('team')}
                                className={`px-4 py-1.5 rounded-md text-sm font-display uppercase tracking-wider transition-all ${currentView === 'team' ? 'bg-brand-green text-brand-dark font-bold shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                Team
                            </button>
                            <button
                                onClick={() => setCurrentView('training')}
                                className={`px-4 py-1.5 rounded-md text-sm font-display uppercase tracking-wider transition-all ${currentView === 'training' ? 'bg-brand-green text-brand-dark font-bold shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                Training
                            </button>
                            <button
                                onClick={() => setCurrentView('chat')}
                                className={`px-4 py-1.5 rounded-md text-sm font-display uppercase tracking-wider transition-all ${currentView === 'chat' ? 'bg-brand-green text-brand-dark font-bold shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                Chat
                            </button>
                            <button
                                onClick={() => setCurrentView('calendar')}
                                className={`px-4 py-1.5 rounded-md text-sm font-display uppercase tracking-wider transition-all ${currentView === 'calendar' ? 'bg-brand-green text-brand-dark font-bold shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                Schedule
                            </button>
                            <button
                                onClick={() => setCurrentView('gallery')}
                                className={`px-4 py-1.5 rounded-md text-sm font-display uppercase tracking-wider transition-all flex items-center gap-1 ${currentView === 'gallery' ? 'bg-brand-green text-brand-dark font-bold shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                <Camera className="w-3 h-3" /> Gallery
                            </button>
                            <button
                                onClick={() => setCurrentView('live')}
                                className={`px-4 py-1.5 rounded-md text-sm font-display uppercase tracking-wider transition-all flex items-center gap-1 ${currentView === 'live' ? 'bg-brand-green text-brand-dark font-bold shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                <Tv className="w-3 h-3" /> Live
                            </button>
                            <button
                                onClick={() => setCurrentView('carpool')}
                                className={`px-4 py-1.5 rounded-md text-sm font-display uppercase tracking-wider transition-all flex items-center gap-1 ${currentView === 'carpool' ? 'bg-brand-green text-brand-dark font-bold shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                <Car className="w-3 h-3" /> Carpool
                            </button>

                            {/* Manager Only Tabs */}
                            {isManager && (
                                <>
                                    <button
                                        onClick={() => setCurrentView('tryouts')}
                                        className={`px-4 py-1.5 rounded-md text-sm font-display uppercase tracking-wider transition-all flex items-center gap-1 ${currentView === 'tryouts' ? 'bg-brand-gold text-brand-dark font-bold shadow-lg' : 'text-brand-gold hover:text-white'}`}
                                    >
                                        <ClipboardCheck className="w-3 h-3" /> Tryouts
                                    </button>
                                    <button
                                        onClick={() => setCurrentView('financial')}
                                        className={`px-4 py-1.5 rounded-md text-sm font-display uppercase tracking-wider transition-all flex items-center gap-1 ${currentView === 'financial' ? 'bg-brand-gold text-brand-dark font-bold shadow-lg' : 'text-brand-gold hover:text-white'}`}
                                    >
                                        <DollarSign className="w-3 h-3" /> Money
                                    </button>
                                </>
                            )}
                        </div>

                        <button
                            onClick={() => navigate('/player-dashboard')}
                            className="text-xs text-brand-gold border border-brand-gold/30 px-3 py-1.5 rounded hover:bg-brand-gold/10 uppercase tracking-wider"
                        >
                            View as Player
                        </button>

                        {/* Mobile View Switcher */}
                        <div className="md:hidden relative">
                            <button
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="flex items-center gap-2 text-brand-green font-display font-bold uppercase border border-brand-green/30 px-3 py-1.5 rounded bg-brand-green/5"
                            >
                                {currentView.toUpperCase()} <ChevronDown className={`w-4 h-4 transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {mobileMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setMobileMenuOpen(false)} />
                                    <div className="absolute right-0 top-full mt-2 w-36 bg-gray-900 border border-white/10 rounded shadow-xl z-50 max-h-[70vh] overflow-y-auto">
                                        {[
                                            { id: 'club', label: 'Club' },
                                            { id: 'team', label: 'Team' },
                                            { id: 'training', label: 'Training' },
                                            { id: 'chat', label: 'Chat' },
                                            { id: 'calendar', label: 'Schedule' },
                                            { id: 'gallery', label: 'Gallery' },
                                            { id: 'live', label: 'Live' },
                                            { id: 'carpool', label: 'Carpool' },
                                        ].map(tab => (
                                            <button
                                                key={tab.id}
                                                onClick={() => { setCurrentView(tab.id); setMobileMenuOpen(false); }}
                                                className={`block w-full text-left px-4 py-2.5 text-sm uppercase ${currentView === tab.id ? 'text-brand-green bg-brand-green/10 font-bold' : 'text-gray-300 hover:bg-white/5'}`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                        {isManager && (
                                            <>
                                                <button onClick={() => { setCurrentView('tryouts'); setMobileMenuOpen(false); }} className={`block w-full text-left px-4 py-2.5 text-sm uppercase ${currentView === 'tryouts' ? 'text-brand-gold bg-brand-gold/10 font-bold' : 'text-brand-gold hover:bg-white/5'}`}>Tryouts</button>
                                                <button onClick={() => { setCurrentView('financial'); setMobileMenuOpen(false); }} className={`block w-full text-left px-4 py-2.5 text-sm uppercase ${currentView === 'financial' ? 'text-brand-gold bg-brand-gold/10 font-bold' : 'text-brand-gold hover:bg-white/5'}`}>Money</button>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Notification Bell */}
                        <button
                            onClick={() => setShowNotifications(true)}
                            className="relative text-gray-400 hover:text-white transition-colors p-1.5 rounded hover:bg-white/5"
                            title="Notifications"
                        >
                            <Bell className="w-5 h-5" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand-green text-brand-dark text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>

                        <button onClick={handleLogout} className="flex items-center gap-1.5 text-gray-400 hover:text-red-400 transition-colors px-2 py-1.5 rounded hover:bg-red-500/10" title="Logout">
                            <LogOut className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                {renderView()}
            </main>

            {/* Notification Panel */}
            {showNotifications && (
                <NotificationPanel
                    onClose={() => {
                        setShowNotifications(false);
                        // Refresh unread count
                        supabase
                            .from('notifications')
                            .select('*', { count: 'exact', head: true })
                            .eq('user_id', user?.id)
                            .eq('read', false)
                            .then(({ count }) => setUnreadCount(count || 0));
                    }}
                    onAutoGenerate={handleAutoGenerate}
                />
            )}
        </div>
    );
};

export default Dashboard;
