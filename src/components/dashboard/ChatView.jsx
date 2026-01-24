import React, { useState } from 'react';
import { Send, AlertCircle, Hash, MessageSquare, Users, Bell } from 'lucide-react';

const ChatView = () => {
    const [activeChannel, setActiveChannel] = useState('general');
    const [newMessage, setNewMessage] = useState('');
    const [isUrgent, setIsUrgent] = useState(false);

    const channels = [
        { id: 'general', name: 'General', type: 'text', icon: <Hash className="w-4 h-4" /> },
        { id: 'urgent', name: 'Urgent Alerts', type: 'alert', icon: <AlertCircle className="w-4 h-4 text-red-500" /> },
        { id: 'practice', name: 'Practice Updates', type: 'text', icon: <Hash className="w-4 h-4" /> },
        { id: 'games', name: 'Game Day', type: 'text', icon: <Hash className="w-4 h-4" /> },
    ];

    const [messages, setMessages] = useState([
        { id: 1, sender: "Coach Dave", content: "Great practice yesterday everyone! Keep up the intensity.", timestamp: "10:30 AM", channel: 'general', urgent: false },
        { id: 2, sender: "Sarah (Parent)", content: "Is the game this weekend still at 9am?", timestamp: "10:45 AM", channel: 'general', urgent: false },
        { id: 3, sender: "Coach Dave", content: "WARNING: Field 2 is closed due to rain. Practice moved to Gym.", timestamp: "8:00 AM", channel: 'urgent', urgent: true },
    ]);

    const handleSend = () => {
        if (!newMessage.trim()) return;

        const newMsg = {
            id: Date.now(),
            sender: "Coach Dave", // Mock user
            content: newMessage,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            channel: activeChannel,
            urgent: isUrgent
        };

        setMessages([...messages, newMsg]);
        setNewMessage('');
        setIsUrgent(false);
    };

    const filteredMessages = messages.filter(m => m.channel === activeChannel);

    return (
        <div className="h-[calc(100vh-140px)] flex gap-6 animate-fade-in-up">
            {/* Sidebar / Channel List */}
            <div className="w-64 glass-panel p-4 flex flex-col h-full rounded-2xl">
                <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4 px-2">Channels</h3>
                <div className="space-y-1">
                    {channels.map(channel => (
                        <button
                            key={channel.id}
                            onClick={() => setActiveChannel(channel.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeChannel === channel.id ? 'bg-white/10 text-brand-golden border border-white/5' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                        >
                            {channel.icon}
                            {channel.name}
                        </button>
                    ))}
                </div>

                <div className="mt-8">
                    <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4 px-2">Direct Messages</h3>
                    <div className="space-y-1">
                        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div> Leo's Mom
                        </button>
                        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white">
                            <div className="w-2 h-2 rounded-full bg-gray-600"></div> Assistant Coach
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 glass-panel flex flex-col rounded-2xl overflow-hidden relative">
                {/* Header */}
                <div className="bg-black/20 p-4 border-b border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-white font-bold uppercase tracking-wide">
                        <Hash className="w-5 h-5 text-gray-500" />
                        {channels.find(c => c.id === activeChannel)?.name}
                    </div>
                    {/* Active User Count Mock */}
                    <div className="flex items-center gap-2 text-xs text-brand-green">
                        <div className="w-2 h-2 bg-brand-green rounded-full animate-pulse"></div>
                        3 Online
                    </div>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {filteredMessages.length === 0 ? (
                        <div className="text-center text-gray-500 mt-20">
                            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p>No messages yet in this channel.</p>
                        </div>
                    ) : (
                        filteredMessages.map(msg => (
                            <div key={msg.id} className={`flex gap-4 ${msg.sender === 'Coach Dave' ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm ${msg.sender === 'Coach Dave' ? 'bg-brand-gold text-brand-dark' : 'bg-gray-700 text-gray-300'}`}>
                                    {msg.sender.charAt(0)}
                                </div>
                                <div className={`max-w-[70%] ${msg.sender === 'Coach Dave' ? 'items-end' : 'items-start'} flex flex-col`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-bold text-white">{msg.sender}</span>
                                        <span className="text-[10px] text-gray-500">{msg.timestamp}</span>
                                    </div>
                                    <div className={`p-3 rounded-2xl text-sm leading-relaxed ${msg.urgent
                                            ? 'bg-red-500/20 border border-red-500 text-red-100 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                                            : msg.sender === 'Coach Dave'
                                                ? 'bg-brand-green/20 border border-brand-green/30 text-white rounded-tr-none'
                                                : 'bg-white/5 border border-white/10 text-gray-300 rounded-tl-none'
                                        }`}>
                                        {msg.urgent && <div className="flex items-center gap-1 text-red-400 font-bold text-xs uppercase mb-1"><AlertCircle className="w-3 h-3" /> Urgent Alert</div>}
                                        {msg.content}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
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
                        </div>

                        {/* Text Box */}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder={`Message #${activeChannel}...`}
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-green/50 placeholder:text-gray-600 font-sans"
                            />
                            <button
                                onClick={handleSend}
                                className="bg-brand-green text-brand-dark rounded-xl px-6 font-bold uppercase hover:bg-white hover:scale-105 transition-all flex items-center gap-2"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatView;
