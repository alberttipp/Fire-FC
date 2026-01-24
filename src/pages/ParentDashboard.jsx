import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, MessageSquare, CreditCard, LogOut, User } from 'lucide-react';
import PlayerCard from '../components/player/PlayerCard';
import CalendarHub from '../components/dashboard/CalendarHub';
import ChatView from '../components/dashboard/ChatView';
import PlayerEvaluationModal from '../components/dashboard/PlayerEvaluationModal';

const ParentDashboard = () => {
    const { signOut } = useAuth();
    const navigate = useNavigate();
    const [currentView, setCurrentView] = useState('overview'); // overview, schedule, messages, billing
    const [showDetails, setShowDetails] = useState(false);

    // Mock Child Data
    const child = {
        name: "Bo Tipp",
        number: "58",
        position: "RW",
        rating: 91,
        pace: 93,
        shooting: 88,
        passing: 86,
        dribbling: 92,
        defending: 55,
        physical: 80,
        messiMode: true, // DEMO: Unlocked
        image: "/players/bo_official.png"
    };

    const handleLogout = async () => {
        await signOut();
        navigate('/login');
    };

    const renderView = () => {
        switch (currentView) {
            case 'schedule': return <CalendarHub />;
            case 'messages': return <ChatView />;
            case 'billing':
                return (
                    <div className="glass-panel p-8 max-w-2xl mx-auto text-center space-y-6">
                        <div className="w-16 h-16 bg-brand-green/10 rounded-full flex items-center justify-center mx-auto">
                            <CreditCard className="w-8 h-8 text-brand-green" />
                        </div>
                        <h2 className="text-2xl text-white font-display uppercase">Billing Center</h2>
                        <div className="bg-white/5 p-6 rounded-xl border border-white/10 text-left">
                            <h3 className="text-gray-400 text-xs uppercase font-bold mb-4">Current Balance</h3>
                            <div className="flex justify-between items-end">
                                <span className="text-4xl text-white font-mono">$0.00</span>
                                <span className="text-brand-green text-xs font-bold uppercase py-1 px-2 bg-brand-green/10 rounded">Paid in Full</span>
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm">No upcoming invoices.</p>
                    </div>
                );
            case 'overview':
            default:
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <h3 className="text-xl text-white font-display uppercase tracking-wider flex items-center gap-2">
                                <User className="w-5 h-5 text-brand-gold" /> Player Profile
                            </h3>
                            <div className="transform scale-90 origin-top-left sm:scale-100 group cursor-pointer relative" onClick={() => setShowDetails(true)}>
                                <div className="absolute -top-6 left-0 w-full text-center text-brand-green text-xs font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity animate-pulse">
                                    Click for Report Card
                                </div>
                                <PlayerCard player={child} onClick={() => setShowDetails(true)} />
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Quick Attendance Stats */}
                            <div className="glass-panel p-6">
                                <h3 className="text-gray-400 text-xs uppercase font-bold mb-4">Attendance Rate</h3>
                                <div className="flex items-center gap-4">
                                    <div className="relative w-24 h-24">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-800" />
                                            <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="251.2" strokeDashoffset="12.56" className="text-brand-green" />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center text-white font-bold">95%</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-sm text-white">42 Practices Attended</div>
                                        <div className="text-sm text-gray-500">2 Missed</div>
                                    </div>
                                </div>
                            </div>

                            {/* Recent Feedback Teaser */}
                            <div className="glass-panel p-6 border-l-4 border-l-brand-gold">
                                <h3 className="text-brand-gold text-xs uppercase font-bold mb-2">Latest Coach Feedback</h3>
                                <p className="text-white text-sm italic mb-2">"Bo has been excellent in transition drills. We're working on his recovery runs."</p>
                                <button
                                    onClick={() => setCurrentView('messages')}
                                    className="text-xs text-gray-400 underline hover:text-white"
                                >
                                    View Full Conversation
                                </button>
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-brand-dark pb-20">
            {/* Navbar */}
            <div className="sticky top-0 z-50 bg-brand-dark/95 backdrop-blur border-b border-white/10 px-6 py-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 flex items-center justify-center filter drop-shadow-md">
                            <img src="/branding/logo.png" alt="Rockford Fire FC" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <h1 className="text-xl text-white font-display uppercase font-bold tracking-wider leading-none">
                                Rockford Fire <span className="text-blue-500">Family</span>
                            </h1>
                            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Fire FC App</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden md:flex bg-white/5 rounded-lg p-1 border border-white/10">
                            {[
                                { id: 'overview', label: 'Overview', icon: LayoutDashboard },
                                { id: 'schedule', label: 'Schedule', icon: Calendar },
                                { id: 'messages', label: 'Messages', icon: MessageSquare },
                                { id: 'billing', label: 'Billing', icon: CreditCard },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setCurrentView(tab.id)}
                                    className={`px-4 py-1.5 rounded-md text-sm font-display uppercase tracking-wider transition-all flex items-center gap-2 ${currentView === tab.id
                                        ? 'bg-blue-600 text-white font-bold shadow-lg'
                                        : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    <tab.icon className="w-3 h-3" /> {tab.label}
                                </button>
                            ))}
                        </div>

                        <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 transition-colors">
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Player Details Modal */}
            {showDetails && (
                <PlayerEvaluationModal
                    player={child}
                    onClose={() => setShowDetails(false)}
                    readOnly={true}
                />
            )}

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                {renderView()}
            </main>
        </div>
    );
};

export default ParentDashboard;
