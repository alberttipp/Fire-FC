import React, { useState, useEffect, useRef } from 'react';
import { 
    Plus, Mic, MicOff, Trash2, Clock, Save, Play, Pause, 
    ChevronDown, ChevronUp, Sparkles, X, Dumbbell, Target, 
    Users, Zap, Shield, Brain, Calendar, Bell, BellOff, 
    Timer, RotateCcw, SkipForward, Link, FolderOpen
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Drill categories
const DRILL_CATEGORIES = [
    { id: 'warmup', name: 'Warm Up', icon: Zap, color: 'text-orange-400', bg: 'bg-orange-500/20' },
    { id: 'technical', name: 'Technical', icon: Target, color: 'text-blue-400', bg: 'bg-blue-500/20' },
    { id: 'passing', name: 'Passing', icon: Users, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
    { id: 'shooting', name: 'Shooting', icon: Target, color: 'text-red-400', bg: 'bg-red-500/20' },
    { id: 'tactical', name: 'Tactical', icon: Brain, color: 'text-purple-400', bg: 'bg-purple-500/20' },
    { id: 'fitness', name: 'Fitness', icon: Dumbbell, color: 'text-green-400', bg: 'bg-green-500/20' },
    { id: 'game', name: 'Scrimmage', icon: Users, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    { id: 'cooldown', name: 'Cool Down', icon: Shield, color: 'text-teal-400', bg: 'bg-teal-500/20' },
];

// Drills will be loaded from database

// Play alarm sound
const playAlarm = () => {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        osc.type = 'sine';
        gain.gain.value = 0.5;
        osc.start();
        setTimeout(() => { osc.frequency.value = 600; }, 150);
        setTimeout(() => { osc.frequency.value = 800; }, 300);
        setTimeout(() => { osc.frequency.value = 600; }, 450);
        setTimeout(() => { osc.stop(); ctx.close(); }, 600);
    } catch (e) { console.log('Audio not supported'); }
};

const PracticeSessionBuilder = ({ onClose, onSave }) => {
    const { user, profile } = useAuth();
    
    // Build mode state
    const [sessionName, setSessionName] = useState('');
    const [blocks, setBlocks] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState(null);
    const [upcomingEvents, setUpcomingEvents] = useState([]);
    const [savedSessions, setSavedSessions] = useState([]);
    const [showDrillPicker, setShowDrillPicker] = useState(false);
    const [showCustomDrill, setShowCustomDrill] = useState(false);
    const [showSavedSessions, setShowSavedSessions] = useState(false);
    const [customDrill, setCustomDrill] = useState({ name: '', duration: 10, category: 'technical', description: '' });
    const [expandedCategory, setExpandedCategory] = useState(null);
    const [drillTemplates, setDrillTemplates] = useState([]);
    const [drillsLoaded, setDrillsLoaded] = useState(false);
    const [noDrillsWarning, setNoDrillsWarning] = useState(false);

    // Voice input state
    const [isListening, setIsListening] = useState(false);
    const [voiceInput, setVoiceInput] = useState('');
    const [aiProcessing, setAiProcessing] = useState(false);
    const recognitionRef = useRef(null);
    
    // Timer/Run mode state
    const [mode, setMode] = useState('build'); // 'build' or 'run'
    const [isRunning, setIsRunning] = useState(false);
    const [currentDrillIndex, setCurrentDrillIndex] = useState(0);
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [alarmsEnabled, setAlarmsEnabled] = useState(true);
    const timerRef = useRef(null);

    const totalDuration = blocks.reduce((sum, b) => sum + (b.duration || 0), 0);

    // Fetch events and saved sessions
    useEffect(() => {
        const fetchData = async () => {
            console.log('🔍 PracticeSessionBuilder: Starting data fetch');
            console.log('  Profile ID:', profile?.id);

            if (!profile?.id) {
                console.warn('⚠️  No profile ID - skipping fetch');
                return;
            }

            const today = new Date();
            console.log('  Today:', today.toISOString());

            // Get teams where this coach is the coach
            console.log('🔍 Fetching coach teams...');
            const { data: coachTeams, error: teamsError } = await supabase
                .from('teams')
                .select('id, name')
                .eq('coach_id', profile.id);

            if (teamsError) {
                console.error('❌ Error fetching coach teams:', teamsError);
            } else {
                console.log(`✅ Coach has ${coachTeams?.length || 0} teams:`, coachTeams);
            }

            const coachTeamIds = coachTeams?.map(t => t.id) || [];

            console.log('🔍 Executing events query for team IDs:', coachTeamIds);

            // Simple query: Get events for coach's teams
            const { data: events, error: eventsError } = await supabase
                .from('events')
                .select('*, teams(name, age_group)')
                .in('type', ['practice', 'training'])
                .in('team_id', coachTeamIds)
                .gte('start_time', today.toISOString())
                .order('start_time', { ascending: true })
                .limit(50);

            if (eventsError) {
                console.error('❌ Error fetching events:', eventsError);
                console.error('   Error details:', JSON.stringify(eventsError, null, 2));
            } else {
                console.log(`✅ Found ${events?.length || 0} upcoming events`);
                if (events && events.length > 0) {
                    console.log('📋 Events:', events.map(e => ({
                        id: e.id,
                        title: e.title,
                        start: e.start_time,
                        team: e.teams?.name
                    })));
                } else {
                    console.log('⚠️  Query returned empty array');
                }
            }

            setUpcomingEvents(events || []);

            // Get saved sessions created by this coach
            const { data: sessions } = await supabase
                .from('practice_sessions')
                .select('*')
                .eq('created_by', profile.id)
                .order('created_at', { ascending: false })
                .limit(20);

            setSavedSessions(sessions || []);

            // Get drills from database
            const { data: drills, error: drillsError } = await supabase
                .from('drills')
                .select('*')
                .order('category', { ascending: true });

            if (drillsError) {
                console.error('Error fetching drills:', drillsError);
                setNoDrillsWarning(true);
            } else if (drills && drills.length > 0) {
                // Transform to match expected format
                const transformed = drills.map(d => ({
                    id: d.id,
                    category: d.category || 'technical',
                    name: d.title,
                    duration: d.duration_minutes || 10,
                    description: d.description || ''
                }));
                setDrillTemplates(transformed);
                setDrillsLoaded(true);
                console.log(`✅ Loaded ${drills.length} drills from database`);
            } else {
                console.warn('⚠️ No drills found in database. Run: npm run seed:permanent');
                setNoDrillsWarning(true);
            }
        };

        fetchData();
    }, [profile?.id]);

    // Speech recognition setup
    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event) => {
                let transcript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    transcript += event.results[i][0].transcript;
                }
                setVoiceInput(transcript);
            };

            recognitionRef.current.onerror = () => setIsListening(false);
            recognitionRef.current.onend = () => setIsListening(false);
        }
    }, []);

    // Timer effect
    useEffect(() => {
        if (isRunning && timeRemaining > 0) {
            timerRef.current = setInterval(() => {
                setTimeRemaining(prev => {
                    if (prev <= 1) {
                        // Drill complete - play alarm
                        if (alarmsEnabled) playAlarm();
                        
                        // Move to next drill
                        if (currentDrillIndex < blocks.length - 1) {
                            setCurrentDrillIndex(i => i + 1);
                            return blocks[currentDrillIndex + 1].duration * 60;
                        } else {
                            // All drills complete
                            setIsRunning(false);
                            if (alarmsEnabled) {
                                setTimeout(() => playAlarm(), 300);
                                setTimeout(() => playAlarm(), 600);
                            }
                            return 0;
                        }
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timerRef.current);
    }, [isRunning, timeRemaining, currentDrillIndex, blocks, alarmsEnabled]);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            console.error('❌ Speech recognition not supported in this browser');
            alert('Speech recognition not supported. Use Chrome or Edge browser.');
            return;
        }
        if (isListening) {
            console.log('🛑 Stopping voice recording...');
            recognitionRef.current.stop();
            if (voiceInput.trim()) {
                console.log('🎤 Voice input captured:', voiceInput);
                processVoiceWithAI(voiceInput);
            } else {
                console.warn('⚠️ No voice input captured');
            }
        } else {
            console.log('🎤 Starting voice recording...');
            setVoiceInput('');
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch (err) {
                console.error('❌ Error starting recognition:', err);
                alert('Could not start microphone. Check browser permissions.');
            }
        }
    };

    const processVoiceWithAI = async (transcript) => {
        console.log('🤖 Processing with AI:', transcript);

        if (!GEMINI_API_KEY) {
            console.error('❌ Gemini API key not found in environment');
            alert('Gemini API key missing. Check .env file for VITE_GEMINI_API_KEY');
            return;
        }

        setAiProcessing(true);
        try {
            console.log('📡 Calling Gemini API...');
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            role: 'user',
                            parts: [{ text: `Convert this practice plan to JSON drills. Voice: "${transcript}"
Categories: warmup, passing, technical, shooting, tactical, fitness, game, cooldown
Return ONLY JSON array: [{"name":"Drill","duration":10,"category":"warmup","description":"Brief"}]
Total should be approximately 100 minutes. MUST include warmup (10min) at start and cooldown (5min) at end.` }]
                        }],
                        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
                    })
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Gemini API error:', response.status, errorText);
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Gemini response:', data);

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            console.log('📝 Generated text:', text);

            const match = text.match(/\[[\s\S]*\]/);
            if (match) {
                const drills = JSON.parse(match[0]);
                console.log(`✅ Generated ${drills.length} drills:`, drills);
                setBlocks(drills.map((d, i) => ({ ...d, id: `ai-${i}-${Date.now()}` })));
            } else {
                console.error('❌ No JSON array found in response');
                alert('AI could not generate drills. Try being more specific or add drills manually.');
            }
        } catch (err) {
            console.error('❌ AI processing error:', err);
            alert(`Could not process voice: ${err.message}. Add drills manually.`);
        } finally {
            setAiProcessing(false);
            setVoiceInput('');
        }
    };

    const addDrill = (template) => {
        setBlocks([...blocks, { ...template, id: `${template.id}-${Date.now()}` }]);
        setShowDrillPicker(false);
    };

    const addCustomDrill = () => {
        if (!customDrill.name) return;
        setBlocks([...blocks, { ...customDrill, id: `custom-${Date.now()}` }]);
        setCustomDrill({ name: '', duration: 10, category: 'technical', description: '' });
        setShowCustomDrill(false);
    };

    const removeDrill = (index) => setBlocks(blocks.filter((_, i) => i !== index));

    const updateDuration = (index, dur) => {
        const updated = [...blocks];
        updated[index].duration = Math.max(5, Math.min(60, dur));
        setBlocks(updated);
    };

    const moveDrill = (index, dir) => {
        const newIndex = index + dir;
        if (newIndex < 0 || newIndex >= blocks.length) return;
        const newBlocks = [...blocks];
        [newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
        setBlocks(newBlocks);
    };

    const startTimer = () => {
        if (blocks.length === 0) return;
        setMode('run');
        setCurrentDrillIndex(0);
        setTimeRemaining(blocks[0].duration * 60);
        setIsRunning(true);
    };

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleSave = async () => {
        if (!sessionName || blocks.length === 0) {
            alert('Add a name and at least one drill');
            return;
        }

        // Validate that we have a profile ID (required FK)
        if (!profile?.id) {
            alert('Error: No profile found. Please make sure you are logged in.');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('practice_sessions')
                .insert([{
                    team_id: null, // Not team-specific, can be used for any coach's team
                    event_id: selectedEventId || null,
                    created_by: profile.id,
                    name: sessionName,
                    total_duration: totalDuration,
                    drills: blocks,
                    status: selectedEventId ? 'scheduled' : 'draft'
                }])
                .select()
                .single();

            if (error) throw error;
            
            alert('✓ Session saved!');
            if (onSave) onSave(data);
            
            // Refresh saved sessions
            const { data: sessions } = await supabase
                .from('practice_sessions')
                .select('*')
                .order('created_at', { ascending: false });
            setSavedSessions(sessions || []);
        } catch (err) {
            console.error('Save error:', err);
            alert('Error saving: ' + err.message);
        }
    };

    const loadSession = (session) => {
        setSessionName(session.name);
        setBlocks(session.drills || []);
        setSelectedEventId(session.event_id);
        setShowSavedSessions(false);
    };

    const getCategoryStyle = (catId) => DRILL_CATEGORIES.find(c => c.id === catId) || DRILL_CATEGORIES[1];

    // ========== RUN MODE UI ==========
    if (mode === 'run') {
        const drill = blocks[currentDrillIndex];
        const style = getCategoryStyle(drill?.category);
        const Icon = style?.icon || Dumbbell;
        const progress = ((drill?.duration * 60 - timeRemaining) / (drill?.duration * 60)) * 100;

        return (
            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 p-4">
                {/* Top controls */}
                <div className="absolute top-4 left-4 right-4 flex justify-between">
                    <button onClick={() => { setIsRunning(false); setMode('build'); }} className="p-3 bg-white/10 rounded-full text-white">
                        <X className="w-6 h-6" />
                    </button>
                    <button onClick={() => setAlarmsEnabled(!alarmsEnabled)} className={`p-3 rounded-full ${alarmsEnabled ? 'bg-brand-green/20 text-brand-green' : 'bg-white/10 text-gray-500'}`}>
                        {alarmsEnabled ? <Bell className="w-6 h-6" /> : <BellOff className="w-6 h-6" />}
                    </button>
                </div>

                {/* Current drill */}
                <div className={`p-6 rounded-2xl ${style?.bg} mb-6`}>
                    <Icon className={`w-16 h-16 ${style?.color} mx-auto`} />
                </div>
                
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 text-center">{drill?.name}</h1>
                <p className="text-gray-400 mb-6 text-center">{drill?.description}</p>

                {/* Timer */}
                <div className="text-7xl sm:text-8xl font-mono font-bold text-brand-green mb-4">
                    {formatTime(timeRemaining)}
                </div>

                {/* Progress bar */}
                <div className="w-full max-w-md h-2 bg-white/10 rounded-full mb-6 overflow-hidden">
                    <div className="h-full bg-brand-green transition-all" style={{ width: `${progress}%` }} />
                </div>

                <p className="text-gray-500 mb-8">Drill {currentDrillIndex + 1} of {blocks.length}</p>

                {/* Controls */}
                <div className="flex gap-4">
                    <button onClick={() => { setCurrentDrillIndex(0); setTimeRemaining(blocks[0].duration * 60); }} className="p-4 bg-white/10 rounded-full text-white">
                        <RotateCcw className="w-8 h-8" />
                    </button>
                    <button onClick={() => setIsRunning(!isRunning)} className="p-6 bg-brand-green rounded-full text-brand-dark">
                        {isRunning ? <Pause className="w-12 h-12" /> : <Play className="w-12 h-12" />}
                    </button>
                    <button onClick={() => {
                        if (currentDrillIndex < blocks.length - 1) {
                            setCurrentDrillIndex(i => i + 1);
                            setTimeRemaining(blocks[currentDrillIndex + 1].duration * 60);
                        }
                    }} className="p-4 bg-white/10 rounded-full text-white">
                        <SkipForward className="w-8 h-8" />
                    </button>
                </div>

                {/* Upcoming drills */}
                <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-xs text-gray-600 uppercase mb-2">Up Next</p>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {blocks.slice(currentDrillIndex + 1, currentDrillIndex + 4).map((d, i) => (
                            <div key={i} className="px-3 py-2 bg-white/5 rounded-lg text-sm text-gray-400 whitespace-nowrap">
                                {d.name} ({d.duration}m)
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ========== BUILD MODE UI ==========
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-brand-dark border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Dumbbell className="w-6 h-6 text-brand-green" />
                            Practice Session Builder
                        </h2>
                        <p className="text-gray-400 text-sm">Coach only • Build & run training sessions</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowSavedSessions(true)} className="p-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white">
                            <FolderOpen className="w-5 h-5" />
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
                            <X className="w-6 h-6 text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Drills Warning Banner */}
                {noDrillsWarning && (
                    <div className="mx-4 sm:mx-6 mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <div className="flex items-start gap-3">
                            <div className="text-red-400 text-2xl">⚠️</div>
                            <div className="flex-1">
                                <h3 className="text-red-400 font-bold mb-1">No Drills Found in Database</h3>
                                <p className="text-sm text-gray-300 mb-2">
                                    The drills table is empty. You need to seed permanent data before you can build practice sessions.
                                </p>
                                <div className="text-xs text-gray-400 space-y-1">
                                    <p><strong className="text-white">Step 1:</strong> Run <code className="bg-black/30 px-1 rounded">npm run seed:permanent</code> in your terminal</p>
                                    <p><strong className="text-white">Step 2:</strong> Open Supabase Dashboard → SQL Editor</p>
                                    <p><strong className="text-white">Step 3:</strong> Copy/paste contents of <code className="bg-black/30 px-1 rounded">supabase/seed/seed_permanent.sql</code></p>
                                    <p><strong className="text-white">Step 4:</strong> Click "Run" - should seed 156 drills and 15 badges</p>
                                    <p className="text-brand-gold mt-2">See <code className="bg-black/30 px-1 rounded">supabase/seed/SEED_POLICY.md</code> for full instructions</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                    {/* Session Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-gray-400 uppercase font-bold">Session Name *</label>
                            <input
                                type="text"
                                value={sessionName}
                                onChange={(e) => setSessionName(e.target.value)}
                                placeholder="e.g., Tuesday Technical Training"
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 uppercase font-bold">Attach to Event</label>
                            <select
                                value={selectedEventId || ''}
                                onChange={(e) => setSelectedEventId(e.target.value || null)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white mt-1"
                            >
                                <option value="" className="bg-gray-800 text-white">-- Standalone (not linked) --</option>
                                {upcomingEvents.length === 0 && <option disabled className="bg-gray-800 text-white">No upcoming events found</option>}
                                {(() => {
                                    console.log('🎨 RENDERING dropdown with upcomingEvents:', upcomingEvents.length, 'events');
                                    return upcomingEvents.map((ev, idx) => {
                                        console.log(`  Event ${idx + 1}:`, { id: ev.id, title: ev.title, team: ev.teams });
                                        const date = new Date(ev.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                                        const time = new Date(ev.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                                        const teamName = ev.teams?.name || '';
                                        const ageGroup = ev.teams?.age_group || '';
                                        const teamDisplay = ageGroup ? `${teamName} ${ageGroup}` : teamName;
                                        const displayText = `${date} @ ${time} - ${ev.title} ${teamDisplay ? `(${teamDisplay})` : ''}`;
                                        console.log(`  Display text: "${displayText}"`);
                                        return (
                                            <option key={ev.id} value={ev.id} className="bg-gray-800 text-white">
                                                {displayText}
                                            </option>
                                        );
                                    });
                                })()}
                            </select>
                        </div>
                    </div>

                    {/* Voice Builder */}
                    <div className="glass-panel p-4">
                        <h3 className="text-white font-bold flex items-center gap-2 mb-3">
                            <Sparkles className="w-4 h-4 text-brand-gold" />
                            AI Voice Builder
                        </h3>
                        <button
                            onClick={toggleListening}
                            disabled={aiProcessing}
                            className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${
                                isListening 
                                    ? 'bg-red-500/20 border-2 border-red-500 text-red-400 animate-pulse' 
                                    : 'bg-brand-green/10 border-2 border-brand-green/30 text-brand-green hover:bg-brand-green/20'
                            }`}
                        >
                            {aiProcessing ? (
                                <><div className="w-5 h-5 border-2 border-brand-green border-t-transparent rounded-full animate-spin" /> Processing...</>
                            ) : isListening ? (
                                <><MicOff className="w-5 h-5" /> Stop & Create</>
                            ) : (
                                <><Mic className="w-5 h-5" /> Speak Your Practice Plan</>
                            )}
                        </button>
                        {voiceInput && <p className="mt-3 text-sm text-gray-400 bg-white/5 p-3 rounded-lg">"{voiceInput}"</p>}
                        <p className="text-xs text-gray-600 mt-2">Try: "60 minute practice with warmup, passing, shooting, scrimmage, cooldown"</p>
                    </div>

                    {/* Drills */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-400" />
                                Drills <span className="text-brand-green">({totalDuration} min)</span>
                            </h3>
                            <div className="flex gap-2">
                                <button onClick={() => setShowCustomDrill(true)} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-gray-300 hover:bg-white/10">+ Custom</button>
                                <button onClick={() => setShowDrillPicker(true)} className="px-3 py-1.5 bg-brand-green/10 border border-brand-green/30 rounded text-xs text-brand-green hover:bg-brand-green/20 flex items-center gap-1"><Plus className="w-3 h-3" /> Add Drill</button>
                            </div>
                        </div>

                        {blocks.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-xl">
                                <Dumbbell className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                                <p className="text-gray-500">No drills yet</p>
                                <p className="text-xs text-gray-600">Use voice or add manually</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {blocks.map((block, i) => {
                                    const style = getCategoryStyle(block.category);
                                    const Icon = style.icon;
                                    return (
                                        <div key={block.id} className="flex items-center gap-3 p-3 rounded-lg border border-white/10 bg-white/5">
                                            <div className="flex flex-col gap-0.5">
                                                <button onClick={() => moveDrill(i, -1)} disabled={i === 0} className="p-1 hover:bg-white/10 rounded disabled:opacity-30"><ChevronUp className="w-3 h-3 text-gray-500" /></button>
                                                <button onClick={() => moveDrill(i, 1)} disabled={i === blocks.length - 1} className="p-1 hover:bg-white/10 rounded disabled:opacity-30"><ChevronDown className="w-3 h-3 text-gray-500" /></button>
                                            </div>
                                            <div className={`p-2 rounded-lg ${style.bg}`}><Icon className={`w-4 h-4 ${style.color}`} /></div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white font-bold text-sm truncate">{block.name}</p>
                                                <p className="text-xs text-gray-500 truncate">{block.description}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => updateDuration(i, block.duration - 5)} className="w-6 h-6 rounded bg-white/10 text-gray-400 text-xs">-</button>
                                                <span className="text-brand-green font-mono font-bold w-10 text-center">{block.duration}m</span>
                                                <button onClick={() => updateDuration(i, block.duration + 5)} className="w-6 h-6 rounded bg-white/10 text-gray-400 text-xs">+</button>
                                            </div>
                                            <button onClick={() => removeDrill(i)} className="p-1.5 hover:bg-red-500/20 rounded text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-400">{blocks.length} drills • <span className="text-brand-green font-bold">{totalDuration} min</span></span>
                        {selectedEventId && <span className="px-2 py-1 bg-brand-gold/20 text-brand-gold text-xs rounded flex items-center gap-1"><Link className="w-3 h-3" /> Linked</span>}
                    </div>
                    <div className="flex gap-3">
                        {blocks.length > 0 && (
                            <button onClick={startTimer} className="px-4 py-2 bg-brand-gold/10 border border-brand-gold/30 text-brand-gold rounded-lg font-bold hover:bg-brand-gold/20 flex items-center gap-2">
                                <Timer className="w-4 h-4" /> Run with Timers
                            </button>
                        )}
                        <button onClick={handleSave} disabled={!sessionName || blocks.length === 0} className="px-6 py-2 bg-brand-green text-brand-dark rounded-lg font-bold hover:bg-brand-green/90 disabled:opacity-50 flex items-center gap-2">
                            <Save className="w-4 h-4" /> Save
                        </button>
                    </div>
                </div>

                {/* Drill Picker Modal */}
                {showDrillPicker && (
                    <div className="absolute inset-0 bg-black/90 flex items-center justify-center p-4 z-10">
                        <div className="bg-brand-dark border border-white/10 rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
                            <div className="p-4 border-b border-white/10 flex items-center justify-between">
                                <h3 className="text-white font-bold">Add Drill</h3>
                                <button onClick={() => setShowDrillPicker(false)} className="p-1 hover:bg-white/10 rounded"><X className="w-5 h-5 text-gray-400" /></button>
                            </div>
                            <div className="p-4 overflow-y-auto max-h-[60vh]">
                                {DRILL_CATEGORIES.map(cat => {
                                    const Icon = cat.icon;
                                    const drills = drillTemplates.filter(d => d.category === cat.id);
                                    const isExpanded = expandedCategory === cat.id;
                                    return (
                                        <div key={cat.id} className="mb-2">
                                            <button onClick={() => setExpandedCategory(isExpanded ? null : cat.id)} className={`w-full flex items-center justify-between p-3 rounded-lg ${cat.bg} ${cat.color}`}>
                                                <span className="flex items-center gap-2 font-bold"><Icon className="w-4 h-4" />{cat.name} ({drills.length})</span>
                                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </button>
                                            {isExpanded && (
                                                <div className="mt-1 space-y-1 pl-4">
                                                    {drills.map(drill => (
                                                        <button key={drill.id} onClick={() => addDrill(drill)} className="w-full flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 text-left">
                                                            <div>
                                                                <p className="text-white text-sm font-medium">{drill.name}</p>
                                                                <p className="text-xs text-gray-500">{drill.description}</p>
                                                            </div>
                                                            <span className="text-brand-green text-sm font-mono">{drill.duration}m</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Custom Drill Modal */}
                {showCustomDrill && (
                    <div className="absolute inset-0 bg-black/90 flex items-center justify-center p-4 z-10">
                        <div className="bg-brand-dark border border-white/10 rounded-xl w-full max-w-md p-6">
                            <h3 className="text-white font-bold mb-4">Add Custom Drill</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-gray-400 uppercase">Name *</label>
                                    <input type="text" value={customDrill.name} onChange={(e) => setCustomDrill({ ...customDrill, name: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1" placeholder="e.g., Rondo 5v2" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase">Duration</label>
                                        <select value={customDrill.duration} onChange={(e) => setCustomDrill({ ...customDrill, duration: parseInt(e.target.value) })} className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1">
                                            {[5,10,15,20,25,30].map(n => <option key={n} value={n}>{n} min</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase">Category</label>
                                        <select value={customDrill.category} onChange={(e) => setCustomDrill({ ...customDrill, category: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1">
                                            {DRILL_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 uppercase">Description</label>
                                    <textarea value={customDrill.description} onChange={(e) => setCustomDrill({ ...customDrill, description: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded p-2 text-white mt-1 h-16 resize-none" />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setShowCustomDrill(false)} className="flex-1 py-2 border border-white/10 rounded text-gray-400">Cancel</button>
                                <button onClick={addCustomDrill} disabled={!customDrill.name} className="flex-1 py-2 bg-brand-green text-brand-dark rounded font-bold disabled:opacity-50">Add</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Saved Sessions Modal */}
                {showSavedSessions && (
                    <div className="absolute inset-0 bg-black/90 flex items-center justify-center p-4 z-10">
                        <div className="bg-brand-dark border border-white/10 rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
                            <div className="p-4 border-b border-white/10 flex items-center justify-between">
                                <h3 className="text-white font-bold">Load Saved Session</h3>
                                <button onClick={() => setShowSavedSessions(false)} className="p-1 hover:bg-white/10 rounded"><X className="w-5 h-5 text-gray-400" /></button>
                            </div>
                            <div className="p-4 overflow-y-auto max-h-[60vh]">
                                {savedSessions.length === 0 ? (
                                    <p className="text-center text-gray-500 py-8">No saved sessions yet</p>
                                ) : (
                                    <div className="space-y-2">
                                        {savedSessions.map(session => (
                                            <button key={session.id} onClick={() => loadSession(session)} className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-lg text-left">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-white font-bold">{session.name}</p>
                                                    <span className="text-brand-green text-sm">{session.total_duration}m</span>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1">{session.drills?.length || 0} drills • {new Date(session.created_at).toLocaleDateString()}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PracticeSessionBuilder;
