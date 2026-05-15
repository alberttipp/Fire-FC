import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, MicOff, StopCircle, Save, Star, ChevronLeft, Wand2, Loader2, Clock, Trash2, Tag, Users, Mail, Phone, Target, Pencil } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import { useConfirm } from '../ConfirmDialog';

const STATUS_OPTIONS = ['pending', 'contacted', 'scheduled', 'tried_out', 'accepted', 'declined'];

const TAG_OPTIONS = [
    'Technical', 'Speed', 'Strength', 'Attitude', 'Leadership',
    'Left Foot', 'Right Foot', 'Positioning', 'Passing', 'Shooting', 'Defending'
];

// Same 9-position vocabulary as the public TryoutSignup form
const POSITIONS = [
    'Goalkeeper', 'Center Back', 'Fullback', 'Defensive Midfielder',
    'Center Midfielder', 'Attacking Midfielder', 'Winger', 'Striker', 'Anywhere',
];

const ScoutCard = ({ prospect, onClose, onStatusChange, onUpdate, onDelete }) => {
    const { user } = useAuth();
    const toast = useToast();
    const confirm = useConfirm();
    const [notes, setNotes] = useState([]);
    const [loadingNotes, setLoadingNotes] = useState(true);
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [selectedTags, setSelectedTags] = useState([]);
    const [saving, setSaving] = useState(false);
    const [rating, setRating] = useState({ technical: 3, tactical: 3, physical: 3, mental: 3 });
    const recognitionRef = useRef(null);

    // Edit-profile form state
    const [editing, setEditing] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '',
        age_group: '',
        parent_name: '',
        email: '',
        phone: '',
        notes: '',
        position1: '',
        position2: '',
    });

    // Reset edit form whenever the loaded prospect changes
    useEffect(() => {
        if (!prospect) return;
        setEditing(false);
        setEditForm({
            name: prospect.name || '',
            age_group: prospect.age_group || '',
            parent_name: prospect.parent_name || '',
            email: prospect.email || '',
            phone: prospect.phone || '',
            notes: prospect.notes || '',
            position1: prospect.preferred_positions?.[0] || '',
            position2: prospect.preferred_positions?.[1] || '',
        });
    }, [prospect?.id]);

    const handleSaveProfile = async () => {
        if (!editForm.name.trim()) {
            toast.error('Name is required.');
            return;
        }
        if (editForm.position1 && editForm.position2 && editForm.position1 === editForm.position2) {
            toast.error("1st and 2nd favorite positions can't be the same.");
            return;
        }
        const fields = {
            name: editForm.name.trim(),
            age_group: editForm.age_group.trim() || null,
            parent_name: editForm.parent_name.trim() || null,
            email: editForm.email.trim() || null,
            phone: editForm.phone.trim() || null,
            notes: editForm.notes.trim() || null,
            preferred_positions: [editForm.position1, editForm.position2].filter(Boolean),
        };
        setSavingProfile(true);
        const ok = await (onUpdate ? onUpdate(prospect.id, fields) : Promise.resolve(false));
        setSavingProfile(false);
        if (ok) setEditing(false);
    };

    const handleDeleteClick = async () => {
        if (!onDelete) return;
        await onDelete(prospect);
        // Parent (TryoutHub) clears selectedPlayer on success, which unmounts this card.
    };

    // Fetch scouting notes for this prospect
    useEffect(() => {
        if (prospect?.name) {
            fetchNotes();
        }
    }, [prospect?.name]);

    // Initialize speech recognition
    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event) => {
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
                    try { recognitionRef.current.start(); } catch (e) { /* already started */ }
                }
            };
        }

        return () => {
            if (recognitionRef.current && isRecording) {
                try { recognitionRef.current.stop(); } catch (e) { /* ok */ }
            }
        };
    }, [isRecording]);

    const fetchNotes = async () => {
        setLoadingNotes(true);
        try {
            const { data, error } = await supabase
                .from('scouting_notes')
                .select('*')
                .eq('player_name', prospect.name)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setNotes(data || []);
        } catch (err) {
            console.error('Error fetching notes:', err);
        } finally {
            setLoadingNotes(false);
        }
    };

    const toggleRecording = () => {
        if (!recognitionRef.current) {
            toast.warning("Voice input isn't supported on this browser — type your note below.");
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

    const saveNote = async () => {
        if (!transcript.trim()) return;
        setSaving(true);

        try {
            const { error } = await supabase
                .from('scouting_notes')
                .insert([{
                    created_by: user.id,
                    player_name: prospect.name,
                    note_text: transcript.trim(),
                    tags: selectedTags.length > 0 ? selectedTags : null
                }]);

            if (error) throw error;

            setTranscript('');
            setSelectedTags([]);
            fetchNotes();
        } catch (err) {
            console.error('Save error:', err);
            toast.error("Couldn't save the note. Try again.");
        } finally {
            setSaving(false);
        }
    };

    const saveRating = async () => {
        setSaving(true);
        try {
            const ratingText = Object.entries(rating)
                .map(([cat, val]) => `${cat}: ${val}/5`)
                .join(', ');

            const { error } = await supabase
                .from('scouting_notes')
                .insert([{
                    created_by: user.id,
                    player_name: prospect.name,
                    note_text: `Quick Grade: ${ratingText}`,
                    tags: ['Rating']
                }]);

            if (error) throw error;
            fetchNotes();
        } catch (err) {
            console.error('Save rating error:', err);
        } finally {
            setSaving(false);
        }
    };

    const deleteNote = async (noteId) => {
        const ok = await confirm({
            title: 'Delete this note?',
            confirmLabel: 'Delete',
            destructive: true,
        });
        if (!ok) return;
        try {
            await supabase.from('scouting_notes').delete().eq('id', noteId);
            setNotes(notes.filter(n => n.id !== noteId));
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    const toggleTag = (tag) => {
        setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    };

    return (
        <div className="flex flex-col h-full relative">
            {/* Header / Nav (Mobile only back button) */}
            <div className="md:hidden p-4 border-b border-white/10 flex items-center gap-2">
                <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <span className="text-white font-bold uppercase">Back to List</span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {/* Player Header */}
                <div className="flex items-start justify-between mb-4 gap-3">
                    <div className="flex gap-4 min-w-0">
                        <div className="w-16 h-16 bg-gray-800 rounded-lg flex items-center justify-center border-2 border-white/10 text-2xl font-bold text-gray-500 shrink-0">
                            {prospect.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-2xl text-white font-display uppercase font-bold tracking-wider leading-none truncate">{prospect.name}</h2>
                            <div className="flex items-center gap-3 mt-2 text-sm flex-wrap">
                                {prospect.age_group && (
                                    <span className="bg-white/10 px-2 py-0.5 rounded text-white font-bold">{prospect.age_group}</span>
                                )}
                                {prospect.status && (
                                    <select
                                        value={prospect.status}
                                        onChange={(e) => onStatusChange?.(prospect.id, e.target.value)}
                                        className="bg-white/10 px-2 py-0.5 rounded text-white text-xs font-bold uppercase border border-white/10 cursor-pointer"
                                    >
                                        {STATUS_OPTIONS.map(s => (
                                            <option key={s} value={s} className="bg-gray-900">{s.replace('_', ' ')}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            {prospect.notes && !editing && (
                                <p className="text-gray-400 text-xs mt-2 max-w-md">{prospect.notes}</p>
                            )}
                        </div>
                    </div>
                    {onUpdate && !editing && (
                        <button
                            onClick={() => setEditing(true)}
                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-gray-300 text-xs font-bold uppercase tracking-wider hover:bg-white/5 hover:text-white transition-colors"
                            aria-label="Edit prospect"
                        >
                            <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                    )}
                </div>

                {/* Edit Profile form (inline, replaces Contact & Preferences while open) */}
                {editing && (
                    <div className="mb-6 p-4 bg-black/30 rounded-xl border border-brand-green/30 space-y-3">
                        <div className="flex items-center justify-between mb-1">
                            <h4 className="text-brand-green text-xs uppercase font-bold tracking-wider">Edit prospect</h4>
                            <button
                                onClick={() => setEditing(false)}
                                className="text-gray-400 hover:text-white text-xs"
                            >
                                Cancel
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className="block">
                                <span className="text-gray-400 text-[11px] uppercase tracking-wider">Full name</span>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green"
                                />
                            </label>
                            <label className="block">
                                <span className="text-gray-400 text-[11px] uppercase tracking-wider">Age group</span>
                                <input
                                    type="text"
                                    placeholder="e.g. U12"
                                    value={editForm.age_group}
                                    onChange={(e) => setEditForm({ ...editForm, age_group: e.target.value })}
                                    className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green"
                                />
                            </label>
                            <label className="block">
                                <span className="text-gray-400 text-[11px] uppercase tracking-wider">Parent / Guardian name</span>
                                <input
                                    type="text"
                                    value={editForm.parent_name}
                                    onChange={(e) => setEditForm({ ...editForm, parent_name: e.target.value })}
                                    className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green"
                                />
                            </label>
                            <label className="block">
                                <span className="text-gray-400 text-[11px] uppercase tracking-wider">Phone</span>
                                <input
                                    type="tel"
                                    value={editForm.phone}
                                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                    className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green"
                                />
                            </label>
                            <label className="block sm:col-span-2">
                                <span className="text-gray-400 text-[11px] uppercase tracking-wider">Email</span>
                                <input
                                    type="email"
                                    value={editForm.email}
                                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                    className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green"
                                />
                            </label>
                            <label className="block">
                                <span className="text-gray-400 text-[11px] uppercase tracking-wider">1st favorite position</span>
                                <select
                                    value={editForm.position1}
                                    onChange={(e) => {
                                        const next = e.target.value;
                                        setEditForm({
                                            ...editForm,
                                            position1: next,
                                            position2: next && editForm.position2 === next ? '' : editForm.position2,
                                        });
                                    }}
                                    className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green"
                                >
                                    <option value="">(none)</option>
                                    {POSITIONS.map(p => (<option key={p} value={p}>{p}</option>))}
                                </select>
                            </label>
                            <label className="block">
                                <span className="text-gray-400 text-[11px] uppercase tracking-wider">2nd favorite position</span>
                                <select
                                    value={editForm.position2}
                                    onChange={(e) => setEditForm({ ...editForm, position2: e.target.value })}
                                    className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green"
                                >
                                    <option value="">(none)</option>
                                    {POSITIONS.filter(p => p !== editForm.position1).map(p => (<option key={p} value={p}>{p}</option>))}
                                </select>
                            </label>
                            <label className="block sm:col-span-2">
                                <span className="text-gray-400 text-[11px] uppercase tracking-wider">Notes</span>
                                <textarea
                                    rows={2}
                                    value={editForm.notes}
                                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                                    className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green resize-none"
                                />
                            </label>
                        </div>

                        <button
                            onClick={handleSaveProfile}
                            disabled={savingProfile}
                            className="w-full mt-2 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-brand-green text-brand-dark text-sm font-bold uppercase tracking-wider hover:bg-brand-green/90 disabled:opacity-50"
                        >
                            {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {savingProfile ? 'Saving…' : 'Save changes'}
                        </button>
                    </div>
                )}

                {/* Contact + Preferences — pulled from the public tryout signup form */}
                {(prospect.parent_name || prospect.email || prospect.phone || prospect.preferred_positions?.length > 0) && (
                    <div className="mb-6 p-4 bg-black/20 rounded-xl border border-white/5 space-y-2.5">
                        <h4 className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-3">Contact & Preferences</h4>
                        {prospect.parent_name && (
                            <div className="flex items-start gap-2.5 text-sm">
                                <Users className="w-4 h-4 text-brand-green mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                    <span className="text-gray-500 text-[11px] uppercase tracking-wider block">Parent / Guardian</span>
                                    <span className="text-white truncate block">{prospect.parent_name}</span>
                                </div>
                            </div>
                        )}
                        {prospect.email && (
                            <div className="flex items-start gap-2.5 text-sm">
                                <Mail className="w-4 h-4 text-brand-green mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                    <span className="text-gray-500 text-[11px] uppercase tracking-wider block">Email</span>
                                    <a href={`mailto:${prospect.email}`} className="text-white hover:text-brand-green truncate block">
                                        {prospect.email}
                                    </a>
                                </div>
                            </div>
                        )}
                        {prospect.phone && (
                            <div className="flex items-start gap-2.5 text-sm">
                                <Phone className="w-4 h-4 text-brand-green mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                    <span className="text-gray-500 text-[11px] uppercase tracking-wider block">Phone</span>
                                    <a href={`tel:${prospect.phone}`} className="text-white hover:text-brand-green block">
                                        {prospect.phone}
                                    </a>
                                </div>
                            </div>
                        )}
                        {prospect.preferred_positions?.length > 0 && (
                            <div className="flex items-start gap-2.5 text-sm">
                                <Target className="w-4 h-4 text-brand-gold mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                    <span className="text-gray-500 text-[11px] uppercase tracking-wider block">Favorite Positions</span>
                                    <div className="flex flex-wrap gap-1.5 mt-0.5">
                                        {prospect.preferred_positions.slice(0, 2).map((pos, i) => (
                                            <span
                                                key={pos}
                                                className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                                                    i === 0
                                                        ? 'bg-brand-gold/20 text-brand-gold border border-brand-gold/30'
                                                        : 'bg-white/5 text-gray-300 border border-white/10'
                                                }`}
                                            >
                                                {i === 0 ? '1st: ' : '2nd: '}{pos}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Quick Rating Grid */}
                <div className="mb-6 p-4 bg-black/20 rounded-xl border border-white/5">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-gray-400 text-xs uppercase font-bold tracking-wider">Quick Grade</h4>
                        <button
                            onClick={saveRating}
                            disabled={saving}
                            className="text-xs text-brand-green hover:underline flex items-center gap-1 disabled:opacity-50"
                        >
                            <Save className="w-3 h-3" /> Save Rating
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {Object.keys(rating).map(cat => (
                            <div key={cat} className="flex items-center justify-between">
                                <span className="text-sm text-gray-300 capitalize">{cat}</span>
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button
                                            key={star}
                                            onClick={() => setRating(prev => ({ ...prev, [cat]: star }))}
                                            className={`w-2 h-6 rounded-sm transition-colors ${rating[cat] >= star ? 'bg-brand-green' : 'bg-gray-800'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Notes Feed */}
                <div className="space-y-4 mb-20">
                    <h4 className="text-gray-400 text-xs uppercase font-bold mb-2 tracking-wider flex items-center gap-2">
                        Scouting Report <span className="bg-brand-gold text-brand-dark px-1.5 rounded-full text-[10px]">{notes.length}</span>
                    </h4>

                    {loadingNotes ? (
                        <div className="text-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-brand-green mx-auto" />
                        </div>
                    ) : notes.length === 0 ? (
                        <div className="text-center py-4">
                            <p className="text-gray-500 text-sm">No notes yet for this prospect.</p>
                            <p className="text-gray-600 text-xs mt-1">Use voice or type below to add the first note.</p>
                        </div>
                    ) : (
                        notes.map(note => (
                            <div key={note.id} className={`p-4 rounded-xl border ${note.tags?.includes('Rating') ? 'bg-purple-500/5 border-purple-500/20' : 'bg-white/5 border-white/10'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(note.created_at).toLocaleDateString('en-US', {
                                                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => deleteNote(note.id)}
                                        className="p-1 hover:bg-red-500/20 rounded text-gray-500 hover:text-red-400"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                                <p className="text-sm text-gray-200 leading-relaxed">{note.note_text}</p>
                                {note.tags && note.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {note.tags.map(tag => (
                                            <span key={tag} className="px-2 py-0.5 bg-brand-gold/10 text-brand-gold text-[10px] rounded">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}

                    {/* Live Transcript */}
                    {isRecording && (
                        <div className="p-4 rounded-xl border border-brand-gold/30 bg-brand-gold/5 animate-pulse">
                            <div className="flex items-center gap-2 mb-2 text-brand-gold text-xs font-bold uppercase">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                                Listening...
                            </div>
                            <p className="text-sm text-white/80 italic">"{transcript || '...'}"</p>
                        </div>
                    )}

                    {/* Manual Transcript Input */}
                    {!isRecording && transcript && (
                        <div className="p-4 rounded-xl border border-white/10 bg-white/5">
                            <label className="text-xs text-gray-400 uppercase mb-2 block">Note Preview</label>
                            <textarea
                                value={transcript}
                                onChange={(e) => setTranscript(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white text-sm resize-none h-16"
                            />
                            {/* Tags */}
                            <div className="flex flex-wrap gap-1 mt-2">
                                {TAG_OPTIONS.map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => toggleTag(tag)}
                                        className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                                            selectedTags.includes(tag)
                                                ? 'bg-brand-green text-brand-dark font-bold'
                                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                        }`}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Danger zone — full delete */}
                {onDelete && (
                    <div className="mt-8 pt-6 border-t border-red-500/20">
                        <button
                            onClick={handleDeleteClick}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider hover:bg-red-500/10 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" /> Delete prospect
                        </button>
                        <p className="text-[11px] text-gray-600 mt-2">Removes this prospect from the waitlist permanently. Their scouting notes stay in the system.</p>
                    </div>
                )}
            </div>

            {/* Voice Control Footer */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-brand-dark/95 backdrop-blur border-t border-white/10 flex items-center gap-3">
                <button
                    onClick={toggleRecording}
                    className={`flex-1 py-3 rounded-xl font-bold uppercase tracking-wider flex items-center justify-center gap-3 transition-all text-sm ${isRecording ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-brand-green hover:bg-brand-green/80 text-brand-dark'}`}
                >
                    {isRecording ? (
                        <><MicOff className="w-5 h-5" /> Stop</>
                    ) : (
                        <><Mic className="w-5 h-5" /> Voice Note</>
                    )}
                </button>

                {transcript && !isRecording && (
                    <button
                        onClick={saveNote}
                        disabled={saving}
                        className="py-3 px-6 bg-brand-gold text-brand-dark rounded-xl font-bold uppercase text-sm hover:bg-brand-gold/80 disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save
                    </button>
                )}
            </div>
        </div>
    );
};

export default ScoutCard;
