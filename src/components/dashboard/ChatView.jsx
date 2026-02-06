import React, { useState, useEffect, useRef } from 'react';
import { Send, AlertCircle, Hash, MessageSquare, Users, Bell, Megaphone, Lock, Loader2, Menu, X, Plus } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

const ChatView = () => {
    const { user, profile } = useAuth();
    const [channels, setChannels] = useState([]);
    const [activeChannel, setActiveChannel] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isUrgent, setIsUrgent] = useState(false);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [memberCount, setMemberCount] = useState(0);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [showNewDM, setShowNewDM] = useState(false);
    const [teamMembers, setTeamMembers] = useState([]);
    const messagesEndRef = useRef(null);
    const channelSubscription = useRef(null);

    const currentUserName = profile?.full_name || user?.display_name || user?.email?.split('@')[0] || 'User';
    const currentUserRole = profile?.role || user?.role || 'coach';
    const currentTeamId = profile?.team_id || 'd02aba3e-3c30-430f-9377-3b334cffcd04';

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        fetchChannels();
    }, [currentTeamId]);

    useEffect(() => {
        if (activeChannel) {
            fetchMessages(activeChannel.id);
            fetchMemberCount(activeChannel.id);
            subscribeToMessages(activeChannel.id);
            setSidebarOpen(false);
        }

        return () => {
            if (channelSubscription.current) {
                supabase.removeChannel(channelSubscription.current);
            }
        };
    }, [activeChannel]);

    const fetchChannels = async () => {
        try {
            const isPlayer = currentUserRole === 'player';
            let allChannels = [];

            if (!isPlayer) {
                // Staff: fetch team conversations via team_id (no conversation_members needed)
                const { data: teamConvos, error: teamErr } = await supabase
                    .from('conversations')
                    .select('id, team_id, type, name, created_at')
                    .eq('team_id', currentTeamId)
                    .eq('type', 'team')
                    .order('created_at', { ascending: true });

                if (teamErr) console.error('Team convos error:', teamErr);
                if (teamConvos) allChannels.push(...teamConvos);

                // Staff: fetch staff_dm conversations via conversation_members
                const { data: staffDMs, error: staffErr } = await supabase
                    .from('conversations')
                    .select('id, team_id, type, name, created_at, conversation_members!inner(user_id)')
                    .eq('conversation_members.user_id', user.id)
                    .eq('type', 'staff_dm')
                    .order('created_at', { ascending: true });

                if (staffErr) console.error('Staff DMs error:', staffErr);
                if (staffDMs) allChannels.push(...staffDMs);
            } else {
                // Players: only player_dm via conversation_members
                const { data: playerDMs, error: playerErr } = await supabase
                    .from('conversations')
                    .select('id, team_id, type, name, created_at, conversation_members!inner(user_id)')
                    .eq('conversation_members.user_id', user.id)
                    .eq('type', 'player_dm')
                    .order('created_at', { ascending: true });

                if (playerErr) console.error('Player DMs error:', playerErr);
                if (playerDMs) allChannels.push(...playerDMs);
            }

            // Deduplicate by id
            const unique = [...new Map(allChannels.map(c => [c.id, c])).values()];

            setChannels(unique);
            if (unique.length > 0) {
                setActiveChannel(unique[0]);
            } else {
                setActiveChannel(null);
            }
        } catch (err) {
            console.error('Error fetching conversations:', err);
            setChannels([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async (conversationId) => {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true })
                .limit(100);

            if (error) {
                console.error('Error fetching messages:', error);
                throw error;
            }
            setMessages(data || []);
        } catch (err) {
            console.error('Error fetching messages:', err);
            setMessages([]);
        }
    };

    const fetchMemberCount = async (conversationId) => {
        try {
            const { count, error } = await supabase
                .from('conversation_members')
                .select('*', { count: 'exact', head: true })
                .eq('conversation_id', conversationId);

            if (!error && count !== null) {
                setMemberCount(count);
            }
        } catch (err) {
            setMemberCount(0);
        }
    };

    const subscribeToMessages = (conversationId) => {
        if (channelSubscription.current) {
            supabase.removeChannel(channelSubscription.current);
        }

        channelSubscription.current = supabase
            .channel(`messages:${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`
                },
                (payload) => {
                    setMessages(prev => [...prev, payload.new]);
                }
            )
            .subscribe();
    };

    const handleSend = async () => {
        if (!newMessage.trim() || !activeChannel) return;

        const isPlayer = currentUserRole === 'player';
        if (isPlayer && activeChannel.type !== 'player_dm') {
            alert('Players can only send messages in player DMs.');
            return;
        }

        setSending(true);

        const messageData = {
            conversation_id: activeChannel.id,
            sender_id: user?.id || null,
            sender_name: currentUserName,
            sender_role: currentUserRole,
            content: newMessage.trim(),
            message_type: isUrgent ? 'announcement' : 'text',
            is_urgent: isUrgent
        };

        try {
            const { error } = await supabase
                .from('messages')
                .insert([messageData]);

            if (error) {
                console.error('Send error:', error);
                throw error;
            }

            setNewMessage('');
            setIsUrgent(false);
        } catch (err) {
            console.error('Error sending message:', err);
            alert('Failed to send message. You may not have permission to post here.');
        } finally {
            setSending(false);
        }
    };

    const fetchTeamMembers = async () => {
        try {
            const { data, error } = await supabase
                .from('team_memberships')
                .select('user_id, role')
                .eq('team_id', currentTeamId);

            if (!error && data) {
                // Get profiles for these users
                const userIds = data.map(m => m.user_id).filter(id => id !== user.id);
                if (userIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, full_name, email')
                        .in('id', userIds);

                    const merged = data
                        .filter(m => m.user_id !== user.id)
                        .map(m => {
                            const p = profiles?.find(p => p.id === m.user_id);
                            return {
                                user_id: m.user_id,
                                role: m.role,
                                name: p?.full_name || p?.email || 'Unknown'
                            };
                        });
                    setTeamMembers(merged);
                }
            }
        } catch (err) {
            console.error('Error fetching team members:', err);
        }
    };

    const createStaffDM = async (otherUserId, otherName) => {
        try {
            const { data: convo, error: convoErr } = await supabase
                .from('conversations')
                .insert([{
                    team_id: currentTeamId,
                    type: 'staff_dm',
                    name: `${currentUserName} & ${otherName}`,
                    created_by: user.id
                }])
                .select()
                .single();

            if (convoErr) throw convoErr;

            // Add both users as members
            await supabase.from('conversation_members').insert([
                { conversation_id: convo.id, user_id: user.id, role: 'admin' },
                { conversation_id: convo.id, user_id: otherUserId, role: 'member' }
            ]);

            setShowNewDM(false);
            await fetchChannels();
            setActiveChannel(convo);
        } catch (err) {
            console.error('Error creating DM:', err);
            alert('Could not create conversation.');
        }
    };

    const getChannelIcon = (type) => {
        switch (type) {
            case 'team': return <Hash className="w-4 h-4 text-brand-green" />;
            case 'player_dm': return <MessageSquare className="w-4 h-4 text-blue-400" />;
            case 'staff_dm': return <Lock className="w-4 h-4 text-purple-400" />;
            default: return <Hash className="w-4 h-4" />;
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();

        if (isToday) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
               date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const isOwnMessage = (msg) => {
        return msg.sender_id === user?.id;
    };

    const getRoleBadgeStyle = (role) => {
        switch (role) {
            case 'coach': return 'bg-brand-gold/20 text-brand-gold';
            case 'manager': return 'bg-purple-500/20 text-purple-400';
            case 'parent': return 'bg-blue-500/20 text-blue-400';
            case 'player': return 'bg-green-500/20 text-green-400';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    };

    const getAvatarStyle = (role) => {
        switch (role) {
            case 'coach':
            case 'manager': return 'bg-brand-gold text-brand-dark';
            case 'parent': return 'bg-blue-600 text-white';
            default: return 'bg-gray-700 text-gray-300';
        }
    };

    if (loading) {
        return (
            <div className="h-[calc(100vh-140px)] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-green mx-auto mb-2" />
                    <p className="text-gray-400">Loading chat...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-140px)] flex gap-0 md:gap-6 animate-fade-in-up relative">
            {/* Mobile Menu Button */}
            <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden absolute top-3 left-3 z-30 p-2 bg-white/10 rounded-lg text-white hover:bg-white/20"
            >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Sidebar / Channel List */}
            <div className={`
                fixed md:relative inset-y-0 left-0 z-20
                w-72 md:w-64 glass-panel p-4 flex flex-col rounded-none md:rounded-2xl
                transform transition-transform duration-200 ease-in-out
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                h-full
            `}>
                <div className="flex items-center justify-between mb-4 px-2">
                    <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest">Channels</h3>
                    {['manager', 'coach'].includes(currentUserRole) && (
                        <button
                            onClick={() => { setShowNewDM(true); fetchTeamMembers(); }}
                            className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-brand-green"
                            title="New DM"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <div className="space-y-1 flex-1 overflow-y-auto">
                    {channels.length === 0 ? (
                        <div className="text-center py-8 px-2">
                            <MessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                            <p className="text-gray-500 text-xs">No channels yet.</p>
                            <p className="text-gray-600 text-xs mt-1">Run the chat migration SQL to create team channels.</p>
                        </div>
                    ) : (
                        channels.map(channel => (
                            <button
                                key={channel.id}
                                onClick={() => setActiveChannel(channel)}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeChannel?.id === channel.id ? 'bg-white/10 text-brand-golden border border-white/5' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                            >
                                {getChannelIcon(channel.type)}
                                <span className="truncate">{channel.name}</span>
                            </button>
                        ))
                    )}
                </div>

                {/* New DM Modal */}
                {showNewDM && (
                    <div className="absolute inset-0 bg-black/80 z-40 flex flex-col p-4 rounded-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-white font-bold text-sm uppercase">New DM</h4>
                            <button onClick={() => setShowNewDM(false)} className="text-gray-400 hover:text-white">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-1">
                            {teamMembers.map(m => (
                                <button
                                    key={m.user_id}
                                    onClick={() => createStaffDM(m.user_id, m.name)}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${getAvatarStyle(m.role)}`}>
                                        {m.name?.charAt(0)?.toUpperCase() || '?'}
                                    </div>
                                    <div className="text-left">
                                        <div className="font-medium">{m.name}</div>
                                        <div className="text-xs text-gray-500 capitalize">{m.role}</div>
                                    </div>
                                </button>
                            ))}
                            {teamMembers.length === 0 && (
                                <p className="text-gray-500 text-xs text-center py-4">No team members found.</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Online Status */}
                <div className="mt-auto pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2 px-2 text-xs text-gray-500">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span>You are online as <span className="text-brand-green">{currentUserName}</span></span>
                    </div>
                </div>
            </div>

            {/* Overlay for mobile sidebar */}
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-10 md:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Main Chat Area */}
            <div className="flex-1 glass-panel flex flex-col rounded-2xl overflow-hidden relative">
                {/* Header */}
                <div className="bg-black/20 p-4 border-b border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-white font-bold uppercase tracking-wide">
                        <span className="md:hidden w-8" /> {/* spacer for mobile menu button */}
                        {activeChannel && getChannelIcon(activeChannel.type)}
                        {activeChannel?.name || 'Select a channel'}
                    </div>
                    {activeChannel && (
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            <Users className="w-3 h-3" />
                            {memberCount} member{memberCount !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>

                {/* Messages Feed */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
                    {!activeChannel ? (
                        <div className="text-center text-gray-500 mt-20">
                            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p>No channel selected.</p>
                            <p className="text-xs mt-1">Pick a channel from the sidebar to start chatting.</p>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="text-center text-gray-500 mt-20">
                            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p>No messages yet in this channel.</p>
                            <p className="text-xs mt-1">Be the first to say something!</p>
                        </div>
                    ) : (
                        messages.map(msg => (
                            <div key={msg.id} className={`flex gap-3 md:gap-4 ${isOwnMessage(msg) ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-xs md:text-sm ${getAvatarStyle(msg.sender_role)}`}>
                                    {msg.sender_name?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                                <div className={`max-w-[85%] md:max-w-[70%] ${isOwnMessage(msg) ? 'items-end' : 'items-start'} flex flex-col`}>
                                    <div className={`flex items-center gap-2 mb-1 ${isOwnMessage(msg) ? 'flex-row-reverse' : ''}`}>
                                        <span className="text-sm font-bold text-white">{msg.sender_name || 'Unknown'}</span>
                                        {msg.sender_role && (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${getRoleBadgeStyle(msg.sender_role)}`}>
                                                {msg.sender_role}
                                            </span>
                                        )}
                                        <span className="text-[10px] text-gray-500">{formatTime(msg.created_at)}</span>
                                    </div>
                                    <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                                        msg.is_urgent
                                            ? 'bg-red-500/20 border border-red-500 text-red-100 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                                            : msg.message_type === 'announcement'
                                                ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-100'
                                                : isOwnMessage(msg)
                                                    ? 'bg-brand-green/20 border border-brand-green/30 text-white rounded-tr-none'
                                                    : 'bg-white/5 border border-white/10 text-gray-300 rounded-tl-none'
                                    }`}>
                                        {msg.is_urgent && (
                                            <div className="flex items-center gap-1 text-red-400 font-bold text-xs uppercase mb-1">
                                                <AlertCircle className="w-3 h-3" /> Urgent Alert
                                            </div>
                                        )}
                                        {msg.message_type === 'announcement' && !msg.is_urgent && (
                                            <div className="flex items-center gap-1 text-yellow-400 font-bold text-xs uppercase mb-1">
                                                <Megaphone className="w-3 h-3" /> Announcement
                                            </div>
                                        )}
                                        {msg.content}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                {activeChannel && (
                    <div className="p-3 md:p-4 bg-black/40 border-t border-white/5">
                        <div className="flex flex-col gap-2">
                            {/* Toolbar */}
                            <div className="flex items-center gap-4 px-2">
                                <label className={`flex items-center gap-2 text-xs font-bold cursor-pointer transition-colors ${isUrgent ? 'text-red-500' : 'text-gray-500 hover:text-white'}`}>
                                    <input
                                        type="checkbox"
                                        checked={isUrgent}
                                        onChange={(e) => setIsUrgent(e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-600 bg-transparent focus:ring-red-500 text-red-600"
                                    />
                                    <AlertCircle className="w-4 h-4" />
                                    <span className="hidden sm:inline">MARK URGENT</span>
                                </label>
                                {(currentUserRole === 'coach' || currentUserRole === 'manager') && (
                                    <span className="text-xs text-gray-600 hidden md:inline">Staff messages are highlighted</span>
                                )}
                            </div>

                            {/* Text Box */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                    placeholder={`Message ${activeChannel?.name || 'channel'}...`}
                                    disabled={sending}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-green/50 placeholder:text-gray-600 font-sans disabled:opacity-50"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={sending || !newMessage.trim()}
                                    className="bg-brand-green text-brand-dark rounded-xl px-4 md:px-6 font-bold uppercase hover:bg-white hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
                                >
                                    {sending ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Send className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatView;
