import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, MessageSquare, CreditCard, LogOut, User, Loader2, Trophy, Clock, CheckCircle, AlertCircle, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';
import PlayerCard from '../components/player/PlayerCard';
import CalendarHub from '../components/dashboard/CalendarHub';
import ChatView from '../components/dashboard/ChatView';
import PlayerEvaluationModal from '../components/dashboard/PlayerEvaluationModal';

const ParentDashboard = () => {
    const { user, profile, signOut } = useAuth();
    const navigate = useNavigate();
    const [currentView, setCurrentView] = useState('overview');
    const [showDetails, setShowDetails] = useState(false);
    const [loading, setLoading] = useState(true);

    // Real data state
    const [children, setChildren] = useState([]);
    const [selectedChild, setSelectedChild] = useState(null);
    const [playerStats, setPlayerStats] = useState(null);
    const [playerBadges, setPlayerBadges] = useState([]);
    const [upcomingEvents, setUpcomingEvents] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [attendanceStats, setAttendanceStats] = useState({ attended: 0, missed: 0, rate: 0 });

    // Fetch children linked to parent
    useEffect(() => {
        if (user?.id) {
            fetchChildrenData();
        }
    }, [user?.id]);

    // Fetch selected child's details
    useEffect(() => {
        if (selectedChild?.id) {
            fetchChildDetails(selectedChild.id);
        }
    }, [selectedChild?.id]);

    const fetchChildrenData = async () => {
        setLoading(true);
        try {
            // First try to get linked children via family_links
            const { data: links } = await supabase
                .from('family_links')
                .select('player_id')
                .eq('parent_id', user.id);

            let playerIds = links?.map(l => l.player_id) || [];

            // If no links, try to find a default player (for demo)
            if (playerIds.length === 0) {
                // Get first player from default team for demo
                const { data: defaultPlayers } = await supabase
                    .from('players')
                    .select('id')
                    .eq('team_id', 'd02aba3e-3c30-430f-9377-3b334cffcd04')
                    .limit(1);

                if (defaultPlayers?.length > 0) {
                    playerIds = [defaultPlayers[0].id];
                }
            }

            if (playerIds.length > 0) {
                // Fetch full player data
                const { data: players } = await supabase
                    .from('players')
                    .select(`
                        *,
                        teams:team_id (name, age_group)
                    `)
                    .in('id', playerIds);

                if (players && players.length > 0) {
                    setChildren(players);
                    setSelectedChild(players[0]);
                }
            }
        } catch (err) {
            console.error('Error fetching children:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchChildDetails = async (playerId) => {
        try {
            // Fetch player stats
            const { data: stats } = await supabase
                .from('player_stats')
                .select('*')
                .eq('player_id', playerId)
                .single();

            setPlayerStats(stats);

            // Fetch badges
            const { data: badges } = await supabase
                .from('player_badges')
                .select(`
                    *,
                    badges:badge_id (*)
                `)
                .eq('player_id', playerId)
                .order('awarded_at', { ascending: false })
                .limit(5);

            setPlayerBadges(badges || []);

            // Fetch upcoming events
            const teamId = selectedChild?.team_id;
            if (teamId) {
                const { data: events } = await supabase
                    .from('events')
                    .select('*')
                    .eq('team_id', teamId)
                    .gte('start_time', new Date().toISOString())
                    .order('start_time', { ascending: true })
                    .limit(5);

                setUpcomingEvents(events || []);
            }

            // Fetch assignments
            const { data: assigns } = await supabase
                .from('assignments')
                .select(`
                    *,
                    drills:drill_id (title, skill, duration_minutes)
                `)
                .eq('player_id', playerId)
                .order('created_at', { ascending: false })
                .limit(5);

            setAssignments(assigns || []);

            // Calculate attendance (mock for now - would need attendance tracking table)
            // Using a reasonable estimate based on training_minutes
            const trainingMinutes = selectedChild?.training_minutes || 0;
            const estimatedPractices = Math.floor(trainingMinutes / 60);
            const attended = estimatedPractices > 0 ? estimatedPractices : 42;
            const missed = Math.floor(attended * 0.05); // 5% miss rate
            const rate = Math.round((attended / (attended + missed)) * 100);
            setAttendanceStats({ attended, missed, rate });

        } catch (err) {
            console.error('Error fetching child details:', err);
        }
    };

    const handleLogout = async () => {
        await signOut();
        navigate('/login');
    };

    // Format player data for PlayerCard component
    const formatPlayerForCard = (player) => {
        if (!player) return null;
        return {
            name: `${player.first_name} ${player.last_name}`,
            number: player.jersey_number?.toString() || '0',
            position: player.position || 'MF',
            rating: player.overall_rating || 50,
            pace: player.pace || 50,
            shooting: player.shooting || 50,
            passing: player.passing || 50,
            dribbling: player.dribbling || 50,
            defending: player.defending || 50,
            physical: player.physical || 50,
            messiMode: playerStats?.messi_mode_unlocked || false,
            image: player.avatar_url || `/players/${player.first_name?.toLowerCase()}_official.png`
        };
    };

    const renderView = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-green mx-auto mb-2" />
                        <p className="text-gray-400">Loading player data...</p>
                    </div>
                </div>
            );
        }

        if (!selectedChild) {
            return (
                <div className="glass-panel p-8 max-w-md mx-auto text-center space-y-4">
                    <Users className="w-12 h-12 text-gray-600 mx-auto" />
                    <h2 className="text-xl text-white font-bold">No Player Linked</h2>
                    <p className="text-gray-400 text-sm">
                        Your account is not linked to any players yet. Please contact your coach or team manager to link your child's profile.
                    </p>
                </div>
            );
        }

        switch (currentView) {
            case 'schedule':
                return <CalendarHub />;
            case 'messages':
                return <ChatView />;
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
                        {/* Left Column - Player Card */}
                        <div className="space-y-6">
                            <h3 className="text-xl text-white font-display uppercase tracking-wider flex items-center gap-2">
                                <User className="w-5 h-5 text-brand-gold" /> Player Profile
                            </h3>

                            {/* Child selector if multiple children */}
                            {children.length > 1 && (
                                <div className="flex gap-2 mb-4">
                                    {children.map(child => (
                                        <button
                                            key={child.id}
                                            onClick={() => setSelectedChild(child)}
                                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                                selectedChild?.id === child.id
                                                    ? 'bg-brand-green text-brand-dark'
                                                    : 'bg-white/10 text-gray-400 hover:bg-white/20'
                                            }`}
                                        >
                                            {child.first_name}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="transform scale-90 origin-top-left sm:scale-100 group cursor-pointer relative" onClick={() => setShowDetails(true)}>
                                <div className="absolute -top-6 left-0 w-full text-center text-brand-green text-xs font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity animate-pulse">
                                    Click for Report Card
                                </div>
                                <PlayerCard player={formatPlayerForCard(selectedChild)} onClick={() => setShowDetails(true)} />
                            </div>

                            {/* Recent Badges */}
                            {playerBadges.length > 0 && (
                                <div className="glass-panel p-4">
                                    <h4 className="text-gray-400 text-xs uppercase font-bold mb-3 flex items-center gap-2">
                                        <Trophy className="w-4 h-4 text-brand-gold" /> Recent Badges
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {playerBadges.map(pb => (
                                            <div
                                                key={pb.id}
                                                className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg"
                                                title={pb.badges?.description}
                                            >
                                                <span className="text-xl">{pb.badges?.icon}</span>
                                                <span className="text-xs text-white font-medium">{pb.badges?.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right Column - Stats & Info */}
                        <div className="space-y-6">
                            {/* Attendance Stats */}
                            <div className="glass-panel p-6">
                                <h3 className="text-gray-400 text-xs uppercase font-bold mb-4">Attendance Rate</h3>
                                <div className="flex items-center gap-4">
                                    <div className="relative w-24 h-24">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-800" />
                                            <circle
                                                cx="48" cy="48" r="40"
                                                stroke="currentColor"
                                                strokeWidth="8"
                                                fill="transparent"
                                                strokeDasharray="251.2"
                                                strokeDashoffset={251.2 - (251.2 * attendanceStats.rate / 100)}
                                                className="text-brand-green"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center text-white font-bold">{attendanceStats.rate}%</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-sm text-white">{attendanceStats.attended} Practices Attended</div>
                                        <div className="text-sm text-gray-500">{attendanceStats.missed} Missed</div>
                                    </div>
                                </div>
                            </div>

                            {/* Player Stats Summary */}
                            {playerStats && (
                                <div className="glass-panel p-6">
                                    <h3 className="text-gray-400 text-xs uppercase font-bold mb-4">Season Stats</h3>
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div>
                                            <div className="text-2xl text-white font-bold">{playerStats.games_played || 0}</div>
                                            <div className="text-xs text-gray-500">Games</div>
                                        </div>
                                        <div>
                                            <div className="text-2xl text-brand-green font-bold">{playerStats.goals || 0}</div>
                                            <div className="text-xs text-gray-500">Goals</div>
                                        </div>
                                        <div>
                                            <div className="text-2xl text-blue-400 font-bold">{playerStats.assists || 0}</div>
                                            <div className="text-xs text-gray-500">Assists</div>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                                        <span className="text-xs text-gray-500">XP Level</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-brand-gold rounded-full"
                                                    style={{ width: `${Math.min(100, (playerStats.xp || 0) % 1000 / 10)}%` }}
                                                />
                                            </div>
                                            <span className="text-brand-gold font-bold">Lv {playerStats.level || 1}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Upcoming Events */}
                            {upcomingEvents.length > 0 && (
                                <div className="glass-panel p-6">
                                    <h3 className="text-gray-400 text-xs uppercase font-bold mb-4 flex items-center gap-2">
                                        <Calendar className="w-4 h-4" /> Upcoming Events
                                    </h3>
                                    <div className="space-y-3">
                                        {upcomingEvents.slice(0, 3).map(event => {
                                            const date = new Date(event.start_time);
                                            return (
                                                <div key={event.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                                        event.type === 'game' ? 'bg-red-500/20 text-red-400' :
                                                        event.type === 'practice' ? 'bg-brand-green/20 text-brand-green' :
                                                        'bg-blue-500/20 text-blue-400'
                                                    }`}>
                                                        <span className="text-xs font-bold uppercase">{date.getDate()}</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="text-sm text-white font-medium">{event.title}</div>
                                                        <div className="text-xs text-gray-500">
                                                            {date.toLocaleDateString('en-US', { weekday: 'short' })} at {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                    {event.kit_color && (
                                                        <span className="text-xs text-gray-400 px-2 py-1 bg-white/10 rounded">
                                                            {event.kit_color}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <button
                                        onClick={() => setCurrentView('schedule')}
                                        className="w-full mt-3 text-xs text-gray-400 hover:text-white transition-colors"
                                    >
                                        View Full Schedule
                                    </button>
                                </div>
                            )}

                            {/* Homework/Assignments */}
                            {assignments.length > 0 && (
                                <div className="glass-panel p-6 border-l-4 border-l-brand-gold">
                                    <h3 className="text-brand-gold text-xs uppercase font-bold mb-3 flex items-center gap-2">
                                        <Clock className="w-4 h-4" /> Training Homework
                                    </h3>
                                    <div className="space-y-2">
                                        {assignments.slice(0, 3).map(assign => (
                                            <div key={assign.id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                                                <div>
                                                    <div className="text-sm text-white">{assign.drills?.title}</div>
                                                    <div className="text-xs text-gray-500">{assign.drills?.skill} - {assign.drills?.duration_minutes} min</div>
                                                </div>
                                                {assign.status === 'completed' ? (
                                                    <CheckCircle className="w-5 h-5 text-brand-green" />
                                                ) : (
                                                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
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
                            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                                {selectedChild ? `${selectedChild.first_name}'s Dashboard` : 'Fire FC App'}
                            </span>
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

                        {/* Mobile nav */}
                        <div className="md:hidden flex gap-2">
                            {[
                                { id: 'overview', icon: LayoutDashboard },
                                { id: 'schedule', icon: Calendar },
                                { id: 'messages', icon: MessageSquare },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setCurrentView(tab.id)}
                                    className={`p-2 rounded-lg ${currentView === tab.id ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                                >
                                    <tab.icon className="w-5 h-5" />
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
            {showDetails && selectedChild && (
                <PlayerEvaluationModal
                    player={formatPlayerForCard(selectedChild)}
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
