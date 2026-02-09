import React, { useState, useEffect, useRef } from 'react';
import {
    Plus, Mic, MicOff, Trash2, Clock, Play, Pause,
    ChevronDown, ChevronUp, Sparkles, X, Dumbbell, Target,
    Users, Zap, Shield, Brain, Bell, BellOff,
    Timer, RotateCcw, SkipForward, Save,
    Package, ListChecks, Lightbulb, TrendingUp, AlertCircle, CheckSquare
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

// Drill categories (same as coach builder)
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

// Score drill candidates for AI
const scoreDrillCandidate = (drill, transcript) => {
    const lowerTranscript = transcript.toLowerCase();
    const drillText = `${drill.name} ${drill.description} ${drill.category}`.toLowerCase();
    let score = 0;
    if (lowerTranscript.includes(drill.category)) score += 10;
    const nameWords = drill.name.toLowerCase().split(' ');
    nameWords.forEach(word => { if (word.length > 3 && lowerTranscript.includes(word)) score += 5; });
    const keywords = drill.description.toLowerCase().split(' ').filter(w => w.length > 4);
    keywords.forEach(word => { if (lowerTranscript.includes(word)) score += 2; });
    const commonTypes = ['passing', 'shooting', 'dribbling', 'defending', 'pressing', 'possession', 'finishing', 'crossing'];
    commonTypes.forEach(type => { if (lowerTranscript.includes(type) && drillText.includes(type)) score += 8; });
    return score;
};

const ParentSessionBuilder = ({ onClose, onSave, playerId, teamId, playerName }) => {
    const { user } = useAuth();

    // Build mode state
    const [sessionName, setSessionName] = useState('');
    const [blocks, setBlocks] = useState([]);
    const [showDrillPicker, setShowDrillPicker] = useState(false);
    const [expandedCategory, setExpandedCategory] = useState(null);
    const [expandedDrills, setExpandedDrills] = useState(new Set());
    const [drillTemplates, setDrillTemplates] = useState([]);
    const [drillsLoaded, setDrillsLoaded] = useState(false);
    const [noDrillsWarning, setNoDrillsWarning] = useState(false);
    const [saving, setSaving] = useState(false);

    // Session-level metadata (from AI)
    const [sessionEquipment, setSessionEquipment] = useState([]);
    const [sessionSetup, setSessionSetup] = useState([]);
    const [sessionNotes, setSessionNotes] = useState([]);

    // Voice/text input state
    const [isListening, setIsListening] = useState(false);
    const [voiceInput, setVoiceInput] = useState('');
    const [textInput, setTextInput] = useState('');
    const [aiProcessing, setAiProcessing] = useState(false);
    const recognitionRef = useRef(null);

    // Timer/Run mode state
    const [mode, setMode] = useState('build');
    const [isRunning, setIsRunning] = useState(false);
    const [currentDrillIndex, setCurrentDrillIndex] = useState(0);
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [alarmsEnabled, setAlarmsEnabled] = useState(true);
    const timerRef = useRef(null);

    const totalDuration = blocks.reduce((sum, b) => sum + (b.duration || 0), 0);

    // Fetch drills from database
    useEffect(() => {
        const fetchDrills = async () => {
            const { data: drills, error } = await supabase
                .from('drills')
                .select('*')
                .order('category', { ascending: true });

            if (error) {
                console.error('Error fetching drills:', error);
                setNoDrillsWarning(true);
            } else if (drills && drills.length > 0) {
                const categoryMap = {
                    'Warm-Up': 'warmup',
                    'First Touch': 'technical',
                    'Ball Mastery (Solo)': 'technical',
                    'Passing & Receiving': 'passing',
                    'Finishing & Shooting': 'shooting',
                    'Tactical / Game Intelligence': 'tactical',
                    'Defending': 'tactical',
                    'Conditioning': 'fitness',
                    'Speed & Agility': 'fitness',
                    'Small-Sided Games': 'game',
                    'Cool Down': 'cooldown'
                };

                const transformed = drills.map(d => ({
                    id: d.id,
                    category: categoryMap[d.category] || 'technical',
                    originalCategory: d.category,
                    name: d.name,
                    duration: d.duration || 10,
                    description: d.description || ''
                }));
                setDrillTemplates(transformed);
                setDrillsLoaded(true);
            } else {
                setNoDrillsWarning(true);
            }
        };
        fetchDrills();
    }, []);

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
                        if (alarmsEnabled) playAlarm();
                        if (currentDrillIndex < blocks.length - 1) {
                            setCurrentDrillIndex(i => i + 1);
                            return blocks[currentDrillIndex + 1].duration * 60;
                        } else {
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
            alert('Speech recognition not supported. Use the text input below instead.');
            return;
        }
        if (isListening) {
            recognitionRef.current.stop();
            if (voiceInput.trim()) {
                processWithAI(voiceInput);
            }
        } else {
            setVoiceInput('');
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch (err) {
                alert('Could not start microphone. Check browser permissions.');
            }
        }
    };

    const handleTextSubmit = () => {
        if (textInput.trim()) {
            processWithAI(textInput.trim());
            setTextInput('');
        }
    };

    const processWithAI = async (transcript) => {
        if (drillTemplates.length === 0) {
            alert('No drills available. Please try again later.');
            return;
        }

        setAiProcessing(true);
        try {
            const scoredDrills = drillTemplates.map(drill => ({
                ...drill,
                score: scoreDrillCandidate(drill, transcript)
            }));
            scoredDrills.sort((a, b) => b.score - a.score);
            const topCandidates = scoredDrills.slice(0, 20).map(({ id, name, category, duration, description }) => ({
                id, name, category, duration, description
            }));

            const supabaseUrl = supabase.supabaseUrl;
            const supabaseKey = supabase.supabaseKey;

            const response = await fetch(`${supabaseUrl}/functions/v1/ai-practice-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                },
                body: JSON.stringify({
                    transcript,
                    selectedEventId: null,
                    eventContext: `Solo training for ${playerName}`,
                    candidates: topCandidates
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`AI returned ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            if (!sessionName) setSessionName(data.sessionName);
            setSessionEquipment(data.equipment || []);
            setSessionSetup(data.setup || []);
            setSessionNotes(data.notesForCoach || []);

            const newBlocks = data.drills.map((drill, i) => ({
                id: drill.drillId || `custom-ai-${i}-${Date.now()}`,
                drillId: drill.drillId,
                custom: drill.custom,
                name: drill.name,
                duration: drill.minutes,
                category: drill.category,
                description: drill.description,
                setup: drill.setup || [],
                coachingPoints: drill.coachingPoints || [],
                progressions: drill.progressions || []
            }));

            setBlocks(newBlocks);
        } catch (err) {
            console.error('AI processing error:', err);
            alert(`Could not process: ${err.message}. Add drills manually.`);
        } finally {
            setAiProcessing(false);
            setVoiceInput('');
        }
    };

    const addDrill = (template) => {
        setBlocks([...blocks, {
            ...template,
            id: `${template.id}-${Date.now()}`,
            drillId: template.id,
            custom: false,
            setup: [],
            coachingPoints: [],
            progressions: []
        }]);
        setShowDrillPicker(false);
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

    const toggleDrillExpand = (index) => {
        const newExpanded = new Set(expandedDrills);
        if (newExpanded.has(index)) newExpanded.delete(index);
        else newExpanded.add(index);
        setExpandedDrills(newExpanded);
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

    // Save = create assignments with source: 'parent'
    const handleSaveAsAssignments = async () => {
        if (blocks.length === 0) {
            alert('Add at least one drill');
            return;
        }

        setSaving(true);
        try {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 7);

            // Only assign library drills (those with a valid drillId)
            const validBlocks = blocks.filter(b => b.drillId && !b.custom);
            const skippedCount = blocks.length - validBlocks.length;

            if (validBlocks.length === 0) {
                alert('No library drills to assign. Custom drills cannot be assigned as homework.');
                setSaving(false);
                return;
            }

            const assignmentRows = validBlocks.map(block => ({
                drill_id: block.drillId,
                player_id: playerId,
                team_id: teamId,
                assigned_by: user.id,
                source: 'parent',
                status: 'pending',
                custom_duration: block.duration,
                due_date: dueDate.toISOString()
            }));

            const { error } = await supabase
                .from('assignments')
                .insert(assignmentRows);

            if (error) throw error;

            const msg = skippedCount > 0
                ? `Assigned ${validBlocks.length} drills! (${skippedCount} custom drill(s) skipped)`
                : `Assigned ${validBlocks.length} drills!`;
            alert(msg);
            if (onSave) onSave();
            onClose();
        } catch (err) {
            console.error('Assignment error:', err);
            alert('Error assigning drills: ' + err.message);
        } finally {
            setSaving(false);
        }
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
                <div className="absolute top-4 left-4 right-4 flex justify-between">
                    <button onClick={() => { setIsRunning(false); setMode('build'); }} className="p-3 bg-white/10 rounded-full text-white">
                        <X className="w-6 h-6" />
                    </button>
                    <button onClick={() => setAlarmsEnabled(!alarmsEnabled)} className={`p-3 rounded-full ${alarmsEnabled ? 'bg-brand-green/20 text-brand-green' : 'bg-white/10 text-gray-500'}`}>
                        {alarmsEnabled ? <Bell className="w-6 h-6" /> : <BellOff className="w-6 h-6" />}
                    </button>
                </div>

                <div className={`p-6 rounded-2xl ${style?.bg} mb-6`}>
                    <Icon className={`w-16 h-16 ${style?.color} mx-auto`} />
                </div>

                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 text-center">{drill?.name}</h1>
                <p className="text-gray-400 mb-6 text-center">{drill?.description}</p>

                <div className="text-7xl sm:text-8xl font-mono font-bold text-brand-green mb-4">
                    {formatTime(timeRemaining)}
                </div>

                <div className="w-full max-w-md h-2 bg-white/10 rounded-full mb-6 overflow-hidden">
                    <div className="h-full bg-brand-green transition-all" style={{ width: `${progress}%` }} />
                </div>

                <p className="text-gray-500 mb-8">Drill {currentDrillIndex + 1} of {blocks.length}</p>

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
                            <Dumbbell className="w-6 h-6 text-brand-gold" />
                            Solo Training Builder
                        </h2>
                        <p className="text-gray-400 text-sm">Build a practice session for {playerName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
                        <X className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                {/* No Drills Warning */}
                {noDrillsWarning && (
                    <div className="mx-4 sm:mx-6 mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                            <div>
                                <h3 className="text-red-400 font-bold mb-1">No Drills Available</h3>
                                <p className="text-sm text-gray-300">The drill library is empty. Please contact your coach.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                    {/* Session Name */}
                    <div>
                        <label className="text-xs text-gray-400 uppercase font-bold">Session Name</label>
                        <input
                            type="text"
                            value={sessionName}
                            onChange={(e) => setSessionName(e.target.value)}
                            placeholder="e.g., After School Practice"
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white mt-1"
                        />
                    </div>

                    {/* AI Builder */}
                    <div className="glass-panel p-4">
                        <h3 className="text-white font-bold flex items-center gap-2 mb-3">
                            <Sparkles className="w-4 h-4 text-brand-gold" />
                            AI Session Builder
                        </h3>

                        {/* Voice button */}
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

                        {/* Text input fallback */}
                        <div className="flex gap-2 mt-3">
                            <input
                                type="text"
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
                                placeholder="Or type: 30 min warmup, dribbling, shooting"
                                className="flex-1 bg-white/5 border border-white/10 rounded-lg p-2.5 text-white text-sm"
                                disabled={aiProcessing}
                            />
                            <button
                                onClick={handleTextSubmit}
                                disabled={!textInput.trim() || aiProcessing}
                                className="px-4 py-2 bg-brand-gold/20 border border-brand-gold/30 rounded-lg text-brand-gold text-sm font-bold disabled:opacity-50"
                            >
                                Go
                            </button>
                        </div>
                        <p className="text-xs text-gray-600 mt-2">Try: "30 minute practice with warmup, passing drills, and shooting"</p>
                    </div>

                    {/* Session Metadata (from AI) */}
                    {(sessionEquipment.length > 0 || sessionSetup.length > 0 || sessionNotes.length > 0) && (
                        <div className="glass-panel p-4 space-y-3">
                            <h3 className="text-white font-bold text-sm">Session Overview</h3>
                            {sessionEquipment.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Package className="w-4 h-4 text-brand-gold" />
                                        <span className="text-xs text-gray-400 uppercase font-bold">Equipment</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {sessionEquipment.map((item, i) => (
                                            <span key={i} className="px-2 py-1 bg-brand-gold/10 border border-brand-gold/30 text-brand-gold text-xs rounded">{item}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {sessionSetup.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <ListChecks className="w-4 h-4 text-blue-400" />
                                        <span className="text-xs text-gray-400 uppercase font-bold">Setup Steps</span>
                                    </div>
                                    <ol className="space-y-1 text-sm text-gray-300">
                                        {sessionSetup.map((step, i) => (
                                            <li key={i} className="flex gap-2"><span className="text-blue-400 font-mono">{i + 1}.</span><span>{step}</span></li>
                                        ))}
                                    </ol>
                                </div>
                            )}
                            {sessionNotes.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Lightbulb className="w-4 h-4 text-yellow-400" />
                                        <span className="text-xs text-gray-400 uppercase font-bold">Tips</span>
                                    </div>
                                    <ul className="space-y-1 text-sm text-gray-300">
                                        {sessionNotes.map((note, i) => (
                                            <li key={i} className="flex gap-2"><span className="text-yellow-400">•</span><span>{note}</span></li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Drills */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-400" />
                                Drills <span className="text-brand-green">({totalDuration} min)</span>
                            </h3>
                            <button onClick={() => setShowDrillPicker(true)} className="px-3 py-1.5 bg-brand-green/10 border border-brand-green/30 rounded text-xs text-brand-green hover:bg-brand-green/20 flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Add Drill
                            </button>
                        </div>

                        {blocks.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-xl">
                                <Dumbbell className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                                <p className="text-gray-500">No drills yet</p>
                                <p className="text-xs text-gray-600">Use AI builder or add manually</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {blocks.map((block, i) => {
                                    const style = getCategoryStyle(block.category);
                                    const Icon = style.icon;
                                    const isExpanded = expandedDrills.has(i);
                                    const hasDetails = (block.setup?.length > 0) || (block.coachingPoints?.length > 0) || (block.progressions?.length > 0);

                                    return (
                                        <div key={block.id} className="border border-white/10 bg-white/5 rounded-lg">
                                            <div className="flex items-center gap-3 p-3">
                                                <div className="flex flex-col gap-0.5">
                                                    <button onClick={() => moveDrill(i, -1)} disabled={i === 0} className="p-1 hover:bg-white/10 rounded disabled:opacity-30"><ChevronUp className="w-3 h-3 text-gray-500" /></button>
                                                    <button onClick={() => moveDrill(i, 1)} disabled={i === blocks.length - 1} className="p-1 hover:bg-white/10 rounded disabled:opacity-30"><ChevronDown className="w-3 h-3 text-gray-500" /></button>
                                                </div>
                                                <div className={`p-2 rounded-lg ${style.bg}`}><Icon className={`w-4 h-4 ${style.color}`} /></div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-white font-bold text-sm truncate">{block.name}</p>
                                                        {block.custom && <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded border border-yellow-500/30">Custom</span>}
                                                    </div>
                                                    <p className="text-xs text-gray-500 truncate">{block.description}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => updateDuration(i, block.duration - 5)} className="w-6 h-6 rounded bg-white/10 text-gray-400 text-xs">-</button>
                                                    <span className="text-brand-green font-mono font-bold w-10 text-center">{block.duration}m</span>
                                                    <button onClick={() => updateDuration(i, block.duration + 5)} className="w-6 h-6 rounded bg-white/10 text-gray-400 text-xs">+</button>
                                                </div>
                                                {hasDetails && (
                                                    <button onClick={() => toggleDrillExpand(i)} className="p-1.5 hover:bg-white/10 rounded text-gray-500">
                                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                    </button>
                                                )}
                                                <button onClick={() => removeDrill(i)} className="p-1.5 hover:bg-red-500/20 rounded text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                                            </div>

                                            {isExpanded && hasDetails && (
                                                <div className="px-3 pb-3 pt-0 space-y-3 border-t border-white/10 mt-2">
                                                    {block.setup?.length > 0 && (
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <ListChecks className="w-3 h-3 text-blue-400" />
                                                                <span className="text-xs text-gray-400 uppercase font-bold">Setup</span>
                                                            </div>
                                                            <ul className="space-y-0.5 text-xs text-gray-300 pl-5">
                                                                {block.setup.map((s, idx) => <li key={idx} className="list-disc">{s}</li>)}
                                                            </ul>
                                                        </div>
                                                    )}
                                                    {block.coachingPoints?.length > 0 && (
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <Lightbulb className="w-3 h-3 text-yellow-400" />
                                                                <span className="text-xs text-gray-400 uppercase font-bold">Coaching Points</span>
                                                            </div>
                                                            <ul className="space-y-0.5 text-xs text-gray-300 pl-5">
                                                                {block.coachingPoints.map((cp, idx) => <li key={idx} className="list-disc">{cp}</li>)}
                                                            </ul>
                                                        </div>
                                                    )}
                                                    {block.progressions?.length > 0 && (
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <TrendingUp className="w-3 h-3 text-green-400" />
                                                                <span className="text-xs text-gray-400 uppercase font-bold">Progressions</span>
                                                            </div>
                                                            <ul className="space-y-0.5 text-xs text-gray-300 pl-5">
                                                                {block.progressions.map((p, idx) => <li key={idx} className="list-disc">{p}</li>)}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Custom drill note */}
                    {blocks.some(b => b.custom) && (
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
                            <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                            <p className="text-xs text-yellow-400">
                                Custom drills (marked yellow) will be included in the timer but won't be saved as homework assignments. Only library drills are assigned.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
                    <span className="text-sm text-gray-400">{blocks.length} drills • <span className="text-brand-green font-bold">{totalDuration} min</span></span>
                    <div className="flex gap-3">
                        {blocks.length > 0 && (
                            <button onClick={startTimer} className="px-4 py-2 bg-brand-gold/10 border border-brand-gold/30 text-brand-gold rounded-lg font-bold hover:bg-brand-gold/20 flex items-center gap-2">
                                <Timer className="w-4 h-4" /> Run with Timers
                            </button>
                        )}
                        <button
                            onClick={handleSaveAsAssignments}
                            disabled={blocks.length === 0 || saving}
                            className="px-6 py-2 bg-brand-green text-brand-dark rounded-lg font-bold hover:bg-brand-green/90 disabled:opacity-50 flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Assign as Homework'}
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
                                    const CatIcon = cat.icon;
                                    const drills = drillTemplates.filter(d => d.category === cat.id);
                                    const isExpanded = expandedCategory === cat.id;
                                    return (
                                        <div key={cat.id} className="mb-2">
                                            <button onClick={() => setExpandedCategory(isExpanded ? null : cat.id)} className={`w-full flex items-center justify-between p-3 rounded-lg ${cat.bg} ${cat.color}`}>
                                                <span className="flex items-center gap-2 font-bold"><CatIcon className="w-4 h-4" />{cat.name} ({drills.length})</span>
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
            </div>
        </div>
    );
};

export default ParentSessionBuilder;
