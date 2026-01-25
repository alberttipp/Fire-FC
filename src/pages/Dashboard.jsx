import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Dumbbell, ChevronDown, LogOut, MessageSquare, Calendar, DollarSign, ClipboardCheck, Shield } from 'lucide-react';
import ClubView from '../components/dashboard/ClubView';
import TeamView from '../components/dashboard/TeamView';
import TrainingView from '../components/dashboard/TrainingView';
import ChatView from '../components/dashboard/ChatView';
import CalendarHub from '../components/dashboard/CalendarHub';
import FinancialView from '../components/dashboard/FinancialView';
import TryoutHub from '../components/dashboard/TryoutHub';
import AdminPanel from '../components/AdminPanel';

const Dashboard = () => {
    const { user, profile, signOut } = useAuth(); // Added profile
    const navigate = useNavigate();
    const [currentView, setCurrentView] = useState('club');
    const [showAdminPanel, setShowAdminPanel] = useState(false);

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
            case 'financial': return <FinancialView />;
            case 'tryouts': return <TryoutHub />;
            default: return <ClubView />;
        }
    }

    // Check profile.role (Real User) or user.role (Demo User)
    const isManager = profile?.role === 'manager' || user?.role === 'manager';
    const isStaff = isManager || profile?.role === 'coach' || user?.role === 'coach';

    return (
        <div className="min-h-screen bg-brand-dark pb-20">
            {/* Top Navigation Bar */}
            <div className="sticky top-0 z-50 bg-brand-dark/95 backdrop-blur border-b border-white/10 px-6 py-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 flex items-center justify-center filter drop-shadow-[0_0_10px_rgba(204,255,0,0.4)]">
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

                        {/* Mobile View Switcher (Dropdown simplified) */}
                        <div className="md:hidden relative group">
                            <button className="flex items-center gap-2 text-brand-green font-display font-bold uppercase border border-brand-green/30 px-3 py-1.5 rounded bg-brand-green/5">
                                {currentView.toUpperCase()} <ChevronDown className="w-4 h-4" />
                            </button>
                            {/* Simple dropdown simulation for MVP */}
                            <div className="absolute right-0 top-full mt-2 w-32 bg-gray-900 border border-white/10 rounded shadow-xl hidden group-hover:block group-focus-within:block z-50">
                                <button onClick={() => setCurrentView('club')} className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/5 uppercase">Club</button>
                                <button onClick={() => setCurrentView('team')} className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/5 uppercase">Team</button>
                                <button onClick={() => setCurrentView('training')} className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/5 uppercase">Training</button>
                                <button onClick={() => setCurrentView('chat')} className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/5 uppercase">Chat</button>
                                <button onClick={() => setCurrentView('calendar')} className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/5 uppercase">Schedule</button>
                                {isManager && (
                                    <>
                                        <button onClick={() => setCurrentView('tryouts')} className="block w-full text-left px-4 py-2 text-sm text-brand-gold hover:bg-white/5 uppercase">Tryouts</button>
                                        <button onClick={() => setCurrentView('financial')} className="block w-full text-left px-4 py-2 text-sm text-brand-gold hover:bg-white/5 uppercase">Money</button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Admin Panel Button (Staff Only - Manager or Coach) */}
                        {isStaff && (
                            <button 
                                onClick={() => setShowAdminPanel(true)} 
                                className="text-red-400 hover:text-red-300 transition-colors p-1.5 rounded hover:bg-red-500/10" 
                                title="Admin Panel"
                            >
                                <Shield className="w-5 h-5" />
                            </button>
                        )}

                        <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 transition-colors" title="Logout">
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                {renderView()}
            </main>

            {/* Admin Panel Modal */}
            {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} />}
        </div>
    );
};

export default Dashboard;
