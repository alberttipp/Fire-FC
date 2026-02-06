import React, { useState, useEffect, useRef } from 'react';
import { 
    Mic, MicOff, Save, Trash2, Play, Pause, Clock,
    User, Tag, Sparkles, X, ChevronDown, Search, Filter
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const VoiceScoutingNotes = ({ onClose }) => {
    const { user, profile } = useAuth();
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [playerName, setPlayerName] = useState('');
    const [tags, setTags] = useState([]);
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTag, setFilterTag] = useState('');
    const recognitionRef = useRef(null);

    // Tag suggestions
    const TAG_OPTIONS = [
        'Technical', 'Speed', 'Strength', 'Attitude', 'Leadership',
        'Left Foot', 'Right Foot', 'Heading', 'Positioning', 'Communication',
        'First Touch', 'Passing', 'Shooting', 'Defending', 'Goalkeeping'
    ];

    // Fetch existing notes
    useEffect(() => {
        fetchNotes();
    }, []);

    const fetchNotes = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('scouting_notes')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setNotes(data || []);
        } catch (err) {
            console.error('Error fetching notes:', err);
        } finally {
            setLoading(false);
        }
    };

    // Initialize speech recognition
    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = false; // Disable interim to prevent duplicates
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event) => {
                // Only process final results to prevent duplicate text
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    if (result.isFinal) {
                        const text = result[0].transcript;
                        setTranscript(prev => prev + (prev ? ' ' : '') + text.trim());
                    }
                }
            };

            recognitionRef.current.onerror = (e) => {
                console.error('Speech error:', e);
                setIsRecording(false);
            };

            recognitionRef.current.onend = () => {
                if (isRecording) {
                    // Restart if still supposed to be recording
                    recognitionRef.current.start();
                }
            };
        }
    }, [isRecording]);

    const toggleRecording = () => {
        if (!recognitionRef.current) {
            alert('Speech recognition not supported in this browser');
            return;
        }

        if (isRecording) {
            recognitionRef.current.stop();
            setIsRecording(false);
        } else {
            setTranscript('');
            recognitionRef.current.start();
            setIsRecording(true);
        }
    };

    // Process with AI to extract insights
    const processWithAI = async () => {
        if (!transcript.trim()) return;
        
        setProcessing(true);
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            role: 'user',
                            parts: [{ text: `You are a soccer scout assistant. Analyze this scouting note and extract:
1. Player name mentioned (if any)
2. Key skills/attributes observed
3. Suggested tags from this list: ${TAG_OPTIONS.join(', ')}
4. A cleaned up, professional version of the note

Raw note: "${transcript}"

Return ONLY valid JSON (no markdown):
{
  "player_name": "Name or null",
  "tags": ["tag1", "tag2"],
  "cleaned_note": "Professional version of the note"
}` }]
                        }],
                        generationConfig: { temperature: 0.3, maxOutputTokens: 512 }
                    })
                }
            );

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.player_name) setPlayerName(parsed.player_name);
                if (parsed.tags) setTags(parsed.tags);
                if (parsed.cleaned_note) setTranscript(parsed.cleaned_note);
            }
        } catch (err) {
            console.error('AI processing error:', err);
        } finally {
            setProcessing(false);
        }
    };

    // Save note
    const saveNote = async () => {
        if (!transcript.trim()) return;

        try {
            const { error } = await supabase
                .from('scouting_notes')
                .insert([{
                    created_by: user.id,
                    player_name: playerName || null,
                    note_text: transcript,
                    tags: tags.length > 0 ? tags : null,
                    created_at: new Date().toISOString()
                }]);

            if (error) throw error;

            // Reset form
            setTranscript('');
            setPlayerName('');
            setTags([]);
            
            // Refresh notes
            fetchNotes();
        } catch (err) {
            console.error('Save error:', err);
            alert('Could not save note');
        }
    };

    // Delete note
    const deleteNote = async (noteId) => {
        if (!confirm('Delete this note?')) return;
        
        try {
            await supabase.from('scouting_notes').delete().eq('id', noteId);
            setNotes(notes.filter(n => n.id !== noteId));
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    // Toggle tag
    const toggleTag = (tag) => {
        if (tags.includes(tag)) {
            setTags(tags.filter(t => t !== tag));
        } else {
            setTags([...tags, tag]);
        }
    };

    // Filter notes
    const filteredNotes = notes.filter(note => {
        const matchesSearch = !searchTerm || 
            note.note_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            note.player_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTag = !filterTag || note.tags?.includes(filterTag);
        return matchesSearch && matchesTag;
    });

    // Get all unique tags from notes
    const allTags = [...new Set(notes.flatMap(n => n.tags || []))];

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-brand-dark border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Mic className="w-6 h-6 text-brand-gold" />
                            Scouting Notes
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">Voice-to-text notes for tryouts and evaluations</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
                        <X className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex">
                    {/* Recording Panel */}
                    <div className="w-1/2 p-6 border-r border-white/10 flex flex-col">
                        <h3 className="text-white font-bold mb-4">New Note</h3>
                        
                        {/* Player Name */}
                        <div className="mb-4">
                            <label className="text-xs text-gray-400 uppercase">Player Name</label>
                            <input
                                type="text"
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                placeholder="Enter player name..."
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white mt-1"
                            />
                        </div>

                        {/* Record Button */}
                        <button
                            onClick={toggleRecording}
                            className={`w-full py-6 rounded-xl flex items-center justify-center gap-3 font-bold text-lg transition-all mb-4 ${
                                isRecording 
                                    ? 'bg-red-500/20 border-2 border-red-500 text-red-400 animate-pulse' 
                                    : 'bg-brand-gold/10 border-2 border-brand-gold/30 text-brand-gold hover:bg-brand-gold/20'
                            }`}
                        >
                            {isRecording ? (
                                <>
                                    <MicOff className="w-6 h-6" />
                                    Stop Recording
                                </>
                            ) : (
                                <>
                                    <Mic className="w-6 h-6" />
                                    Start Recording
                                </>
                            )}
                        </button>

                        {/* Transcript */}
                        <div className="flex-1 mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs text-gray-400 uppercase">Transcript</label>
                                <button
                                    onClick={processWithAI}
                                    disabled={!transcript || processing}
                                    className="text-xs text-brand-gold hover:underline flex items-center gap-1 disabled:opacity-50"
                                >
                                    <Sparkles className="w-3 h-3" />
                                    {processing ? 'Processing...' : 'AI Enhance'}
                                </button>
                            </div>
                            <textarea
                                value={transcript}
                                onChange={(e) => setTranscript(e.target.value)}
                                placeholder={isRecording ? "Listening..." : "Your note will appear here, or type manually..."}
                                className="w-full h-32 bg-white/5 border border-white/10 rounded-lg p-3 text-white resize-none"
                            />
                        </div>

                        {/* Tags */}
                        <div className="mb-4">
                            <label className="text-xs text-gray-400 uppercase mb-2 block">Tags</label>
                            <div className="flex flex-wrap gap-1">
                                {TAG_OPTIONS.slice(0, 10).map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => toggleTag(tag)}
                                        className={`px-2 py-1 rounded text-xs transition-colors ${
                                            tags.includes(tag)
                                                ? 'bg-brand-green text-brand-dark font-bold'
                                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                        }`}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Save Button */}
                        <button
                            onClick={saveNote}
                            disabled={!transcript.trim()}
                            className="w-full py-3 bg-brand-green text-brand-dark rounded-lg font-bold hover:bg-brand-green/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            Save Note
                        </button>
                    </div>

                    {/* Notes List */}
                    <div className="w-1/2 p-6 flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-bold">Recent Notes ({notes.length})</h3>
                        </div>

                        {/* Search & Filter */}
                        <div className="flex gap-2 mb-4">
                            <div className="flex-1 relative">
                                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search notes..."
                                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white text-sm"
                                />
                            </div>
                            <select
                                value={filterTag}
                                onChange={(e) => setFilterTag(e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                            >
                                <option value="">All Tags</option>
                                {allTags.map(tag => (
                                    <option key={tag} value={tag}>{tag}</option>
                                ))}
                            </select>
                        </div>

                        {/* Notes List */}
                        <div className="flex-1 overflow-y-auto space-y-3">
                            {loading ? (
                                <div className="text-center py-8">
                                    <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin mx-auto" />
                                </div>
                            ) : filteredNotes.length === 0 ? (
                                <div className="text-center py-8">
                                    <Mic className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                                    <p className="text-gray-500">No notes yet</p>
                                    <p className="text-xs text-gray-600 mt-1">Start recording to add your first note</p>
                                </div>
                            ) : (
                                filteredNotes.map(note => (
                                    <div
                                        key={note.id}
                                        className="p-4 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                {note.player_name && (
                                                    <p className="text-brand-green font-bold text-sm flex items-center gap-1">
                                                        <User className="w-3 h-3" />
                                                        {note.player_name}
                                                    </p>
                                                )}
                                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(note.created_at).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: 'numeric',
                                                        minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => deleteNote(note.id)}
                                                className="p-1 hover:bg-red-500/20 rounded text-gray-500 hover:text-red-400"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        
                                        <p className="text-white text-sm mb-2">{note.note_text}</p>
                                        
                                        {note.tags && note.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {note.tags.map(tag => (
                                                    <span
                                                        key={tag}
                                                        className="px-2 py-0.5 bg-brand-gold/10 text-brand-gold text-[10px] rounded"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VoiceScoutingNotes;
