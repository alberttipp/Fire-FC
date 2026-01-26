import React, { useState, useEffect } from 'react';
import { 
    Users, Plus, Search, Calendar, Clock, DollarSign, 
    User, Phone, Mail, X, Edit2, Trash2, CheckCircle,
    XCircle, Send, MapPin, CreditCard
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

const TrainingClients = () => {
    const { user, profile } = useAuth();
    const [clients, setClients] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddClient, setShowAddClient] = useState(false);
    const [showScheduleSession, setShowScheduleSession] = useState(false);
    const [selectedClient, setSelectedClient] = useState(null);
    const [newClient, setNewClient] = useState({
        first_name: '', last_name: '', email: '', phone: '',
        parent_name: '', parent_email: '', parent_phone: '', notes: ''
    });
    const [newSession, setNewSession] = useState({
        title: '', session_type: 'individual', start_time: '', duration_minutes: 60,
        location_name: '', is_paid: false, price: '', notes: '', client_ids: []
    });
    const [activeTab, setActiveTab] = useState('clients');

    // Fetch data
    useEffect(() => {
        fetchData();
    }, [user]);

    const DEMO_COACH_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

    const fetchData = async () => {
        if (!user?.id) return;
        setLoading(true);

        try {
            // Fetch clients - include demo coach's clients for demo users
            const coachId = user.id;
            const { data: clientData } = await supabase
                .from('training_clients')
                .select('*')
                .or(`coach_id.eq.${coachId},coach_id.eq.${DEMO_COACH_ID}`)
                .order('last_name');

            setClients(clientData || []);

            // Fetch upcoming sessions
            const { data: sessionData } = await supabase
                .from('training_sessions')
                .select(`
                    *,
                    training_session_attendees (
                        id,
                        client_id,
                        status,
                        training_clients (first_name, last_name)
                    )
                `)
                .eq('coach_id', user.id)
                .gte('start_time', new Date().toISOString())
                .order('start_time', { ascending: true });

            setSessions(sessionData || []);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    // Add client
    const handleAddClient = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase
                .from('training_clients')
                .insert([{
                    ...newClient,
                    coach_id: user.id,
                    status: 'active'
                }]);

            if (error) throw error;
            
            setNewClient({
                first_name: '', last_name: '', email: '', phone: '',
                parent_name: '', parent_email: '', parent_phone: '', notes: ''
            });
            setShowAddClient(false);
            fetchData();
        } catch (err) {
            console.error('Error adding client:', err);
            alert('Could not add client');
        }
    };

    // Delete client
    const deleteClient = async (clientId) => {
        if (!confirm('Delete this client? This cannot be undone.')) return;
        
        try {
            await supabase.from('training_clients').delete().eq('id', clientId);
            setClients(clients.filter(c => c.id !== clientId));
        } catch (err) {
            console.error('Error deleting client:', err);
        }
    };

    // Schedule session
    const handleScheduleSession = async (e) => {
        e.preventDefault();
        try {
            // Create session
            const { data: session, error: sessionError } = await supabase
                .from('training_sessions')
                .insert([{
                    coach_id: user.id,
                    title: newSession.title,
                    session_type: newSession.session_type,
                    start_time: newSession.start_time,
                    duration_minutes: newSession.duration_minutes,
                    location_name: newSession.location_name,
                    is_paid: newSession.is_paid,
                    price: newSession.is_paid ? parseFloat(newSession.price) : null,
                    notes: newSession.notes,
                    status: 'scheduled'
                }])
                .select()
                .single();

            if (sessionError) throw sessionError;

            // Add attendees
            if (newSession.client_ids.length > 0) {
                const attendees = newSession.client_ids.map(clientId => ({
                    session_id: session.id,
                    client_id: clientId,
                    status: 'invited'
                }));

                await supabase.from('training_session_attendees').insert(attendees);
            }

            setNewSession({
                title: '', session_type: 'individual', start_time: '', duration_minutes: 60,
                location_name: '', is_paid: false, price: '', notes: '', client_ids: []
            });
            setShowScheduleSession(false);
            fetchData();
        } catch (err) {
            console.error('Error scheduling session:', err);
            alert('Could not schedule session');
        }
    };

    // Cancel session
    const cancelSession = async (sessionId) => {
        if (!confirm('Cancel this session?')) return;
        
        try {
            await supabase
                .from('training_sessions')
                .update({ status: 'cancelled' })
                .eq('id', sessionId);
            fetchData();
        } catch (err) {
            console.error('Error cancelling session:', err);
        }
    };

    // Format time
    const formatDateTime = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    // Toggle client selection for session
    const toggleClientSelection = (clientId) => {
        if (newSession.client_ids.includes(clientId)) {
            setNewSession({
                ...newSession,
                client_ids: newSession.client_ids.filter(id => id !== clientId)
            });
        } else {
            setNewSession({
                ...newSession,
                client_ids: [...newSession.client_ids, clientId]
            });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Users className="w-6 h-6 text-brand-gold" />
                        Training Clients
                    </h2>
                    <p className="text-gray-400 text-sm">Manage private training sessions</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowScheduleSession(true)}
                        className="px-4 py-2 bg-brand-gold/10 border border-brand-gold/30 rounded-lg text-brand-gold hover:bg-brand-gold/20 flex items-center gap-2"
                    >
                        <Calendar className="w-4 h-4" />
                        Schedule Session
                    </button>
                    <button
                        onClick={() => setShowAddClient(true)}
                        className="px-4 py-2 bg-brand-green text-brand-dark rounded-lg font-bold hover:bg-brand-green/90 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add Client
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-white/10 pb-2">
                <button
                    onClick={() => setActiveTab('clients')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                        activeTab === 'clients' 
                            ? 'bg-brand-green/20 text-brand-green' 
                            : 'text-gray-400 hover:text-white'
                    }`}
                >
                    Clients ({clients.length})
                </button>
                <button
                    onClick={() => setActiveTab('sessions')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                        activeTab === 'sessions' 
                            ? 'bg-brand-green/20 text-brand-green' 
                            : 'text-gray-400 hover:text-white'
                    }`}
                >
                    Upcoming Sessions ({sessions.filter(s => s.status === 'scheduled').length})
                </button>
            </div>

            {/* Clients Tab */}
            {activeTab === 'clients' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {clients.length === 0 ? (
                        <div className="col-span-full text-center py-12 glass-panel">
                            <User className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-400">No training clients yet</p>
                            <p className="text-sm text-gray-600 mt-1">Add clients for private sessions</p>
                        </div>
                    ) : (
                        clients.map(client => (
                            <div
                                key={client.id}
                                className="glass-panel p-4 hover:border-brand-green/30 transition-colors"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-brand-gold/20 text-brand-gold flex items-center justify-center font-bold">
                                            {client.first_name?.charAt(0)}{client.last_name?.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold">
                                                {client.first_name} {client.last_name}
                                            </h4>
                                            <span className={`text-xs px-2 py-0.5 rounded ${
                                                client.status === 'active' 
                                                    ? 'bg-green-500/20 text-green-400' 
                                                    : 'bg-gray-500/20 text-gray-400'
                                            }`}>
                                                {client.status}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => deleteClient(client.id)}
                                        className="p-1 hover:bg-red-500/20 rounded text-gray-500 hover:text-red-400"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                {client.email && (
                                    <p className="text-xs text-gray-400 flex items-center gap-1 mb-1">
                                        <Mail className="w-3 h-3" /> {client.email}
                                    </p>
                                )}
                                {client.phone && (
                                    <p className="text-xs text-gray-400 flex items-center gap-1 mb-1">
                                        <Phone className="w-3 h-3" /> {client.phone}
                                    </p>
                                )}
                                {client.parent_name && (
                                    <p className="text-xs text-gray-500 mt-2">
                                        Parent: {client.parent_name}
                                    </p>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Sessions Tab */}
            {activeTab === 'sessions' && (
                <div className="space-y-3">
                    {sessions.filter(s => s.status === 'scheduled').length === 0 ? (
                        <div className="text-center py-12 glass-panel">
                            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-400">No upcoming sessions</p>
                            <p className="text-sm text-gray-600 mt-1">Schedule a session to get started</p>
                        </div>
                    ) : (
                        sessions.filter(s => s.status === 'scheduled').map(session => (
                            <div
                                key={session.id}
                                className="glass-panel p-4 flex items-center justify-between"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-lg ${
                                        session.session_type === 'individual' 
                                            ? 'bg-blue-500/20 text-blue-400' 
                                            : 'bg-purple-500/20 text-purple-400'
                                    }`}>
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-bold">{session.title}</h4>
                                        <p className="text-sm text-gray-400 flex items-center gap-2">
                                            <Clock className="w-3 h-3" />
                                            {formatDateTime(session.start_time)} • {session.duration_minutes}min
                                        </p>
                                        {session.location_name && (
                                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                                <MapPin className="w-3 h-3" /> {session.location_name}
                                            </p>
                                        )}
                                        {session.training_session_attendees?.length > 0 && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Attendees: {session.training_session_attendees.map(a => 
                                                    `${a.training_clients?.first_name} ${a.training_clients?.last_name}`
                                                ).join(', ')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                    {session.is_paid && (
                                        <span className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 ${
                                            session.payment_status === 'paid' 
                                                ? 'bg-green-500/20 text-green-400' 
                                                : 'bg-yellow-500/20 text-yellow-400'
                                        }`}>
                                            <DollarSign className="w-3 h-3" />
                                            ${session.price} {session.payment_status}
                                        </span>
                                    )}
                                    <button
                                        onClick={() => cancelSession(session.id)}
                                        className="px-3 py-1.5 border border-red-500/30 text-red-400 rounded text-xs hover:bg-red-500/10"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Add Client Modal */}
            {showAddClient && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-brand-dark border border-white/10 rounded-xl w-full max-w-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl text-white font-bold">Add Training Client</h3>
                            <button onClick={() => setShowAddClient(false)} className="p-1 hover:bg-white/10 rounded">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleAddClient} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-400 uppercase">First Name *</label>
                                    <input
                                        type="text"
                                        value={newClient.first_name}
                                        onChange={(e) => setNewClient({ ...newClient, first_name: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 uppercase">Last Name *</label>
                                    <input
                                        type="text"
                                        value={newClient.last_name}
                                        onChange={(e) => setNewClient({ ...newClient, last_name: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1"
                                        required
                                    />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-400 uppercase">Email</label>
                                    <input
                                        type="email"
                                        value={newClient.email}
                                        onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 uppercase">Phone</label>
                                    <input
                                        type="tel"
                                        value={newClient.phone}
                                        onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1"
                                    />
                                </div>
                            </div>

                            <div className="border-t border-white/10 pt-4 mt-4">
                                <p className="text-xs text-gray-500 mb-3">Parent/Guardian (Optional)</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase">Parent Name</label>
                                        <input
                                            type="text"
                                            value={newClient.parent_name}
                                            onChange={(e) => setNewClient({ ...newClient, parent_name: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase">Parent Phone</label>
                                        <input
                                            type="tel"
                                            value={newClient.parent_phone}
                                            onChange={(e) => setNewClient({ ...newClient, parent_phone: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-gray-400 uppercase">Notes</label>
                                <textarea
                                    value={newClient.notes}
                                    onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1 h-20 resize-none"
                                    placeholder="Goals, skill level, etc..."
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAddClient(false)}
                                    className="flex-1 py-2 border border-white/10 rounded text-gray-400"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2 bg-brand-green text-brand-dark rounded font-bold"
                                >
                                    Add Client
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Schedule Session Modal */}
            {showScheduleSession && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-brand-dark border border-white/10 rounded-xl w-full max-w-lg p-6 my-8">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl text-white font-bold">Schedule Training Session</h3>
                            <button onClick={() => setShowScheduleSession(false)} className="p-1 hover:bg-white/10 rounded">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleScheduleSession} className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-400 uppercase">Session Title *</label>
                                <input
                                    type="text"
                                    value={newSession.title}
                                    onChange={(e) => setNewSession({ ...newSession, title: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1"
                                    placeholder="e.g., Technical Training - Jake"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-400 uppercase">Session Type</label>
                                    <select
                                        value={newSession.session_type}
                                        onChange={(e) => setNewSession({ ...newSession, session_type: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1"
                                    >
                                        <option value="individual">Individual (1-on-1)</option>
                                        <option value="small_group">Small Group (2-4)</option>
                                        <option value="team">Team Session</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 uppercase">Duration (min)</label>
                                    <select
                                        value={newSession.duration_minutes}
                                        onChange={(e) => setNewSession({ ...newSession, duration_minutes: parseInt(e.target.value) })}
                                        className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1"
                                    >
                                        <option value="30">30 minutes</option>
                                        <option value="45">45 minutes</option>
                                        <option value="60">60 minutes</option>
                                        <option value="90">90 minutes</option>
                                        <option value="120">2 hours</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-gray-400 uppercase">Date & Time *</label>
                                <input
                                    type="datetime-local"
                                    value={newSession.start_time}
                                    onChange={(e) => setNewSession({ ...newSession, start_time: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1"
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-xs text-gray-400 uppercase">Location</label>
                                <input
                                    type="text"
                                    value={newSession.location_name}
                                    onChange={(e) => setNewSession({ ...newSession, location_name: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1"
                                    placeholder="e.g., Rockford Sports Complex"
                                />
                            </div>

                            {/* Payment Options */}
                            <div className="border-t border-white/10 pt-4">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={newSession.is_paid}
                                        onChange={(e) => setNewSession({ ...newSession, is_paid: e.target.checked })}
                                        className="w-5 h-5 rounded bg-white/5 border border-white/10"
                                    />
                                    <span className="text-white">This is a paid session</span>
                                </label>
                                
                                {newSession.is_paid && (
                                    <div className="mt-3">
                                        <label className="text-xs text-gray-400 uppercase">Price ($)</label>
                                        <input
                                            type="number"
                                            value={newSession.price}
                                            onChange={(e) => setNewSession({ ...newSession, price: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1"
                                            placeholder="50.00"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Select Clients */}
                            {clients.length > 0 && (
                                <div>
                                    <label className="text-xs text-gray-400 uppercase mb-2 block">Invite Clients</label>
                                    <div className="max-h-32 overflow-y-auto space-y-1 bg-white/5 rounded-lg p-2">
                                        {clients.map(client => (
                                            <label
                                                key={client.id}
                                                className="flex items-center gap-2 p-2 hover:bg-white/5 rounded cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={newSession.client_ids.includes(client.id)}
                                                    onChange={() => toggleClientSelection(client.id)}
                                                    className="w-4 h-4 rounded"
                                                />
                                                <span className="text-white text-sm">
                                                    {client.first_name} {client.last_name}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="text-xs text-gray-400 uppercase">Notes</label>
                                <textarea
                                    value={newSession.notes}
                                    onChange={(e) => setNewSession({ ...newSession, notes: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1 h-20 resize-none"
                                    placeholder="Session focus, equipment needed..."
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowScheduleSession(false)}
                                    className="flex-1 py-2 border border-white/10 rounded text-gray-400"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2 bg-brand-green text-brand-dark rounded font-bold"
                                >
                                    Schedule Session
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrainingClients;
