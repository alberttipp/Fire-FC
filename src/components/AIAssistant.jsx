import React, { useState, useEffect, useRef } from 'react';
import { 
    MessageCircle, X, Send, Mic, MicOff, Loader2, 
    Calendar, MapPin, Shirt, Clock, User, ChevronDown,
    Sparkles
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const AIAssistant = () => {
    const { user, profile } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [contextData, setContextData] = useState(null);
    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);

    // Fetch context data (events, team info, etc.) when opened
    useEffect(() => {
        if (isOpen && user) {
            fetchContextData();
        }
    }, [isOpen, user]);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Initialize speech recognition
    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setInput(transcript);
                setIsListening(false);
            };

            recognitionRef.current.onerror = () => {
                setIsListening(false);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        }
    }, []);

    const fetchContextData = async () => {
        try {
            // Get team info
            let teamId = profile?.team_id;
            let teamData = null;

            if (teamId) {
                const { data: team } = await supabase
                    .from('teams')
                    .select('*')
                    .eq('id', teamId)
                    .single();
                teamData = team;
            } else if (profile?.role === 'manager' || profile?.role === 'coach') {
                // Get first team for managers/coaches
                const { data: teams } = await supabase
                    .from('teams')
                    .select('*')
                    .limit(1);
                if (teams?.length) {
                    teamData = teams[0];
                    teamId = teamData.id;
                }
            }

            // Get upcoming events (next 7 days)
            const today = new Date();
            const nextWeek = new Date(today);
            nextWeek.setDate(nextWeek.getDate() + 7);

            const { data: events } = await supabase
                .from('events')
                .select('*')
                .gte('start_time', today.toISOString())
                .lte('start_time', nextWeek.toISOString())
                .order('start_time', { ascending: true });

            // Get roster
            let roster = [];
            if (teamId) {
                const { data: players } = await supabase
                    .from('players')
                    .select('*')
                    .eq('team_id', teamId);
                roster = players || [];
            }

            // Get coach info
            let coachInfo = null;
            if (teamData?.coach_id) {
                const { data: coach } = await supabase
                    .from('profiles')
                    .select('full_name, email')
                    .eq('id', teamData.coach_id)
                    .single();
                coachInfo = coach;
            }

            setContextData({
                team: teamData,
                events: events || [],
                roster,
                coach: coachInfo,
                user: {
                    name: profile?.full_name || user?.email,
                    role: profile?.role
                },
                today: today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
            });

            // Add welcome message
            if (messages.length === 0) {
                setMessages([{
                    role: 'assistant',
                    content: `Hi ${profile?.full_name?.split(' ')[0] || 'there'}! 👋 I'm your Fire FC assistant. Ask me anything like:\n\n• "When is our next practice?"\n• "What kit do we wear for the game?"\n• "Who's on the roster?"\n• "Message the coach that we'll be late"`
                }]);
            }
        } catch (err) {
            console.error('Error fetching context:', err);
        }
    };

    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert('Speech recognition not supported in this browser');
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    const sendMessage = async () => {
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setLoading(true);

        try {
            // Build context for AI
            const systemContext = buildSystemContext();
            
            // Call Gemini API
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [
                            {
                                role: 'user',
                                parts: [{ text: `${systemContext}\n\nUser question: ${userMessage}` }]
                            }
                        ],
                        generationConfig: {
                            temperature: 0.7,
                            topK: 40,
                            topP: 0.95,
                            maxOutputTokens: 1024,
                        }
                    })
                }
            );

            const data = await response.json();
            
            if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                const aiResponse = data.candidates[0].content.parts[0].text;
                setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
            } else {
                throw new Error('No response from AI');
            }
        } catch (err) {
            console.error('AI Error:', err);
            setMessages(prev => [...prev, { 
                role: 'assistant', 
                content: "Sorry, I couldn't process that request. Please try again." 
            }]);
        } finally {
            setLoading(false);
        }
    };

    const buildSystemContext = () => {
        if (!contextData) return "You are a helpful soccer club assistant.";

        const { team, events, roster, coach, user, today } = contextData;

        // Format events
        const eventsText = events.length > 0 
            ? events.map(e => {
                const date = new Date(e.start_time);
                return `- ${e.title} (${e.type}) on ${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}${e.location_name ? ` at ${e.location_name}` : ''}${e.kit_color ? `. Kit: ${e.kit_color}` : ''}${e.arrival_time_minutes ? `. Arrive ${e.arrival_time_minutes} min early` : ''}`;
            }).join('\n')
            : 'No upcoming events scheduled.';

        // Format roster
        const rosterText = roster.length > 0
            ? roster.map(p => `#${p.number} ${p.first_name} ${p.last_name}`).join(', ')
            : 'No players on roster.';

        return `You are the AI assistant for Rockford Fire FC, a youth soccer club. Be friendly, helpful, and concise.

TODAY'S DATE: ${today}

CURRENT USER: ${user.name} (${user.role})

TEAM INFO:
- Team: ${team?.name || 'Rockford Fire FC'} (${team?.age_group || 'U11 Boys'})
- Team Code: ${team?.join_code || 'N/A'}
${coach ? `- Coach: ${coach.full_name} (${coach.email})` : ''}

UPCOMING EVENTS (Next 7 Days):
${eventsText}

ROSTER (${roster.length} players):
${rosterText}

IMPORTANT INSTRUCTIONS:
1. Answer questions about schedule, events, practices, and games using the data above
2. If asked about kit/uniform, check the kit_color field in events
3. If asked to message someone, acknowledge the request and confirm what message they want to send
4. Be brief and direct - these are busy parents and coaches
5. Use emojis sparingly to be friendly
6. If you don't have specific info, say so honestly
7. For location questions, provide the full address if available
8. Always mention arrival time if asking about games (usually 30-45 min early)`;
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Quick action buttons
    const quickActions = [
        { label: "Next practice?", query: "When is our next practice?" },
        { label: "Game kit?", query: "What kit do we wear for the next game?" },
        { label: "View roster", query: "Show me the team roster" },
    ];

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(true)}
                className={`fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-brand-green to-green-600 rounded-full shadow-lg shadow-brand-green/30 flex items-center justify-center text-brand-dark hover:scale-110 transition-all z-40 ${isOpen ? 'hidden' : ''}`}
            >
                <Sparkles className="w-6 h-6" />
            </button>

            {/* Chat Panel */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 w-[380px] h-[550px] bg-brand-dark border border-white/10 rounded-2xl shadow-2xl flex flex-col z-50 animate-fade-in overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-brand-green/20 to-transparent p-4 border-b border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-brand-green rounded-full flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-brand-dark" />
                            </div>
                            <div>
                                <h3 className="text-white font-bold">Fire FC Assistant</h3>
                                <p className="text-xs text-gray-400">Ask me anything</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] p-3 rounded-2xl text-sm whitespace-pre-wrap ${
                                        msg.role === 'user'
                                            ? 'bg-brand-green text-brand-dark rounded-br-md'
                                            : 'bg-white/10 text-white rounded-bl-md'
                                    }`}
                                >
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-white/10 p-3 rounded-2xl rounded-bl-md">
                                    <Loader2 className="w-5 h-5 text-brand-green animate-spin" />
                                </div>
                            </div>
                        )}
                        
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Actions */}
                    {messages.length <= 1 && (
                        <div className="px-4 pb-2 flex gap-2 flex-wrap">
                            {quickActions.map((action, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        setInput(action.query);
                                        setTimeout(() => sendMessage(), 100);
                                    }}
                                    className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs text-gray-300 hover:bg-white/10 hover:border-brand-green/30 transition-colors"
                                >
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <div className="p-4 border-t border-white/10">
                        <div className="flex items-center gap-2 bg-white/5 rounded-xl p-2">
                            <button
                                onClick={toggleListening}
                                className={`p-2 rounded-lg transition-colors ${
                                    isListening 
                                        ? 'bg-red-500/20 text-red-400' 
                                        : 'hover:bg-white/10 text-gray-400'
                                }`}
                            >
                                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                            </button>
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder={isListening ? "Listening..." : "Ask anything..."}
                                className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-sm"
                                disabled={loading}
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!input.trim() || loading}
                                className="p-2 bg-brand-green rounded-lg text-brand-dark hover:bg-brand-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-600 text-center mt-2">
                            Powered by AI • Data from your club
                        </p>
                    </div>
                </div>
            )}
        </>
    );
};

export default AIAssistant;
