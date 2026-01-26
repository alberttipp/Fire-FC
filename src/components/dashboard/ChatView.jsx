import React, { useState, useEffect, useRef } from 'react';
import { Send, AlertCircle, Hash, MessageSquare, Users, Bell, Megaphone, Lock, Loader2 } from 'lucide-react';
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
    const [onlineCount, setOnlineCount] = useState(1);
    const messagesEndRef = useRef(null);
    const channelSubscription = useRef(null);

    // Get current user display info
    const currentUserName = profile?.full_name || user?.email?.split('@')[0] || 'User';
    const currentUserRole = profile?.role || 'coach';
    const currentTeamId = profile?.team_id || 'd02aba3e-3c30-430f-9377-3b334cffcd04'; // Default to U11

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Fetch channels on mount
    useEffect(() => {
        fetchChannels();
    }, [currentTeamId]);

    // Fetch messages and subscribe when channel changes
    useEffect(() => {
        if (activeChannel) {
            fetchMessages(activeChannel.id);
            subscribeToMessages(activeChannel.id);
        }

        return () => {
            if (channelSubscription.current) {
                supabase.removeChannel(channelSubscription.current);
            }
        };
    }, [activeChannel]);

    const fetchChannels = async () => {
        try {
            const { data, error } = await supabase
                .from('channels')
                .select('*')
                .eq('team_id', currentTeamId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            if (data && data.length > 0) {
                setChannels(data);
                setActiveChannel(data[0]);
            } else {
                // Create default channels if none exist
                const defaultChannels = [
                    { team_id: currentTeamId, name: 'Team Chat', type: 'team', description: 'General team discussion' },
                    { team_id: currentTeamId, name: 'Announcements', type: 'announcement', description: 'Important updates' },
                    { team_id: currentTeamId, name: 'Parents', type: 'parents', description: 'Parent coordination' }
                ];

                const { data: newChannels, error: insertError } = await supabase
                    .from('channels')
                    .insert(defaultChannels)
                    .select();

                if (!insertError && newChannels) {
                    setChannels(newChannels);
                    setActiveChannel(newChannels[0]);
                }
            }
        } catch (err) {
            console.error('Error fetching channels:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async (channelId) => {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('channel_id', channelId)
                .order('created_at', { ascending: true })
                .limit(100);

            if (error) throw error;
            setMessages(data || []);
        } catch (err) {
            console.error('Error fetching messages:', err);
        }
    };

    const subscribeToMessages = (channelId) => {
        // Clean up previous subscription
        if (channelSubscription.current) {
            supabase.removeChannel(channelSubscription.current);
        }

        // Subscribe to new messages
        channelSubscription.current = supabase
            .channel(`messages:${channelId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `channel_id=eq.${channelId}`
                },
                (payload) => {
                    setMessages(prev => [...prev, payload.new]);
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // Simulate online count (in real app, use Presence)
                    setOnlineCount(Math.floor(Math.random() * 5) + 2);
                }
            });
    };

    const handleSend = async () => {
        if (!newMessage.trim() || !activeChannel) return;

        setSending(true);

        const messageData = {
            channel_id: activeChannel.id,
            sender_id: user?.id || null,
            sender_name: currentUserName,
            sender_role: currentUserRole,
            content: newMessage.trim(),
            message_type: isUrgent ? 'announcement' : 'text',
            is_urgent: isUrgent,
            is_pinned: false
        };

        try {
            const { error } = await supabase
                .from('messages')
                .insert([messageData]);

            if (error) throw error;

            setNewMessage('');
            setIsUrgent(false);
        } catch (err) {
            console.error('Error sending message:', err);
            alert('Failed to send message. Please try again.');
        } finally {
            setSending(false);
        }
    };

    const getChannelIcon = (type) => {
        switch (type) {
            case 'announcement':
                return <Megaphone className="w-4 h-4 text-yellow-500" />;
            case 'parents':
                return <Users className="w-4 h-4 text-blue-400" />;
            case 'coaches':
                return <Lock className="w-4 h-4 text-purple-400" />;
            default:
                return <Hash className="w-4 h-4" />;
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
        return msg.sender_name === currentUserName || msg.sender_id === user?.id;
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
        <div className="h-[calc(100vh-140px)] flex gap-6 animate-fade-in-up">
            {/* Sidebar / Channel List */}
            <div className="w-64 glass-panel p-4 flex flex-col h-full rounded-2xl">
                <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4 px-2">Channels</h3>
                <div className="space-y-1">
                    {channels.map(channel => (
                        <button
                            key={channel.id}
                            onClick={() => setActiveChannel(channel)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeChannel?.id === channel.id ? 'bg-white/10 text-brand-golden border border-white/5' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                        >
                            {getChannelIcon(channel.type)}
                            <span className="truncate">{channel.name}</span>
                            {channel.type === 'announcement' && (
                                <Bell className="w-3 h-3 ml-auto text-yellow-500" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Quick Stats */}
                <div className="mt-auto pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2 px-2 text-xs text-gray-500">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span>You are online as <span className="text-brand-green">{currentUserName}</span></span>
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 glass-panel flex flex-col rounded-2xl overflow-hidden relative">
                {/* Header */}
                <div className="bg-black/20 p-4 border-b border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-white font-bold uppercase tracking-wide">
                        {activeChannel && getChannelIcon(activeChannel.type)}
                        {activeChannel?.name || 'Select a channel'}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-brand-green">
                        <div className="w-2 h-2 bg-brand-green rounded-full animate-pulse"></div>
                        {onlineCount} Online
                    </div>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.length === 0 ? (
                        <div className="text-center text-gray-500 mt-20">
                            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p>No messages yet in this channel.</p>
                            <p className="text-xs mt-1">Be the first to say something!</p>
                        </div>
                    ) : (
                        messages.map(msg => (
                            <div key={msg.id} className={`flex gap-4 ${isOwnMessage(msg) ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm ${
                                    msg.sender_role === 'coach' || msg.sender_role === 'manager'
                                        ? 'bg-brand-gold text-brand-dark'
                                        : msg.sender_role === 'parent'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-700 text-gray-300'
                                }`}>
                                    {msg.sender_name?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                                <div className={`max-w-[70%] ${isOwnMessage(msg) ? 'items-end' : 'items-start'} flex flex-col`}>
                                    <div className={`flex items-center gap-2 mb-1 ${isOwnMessage(msg) ? 'flex-row-reverse' : ''}`}>
                                        <span className="text-sm font-bold text-white">{msg.sender_name}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${
                                            msg.sender_role === 'coach' ? 'bg-brand-gold/20 text-brand-gold' :
                                            msg.sender_role === 'manager' ? 'bg-purple-500/20 text-purple-400' :
                                            msg.sender_role === 'parent' ? 'bg-blue-500/20 text-blue-400' :
                                            'bg-gray-500/20 text-gray-400'
                                        }`}>{msg.sender_role}</span>
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
                <div className="p-4 bg-black/40 border-t border-white/5">
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
                                MARK URGENT
                            </label>
                            {(currentUserRole === 'coach' || currentUserRole === 'manager') && (
                                <span className="text-xs text-gray-600">• Staff messages are highlighted</span>
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
                                className="bg-brand-green text-brand-dark rounded-xl px-6 font-bold uppercase hover:bg-white hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
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
            </div>
        </div>
    );
};

export default ChatView;
