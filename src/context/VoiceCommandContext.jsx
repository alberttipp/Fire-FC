import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const VoiceCommandContext = createContext(null);

export const useVoiceCommand = () => {
    const context = useContext(VoiceCommandContext);
    // Return null if not within provider (graceful handling)
    return context;
};

// Command patterns and their actions
const COMMAND_PATTERNS = {
    // Navigation commands
    navigation: [
        { patterns: ['go to club', 'show club', 'club view', 'open club'], action: 'navigate', target: 'club' },
        { patterns: ['go to team', 'show team', 'team view', 'open team', 'show roster', 'roster'], action: 'navigate', target: 'team' },
        { patterns: ['go to training', 'show training', 'training view', 'open training', 'drills'], action: 'navigate', target: 'training' },
        { patterns: ['go to chat', 'show chat', 'open chat', 'messages', 'open messages'], action: 'navigate', target: 'chat' },
        { patterns: ['go to calendar', 'show calendar', 'open calendar', 'schedule', 'show schedule'], action: 'navigate', target: 'calendar' },
        { patterns: ['go to tryouts', 'show tryouts', 'open tryouts'], action: 'navigate', target: 'tryouts' },
        { patterns: ['go to financial', 'show financial', 'money', 'finances'], action: 'navigate', target: 'financial' },
        { patterns: ['player dashboard', 'switch to player', 'view as player'], action: 'route', target: '/player-dashboard' },
        { patterns: ['parent dashboard', 'switch to parent', 'view as parent'], action: 'route', target: '/parent-dashboard' },
        { patterns: ['coach dashboard', 'switch to coach', 'main dashboard'], action: 'route', target: '/dashboard' },
    ],
    // Query commands
    query: [
        { patterns: ['show stats for', 'what are', "how is", 'tell me about'], action: 'query_player' },
        { patterns: ['when is next practice', 'next practice', 'when do we practice'], action: 'query_schedule', type: 'practice' },
        { patterns: ['when is next game', 'next game', 'next match'], action: 'query_schedule', type: 'game' },
        { patterns: ['what kit', 'what uniform', 'what color'], action: 'query_kit' },
        { patterns: ['how many players', 'roster size', 'team size'], action: 'query_roster_count' },
    ],
    // Action commands
    action: [
        { patterns: ['send message', 'message coach', 'message team'], action: 'open_chat' },
        { patterns: ['add event', 'create event', 'new event'], action: 'open_calendar' },
        { patterns: ['admin panel', 'open admin', 'seed data'], action: 'open_admin' },
    ]
};

// Wake words that trigger listening
const WAKE_WORDS = ['hey fire', 'hi fire', 'okay fire', 'fire'];

