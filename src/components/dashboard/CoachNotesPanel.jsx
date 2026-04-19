import React, { useState, useEffect } from 'react';
import { Plus, Clock } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

const NOTE_TAGS = ['Technical', 'Tactical', 'Physical', 'Mental', 'Leadership', 'Attitude', 'Improvement', 'Concern'];

const CoachNotesPanel = ({ player, readOnly = false }) => {
    const { user } = useAuth();
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [selectedTags, setSelectedTags] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (player?.id) fetchNotes();
    }, [player?.id]);

    const fetchNotes = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('coach_notes')
            .select('*')
            .eq('player_id', player.id)
            .order('created_at', { ascending: false });

        if (error) console.error('Error fetching coach notes:', error);
        setNotes(data || []);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!noteText.trim() || !player?.id || !user?.id) return;
        setSaving(true);
        const { error } = await supabase.from('coach_notes').insert([{
            player_id: player.id,
            coach_id: user.id,
            note_text: noteText.trim(),
            tags: selectedTags.length > 0 ? selectedTags : null,
        }]);

        if (error) {
            console.error('Error saving note:', error);
            alert('Failed to save note');
        } else {
            setNoteText('');
            setSelectedTags([]);
            setShowForm(false);
            fetchNotes();
        }
        setSaving(false);
    };

    const toggleTag = (tag) => {
        setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    };

    return (
        <div className="space-y-4">
            {!readOnly && (
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-brand-green/40 text-brand-green hover:bg-brand-green/10 transition-colors text-sm font-bold uppercase tracking-wider"
                >
                    <Plus className="w-4 h-4" /> New Note
                </button>
            )}

            {showForm && (
                <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-3 animate-fade-in">
                    <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Add observation, feedback, or development note..."
                        className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white text-sm focus:border-brand-green outline-none resize-none h-24"
                        autoFocus
                    />
                    <div className="flex flex-wrap gap-1.5">
                        {NOTE_TAGS.map(tag => (
                            <button
                                key={tag}
                                onClick={() => toggleTag(tag)}
                                className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider transition-colors ${
                                    selectedTags.includes(tag)
                                        ? 'bg-brand-green text-brand-dark'
                                        : 'bg-white/10 text-gray-400 hover:bg-white/20'
                                }`}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button
                            onClick={() => { setShowForm(false); setNoteText(''); setSelectedTags([]); }}
                            className="px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!noteText.trim() || saving}
                            className="px-4 py-2 bg-brand-green text-brand-dark rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-brand-green/90 disabled:opacity-50 transition-colors"
                        >
                            {saving ? 'Saving...' : 'Save Note'}
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="text-center py-8 text-gray-500">
                    <div className="w-5 h-5 border-2 border-brand-green border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading notes...
                </div>
            ) : notes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No notes yet</p>
                    {!readOnly && <p className="text-xs mt-1">Add your first observation above</p>}
                </div>
            ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {notes.map(note => (
                        <div key={note.id} className="p-3 rounded-lg bg-white/5 border border-white/5">
                            <div className="flex justify-between items-center mb-1.5">
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                                    {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    {' '}
                                    {new Date(note.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                </span>
                            </div>
                            <p className="text-sm text-gray-200 leading-relaxed">{note.note_text}</p>
                            {note.tags && note.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {note.tags.map(tag => (
                                        <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-brand-green/20 text-brand-green font-bold uppercase">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CoachNotesPanel;