export const VoiceCommandProvider = ({ children }) => {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Voice state
    const [isListening, setIsListening] = useState(false);
    const [isWakeWordMode, setIsWakeWordMode] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [lastCommand, setLastCommand] = useState(null);
    const [commandResult, setCommandResult] = useState(null);
    const [error, setError] = useState(null);
    const [voiceEnabled, setVoiceEnabled] = useState(true);

    // Dashboard view setter (will be set by Dashboard component)
    const setDashboardView = useRef(null);
    const setShowAdminPanel = useRef(null);

    // Speech recognition ref
    const recognitionRef = useRef(null);
    const wakeWordRecognitionRef = useRef(null);
    const timeoutRef = useRef(null);

    // Register dashboard controls
    const registerDashboardControls = useCallback((viewSetter, adminSetter) => {
        setDashboardView.current = viewSetter;
        setShowAdminPanel.current = adminSetter;
    }, []);

    // Initialize speech recognition
    useEffect(() => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Speech recognition not supported');
            setVoiceEnabled(false);
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        // Main command recognition
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event) => {
            const result = event.results[event.results.length - 1];
            const text = result[0].transcript.toLowerCase().trim();
            setTranscript(text);

            if (result.isFinal) {
                processCommand(text);
            }
        };

        recognitionRef.current.onerror = (e) => {
            console.error('Recognition error:', e);
            setIsListening(false);
            setError('Could not understand. Please try again.');
            setTimeout(() => setError(null), 3000);
        };

        recognitionRef.current.onend = () => {
            setIsListening(false);
        };

        // Wake word recognition (continuous background listening)
        wakeWordRecognitionRef.current = new SpeechRecognition();
        wakeWordRecognitionRef.current.continuous = true;
        wakeWordRecognitionRef.current.interimResults = true;
        wakeWordRecognitionRef.current.lang = 'en-US';

        wakeWordRecognitionRef.current.onresult = (event) => {
            const result = event.results[event.results.length - 1];
            const text = result[0].transcript.toLowerCase().trim();

            // Check for wake word
            const hasWakeWord = WAKE_WORDS.some(wake => text.includes(wake));

            if (hasWakeWord && result.isFinal) {
                // Extract command after wake word
                let command = text;
                WAKE_WORDS.forEach(wake => {
                    command = command.replace(wake, '').trim();
                });

                // Stop wake word listening, start command processing
                wakeWordRecognitionRef.current.stop();

                if (command) {
                    // Direct command after wake word
                    setTranscript(command);
                    processCommand(command);
                } else {
                    // Just wake word - start active listening
                    startListening();
                }
            }
        };

        wakeWordRecognitionRef.current.onerror = (e) => {
            if (e.error !== 'no-speech') {
                console.error('Wake word error:', e);
            }
        };

        wakeWordRecognitionRef.current.onend = () => {
            // Restart wake word listening if enabled
            if (isWakeWordMode && voiceEnabled) {
                setTimeout(() => {
                    try {
                        wakeWordRecognitionRef.current?.start();
                    } catch (e) {
                        // Ignore if already started
                    }
                }, 100);
            }
        };

        return () => {
            recognitionRef.current?.abort();
            wakeWordRecognitionRef.current?.abort();
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [isWakeWordMode, voiceEnabled]);

    // Start wake word detection
    const enableWakeWord = useCallback(() => {
        if (!voiceEnabled || !wakeWordRecognitionRef.current) return;

        setIsWakeWordMode(true);
        try {
            wakeWordRecognitionRef.current.start();
        } catch (e) {
            // Already started
        }
    }, [voiceEnabled]);

    // Stop wake word detection
    const disableWakeWord = useCallback(() => {
        setIsWakeWordMode(false);
        wakeWordRecognitionRef.current?.stop();
    }, []);

    // Start active listening for command
    const startListening = useCallback(() => {
        if (!voiceEnabled || !recognitionRef.current) return;

        setIsListening(true);
        setTranscript('');
        setError(null);
        setCommandResult(null);

        try {
            recognitionRef.current.start();
        } catch (e) {
            // Already started
        }

        // Auto-stop after 8 seconds
        timeoutRef.current = setTimeout(() => {
            stopListening();
        }, 8000);
    }, [voiceEnabled]);

    // Stop listening
    const stopListening = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        recognitionRef.current?.stop();
        setIsListening(false);
    }, []);

    // Process voice command
    const processCommand = async (text) => {
        if (!text) return;

        setIsProcessing(true);
        setLastCommand(text);

        try {
            // First try pattern matching for known commands
            const matchedCommand = findMatchingCommand(text);

            if (matchedCommand) {
                await executeCommand(matchedCommand, text);
            } else {
                // Use AI to understand the command
                const aiResult = await processWithAI(text);
                if (aiResult) {
                    setCommandResult(aiResult);
                }
            }
        } catch (err) {
            console.error('Command processing error:', err);
            setError('Could not process command');
        } finally {
            setIsProcessing(false);
            // Restart wake word listening
            if (isWakeWordMode) {
                setTimeout(() => enableWakeWord(), 1000);
            }
        }
    };

    // Find matching command pattern
    const findMatchingCommand = (text) => {
        for (const category of Object.values(COMMAND_PATTERNS)) {
            for (const cmd of category) {
                if (cmd.patterns.some(pattern => text.includes(pattern))) {
                    return cmd;
                }
            }
        }
        return null;
    };

    // Execute a matched command
    const executeCommand = async (command, originalText) => {
        switch (command.action) {
            case 'navigate':
                if (setDashboardView.current) {
                    setDashboardView.current(command.target);
                    setCommandResult({ type: 'navigation', message: `Navigating to ${command.target}` });
                }
                break;

            case 'route':
                navigate(command.target);
                setCommandResult({ type: 'navigation', message: `Opening ${command.target}` });
                break;

            case 'query_player':
                await queryPlayerStats(originalText);
                break;

            case 'query_schedule':
                await querySchedule(command.type);
                break;

            case 'query_kit':
                await queryNextKit();
                break;

            case 'query_roster_count':
                await queryRosterCount();
                break;

            case 'open_chat':
                if (setDashboardView.current) {
                    setDashboardView.current('chat');
                    setCommandResult({ type: 'action', message: 'Opening chat' });
                }
                break;

            case 'open_calendar':
                if (setDashboardView.current) {
                    setDashboardView.current('calendar');
                    setCommandResult({ type: 'action', message: 'Opening calendar' });
                }
                break;

            case 'open_admin':
                if (setShowAdminPanel.current) {
                    setShowAdminPanel.current(true);
                    setCommandResult({ type: 'action', message: 'Opening admin panel' });
                }
                break;

            default:
                setError('Unknown command');
        }
    };

    // Query player stats
    const queryPlayerStats = async (text) => {
        // Extract player name from text
        const words = text.split(' ');
        const nameIndex = words.findIndex(w =>
            ['for', 'about', 'is'].includes(w)
        );

        let playerName = '';
        if (nameIndex !== -1 && nameIndex < words.length - 1) {
            playerName = words.slice(nameIndex + 1).join(' ');
        }

        if (!playerName) {
            setCommandResult({ type: 'error', message: 'Please specify a player name' });
            return;
        }

        try {
            const { data: players } = await supabase
                .from('players')
                .select('*')
                .ilike('first_name', `%${playerName}%`);

            if (players && players.length > 0) {
                const player = players[0];
                const stats = `${player.first_name} ${player.last_name} (#${player.jersey_number}): Overall ${player.overall_rating}, PAC ${player.pace}, SHO ${player.shooting}, PAS ${player.passing}, DRI ${player.dribbling}, DEF ${player.defending}, PHY ${player.physical}`;
                setCommandResult({
                    type: 'data',
                    message: stats,
                    data: player
                });
            } else {
                setCommandResult({ type: 'error', message: `Could not find player "${playerName}"` });
            }
        } catch (err) {
            setCommandResult({ type: 'error', message: 'Error fetching player data' });
        }
    };

    // Query next event
    const querySchedule = async (type) => {
        try {
            const teamId = profile?.team_id || 'd02aba3e-3c30-430f-9377-3b334cffcd04';
            let query = supabase
                .from('events')
                .select('*')
                .eq('team_id', teamId)
                .gte('start_time', new Date().toISOString())
                .order('start_time', { ascending: true })
                .limit(1);

            if (type) {
                query = query.eq('type', type);
            }

            const { data: events } = await query;

            if (events && events.length > 0) {
                const event = events[0];
                const date = new Date(event.start_time);
                const message = `Next ${event.type}: ${event.title} on ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}${event.location_name ? ` at ${event.location_name}` : ''}`;
                setCommandResult({ type: 'data', message, data: event });
            } else {
                setCommandResult({ type: 'info', message: `No upcoming ${type || 'events'} found` });
            }
        } catch (err) {
            setCommandResult({ type: 'error', message: 'Error fetching schedule' });
        }
    };

    // Query next kit color
    const queryNextKit = async () => {
        try {
            const teamId = profile?.team_id || 'd02aba3e-3c30-430f-9377-3b334cffcd04';
            const { data: events } = await supabase
                .from('events')
                .select('*')
                .eq('team_id', teamId)
                .eq('type', 'game')
                .gte('start_time', new Date().toISOString())
                .order('start_time', { ascending: true })
                .limit(1);

            if (events && events.length > 0 && events[0].kit_color) {
                setCommandResult({
                    type: 'data',
                    message: `Next game kit: ${events[0].kit_color}`,
                    data: events[0]
                });
            } else {
                setCommandResult({ type: 'info', message: 'No kit information available for next game' });
            }
        } catch (err) {
            setCommandResult({ type: 'error', message: 'Error fetching kit info' });
        }
    };

    // Query roster count
    const queryRosterCount = async () => {
        try {
            const teamId = profile?.team_id || 'd02aba3e-3c30-430f-9377-3b334cffcd04';
            const { count } = await supabase
                .from('players')
                .select('*', { count: 'exact', head: true })
                .eq('team_id', teamId);

            setCommandResult({
                type: 'data',
                message: `Team has ${count || 0} players on the roster`
            });
        } catch (err) {
            setCommandResult({ type: 'error', message: 'Error fetching roster count' });
        }
    };

    // Process with AI for complex commands
    const processWithAI = async (text) => {
        if (!GEMINI_API_KEY) {
            return { type: 'error', message: 'AI not configured' };
        }

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            role: 'user',
                            parts: [{ text: `You are a soccer club voice assistant. The user said: "${text}"

Determine the intent and respond with a brief, helpful answer. If they want to navigate somewhere, tell them the voice command to use (e.g., "Say 'go to team' to see the roster").

Available views: club, team, training, chat, calendar, tryouts, financial
Available commands: "show stats for [name]", "when is next practice", "when is next game", "what kit"

Keep response under 50 words.` }]
                        }],
                        generationConfig: { temperature: 0.7, maxOutputTokens: 100 }
                    })
                }
            );

            const data = await response.json();
            const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (aiText) {
                return { type: 'ai', message: aiText };
            }
        } catch (err) {
            console.error('AI processing error:', err);
        }

        return { type: 'error', message: "I didn't understand that. Try saying 'go to team' or 'show stats for Bo'" };
    };

    const value = {
        // State
        isListening,
        isWakeWordMode,
        isProcessing,
        transcript,
        lastCommand,
        commandResult,
        error,
        voiceEnabled,

        // Actions
        startListening,
        stopListening,
        enableWakeWord,
        disableWakeWord,
        registerDashboardControls,

        // Clear result
        clearResult: () => setCommandResult(null),
        clearError: () => setError(null),
    };

    return (
        <VoiceCommandContext.Provider value={value}>
            {children}
        </VoiceCommandContext.Provider>
    );
};

export default VoiceCommandContext;
