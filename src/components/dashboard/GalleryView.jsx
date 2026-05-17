import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, X, Trash2, Loader2, ChevronLeft, ChevronRight, Calendar, User, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import { useConfirm } from '../ConfirmDialog';

const GalleryView = () => {
    const { user, profile } = useAuth();
    const toast = useToast();
    const confirm = useConfirm();
    const [media, setMedia] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [showUpload, setShowUpload] = useState(false);
    const [lightbox, setLightbox] = useState(null);
    const [filterEvent, setFilterEvent] = useState('all');
    const [caption, setCaption] = useState('');
    const [selectedEventId, setSelectedEventId] = useState('');
    const [teamId, setTeamId] = useState(null);
    const fileInputRef = useRef(null);
    // Pending-file state — user picks a file but the actual upload doesn't
    // fire until they tap the "Upload" button. Lets them preview, add a
    // caption, and pick the event first.
    const [pendingFile, setPendingFile] = useState(null);
    const [pendingPreview, setPendingPreview] = useState(null);

    // Revoke the object URL when the pending file changes or unmounts so
    // we don't leak memory.
    useEffect(() => {
        return () => {
            if (pendingPreview) URL.revokeObjectURL(pendingPreview);
        };
    }, [pendingPreview]);

    const resetPendingFile = () => {
        if (pendingPreview) URL.revokeObjectURL(pendingPreview);
        setPendingFile(null);
        setPendingPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error('Only image files are allowed.');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast.error('File too large — max 10MB.');
            return;
        }
        // Replace any previously-pending file (and revoke its URL)
        if (pendingPreview) URL.revokeObjectURL(pendingPreview);
        setPendingFile(file);
        setPendingPreview(URL.createObjectURL(file));
    };

    const [currentRole, setCurrentRole] = useState(profile?.role || user?.role || 'player');
    const canUpload = ['manager', 'coach', 'parent'].includes(currentRole);

    // Lock body scroll when lightbox or upload modal is open
    useEffect(() => {
        if (lightbox || showUpload) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [lightbox, showUpload]);

    // Get team ID on mount
    useEffect(() => {
        getTeamId();
    }, [user]);

    useEffect(() => {
        if (teamId) {
            fetchMedia();
            fetchEvents();
        }
    }, [teamId]);

    const getTeamId = async () => {
        // Try team_memberships first
        if (profile?.team_id) {
            setTeamId(profile.team_id);
            return;
        }

        // Try via team_memberships
        const { data: membership } = await supabase
            .from('team_memberships')
            .select('team_id, role')
            .eq('user_id', user.id)
            .limit(1)
            .single();

        if (membership?.team_id) {
            if (membership.role) setCurrentRole(membership.role);
            setTeamId(membership.team_id);
            return;
        }

        // Try via family_members → players (this means user is a parent/guardian)
        const { data: family } = await supabase
            .from('family_members')
            .select('player_id')
            .eq('user_id', user.id)
            .limit(1)
            .single();

        if (family?.player_id) {
            const { data: player } = await supabase
                .from('players')
                .select('team_id')
                .eq('id', family.player_id)
                .single();

            if (player?.team_id) {
                setCurrentRole('parent');
                setTeamId(player.team_id);
                return;
            }
        }

        setLoading(false);
    };

    const fetchMedia = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('media_gallery')
                .select('*, profiles:uploaded_by(full_name), events:event_id(title)')
                .eq('team_id', teamId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Build public URLs
            const withUrls = (data || []).map(item => {
                const { data: urlData } = supabase.storage
                    .from('media')
                    .getPublicUrl(item.file_path);
                return { ...item, publicUrl: urlData?.publicUrl };
            });

            setMedia(withUrls);
        } catch (err) {
            console.error('Error fetching media:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchEvents = async () => {
        try {
            const { data } = await supabase
                .from('events')
                .select('id, title, start_time, type')
                .eq('team_id', teamId)
                .order('start_time', { ascending: false })
                .limit(20);

            setEvents(data || []);
        } catch (err) {
            console.error('Error fetching events:', err);
        }
    };

    const handleUpload = async () => {
        if (!pendingFile) {
            toast.error('Pick a photo first.');
            return;
        }

        setUploading(true);

        try {
            // Generate unique filename
            const ext = pendingFile.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
            const filePath = `team-${teamId}/${fileName}`;

            // Upload to storage
            const { error: uploadErr } = await supabase.storage
                .from('media')
                .upload(filePath, pendingFile);

            if (uploadErr) throw uploadErr;

            // Save metadata
            const { error: dbErr } = await supabase
                .from('media_gallery')
                .insert([{
                    team_id: teamId,
                    event_id: selectedEventId || null,
                    uploaded_by: user.id,
                    file_path: filePath,
                    caption: caption.trim() || null
                }]);

            if (dbErr) throw dbErr;

            // Reset and refresh
            setCaption('');
            setSelectedEventId('');
            setShowUpload(false);
            resetPendingFile();
            fetchMedia();
            toast.success('Photo uploaded.');
        } catch (err) {
            console.error('Upload error:', err);
            const msg = err?.message || '';
            if (msg.includes('policy') || msg.includes('permission') || /row.level security/i.test(msg)) {
                toast.error("You don't have permission to upload to this gallery.");
            } else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
                toast.error("Couldn't reach the server. Check your connection and try again.");
            } else {
                toast.error(`Upload failed: ${msg || 'Unknown error'}.`);
            }
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (item) => {
        const ok = await confirm({
            title: 'Delete this photo?',
            body: 'This cannot be undone.',
            confirmLabel: 'Delete',
            destructive: true,
        });
        if (!ok) return;

        try {
            // Delete from storage
            await supabase.storage.from('media').remove([item.file_path]);

            // Delete from database
            const { error } = await supabase
                .from('media_gallery')
                .delete()
                .eq('id', item.id);

            if (error) throw error;

            setMedia(prev => prev.filter(m => m.id !== item.id));
            setLightbox(null);
            toast.success('Photo deleted.');
        } catch (err) {
            console.error('Delete error:', err);
            toast.error("Couldn't delete the photo. Try again in a moment.");
        }
    };

    const canDelete = (item) => {
        return item.uploaded_by === user?.id || ['manager', 'coach'].includes(currentRole);
    };

    const filtered = filterEvent === 'all'
        ? media
        : filterEvent === 'none'
            ? media.filter(m => !m.event_id)
            : media.filter(m => m.event_id === filterEvent);

    const lightboxIndex = lightbox ? filtered.findIndex(m => m.id === lightbox.id) : -1;

    const navigateLightbox = (dir) => {
        const newIndex = lightboxIndex + dir;
        if (newIndex >= 0 && newIndex < filtered.length) {
            setLightbox(filtered[newIndex]);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-brand-green" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl text-white font-display uppercase font-bold tracking-wider">Media Gallery</h2>
                    <p className="text-gray-400 text-sm mt-1">{media.length} photo{media.length !== 1 ? 's' : ''}</p>
                </div>
                {canUpload && (
                    <button
                        onClick={() => setShowUpload(true)}
                        className="bg-brand-green text-brand-dark px-5 py-2.5 rounded-xl font-bold uppercase text-sm flex items-center gap-2 hover:bg-white transition-colors"
                    >
                        <Upload className="w-4 h-4" /> Upload Photo
                    </button>
                )}
            </div>

            {/* Filter Bar */}
            {events.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    <button
                        onClick={() => setFilterEvent('all')}
                        className={`px-3 py-1.5 rounded text-xs font-bold uppercase whitespace-nowrap transition-colors ${filterEvent === 'all' ? 'bg-brand-gold text-brand-dark' : 'bg-white/10 text-gray-400 hover:text-white'}`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilterEvent('none')}
                        className={`px-3 py-1.5 rounded text-xs font-bold uppercase whitespace-nowrap transition-colors ${filterEvent === 'none' ? 'bg-brand-gold text-brand-dark' : 'bg-white/10 text-gray-400 hover:text-white'}`}
                    >
                        General
                    </button>
                    {events.filter(e => media.some(m => m.event_id === e.id)).map(event => (
                        <button
                            key={event.id}
                            onClick={() => setFilterEvent(event.id)}
                            className={`px-3 py-1.5 rounded text-xs font-bold uppercase whitespace-nowrap transition-colors ${filterEvent === event.id ? 'bg-brand-gold text-brand-dark' : 'bg-white/10 text-gray-400 hover:text-white'}`}
                        >
                            {event.title}
                        </button>
                    ))}
                </div>
            )}

            {/* Photo Grid */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-xl">
                    <Camera className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 font-bold mb-1">No photos yet</p>
                    <p className="text-gray-500 text-sm">
                        {canUpload ? 'Upload your first team photo!' : 'Photos will appear here once uploaded.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {filtered.map(item => (
                        <div
                            key={item.id}
                            onClick={() => setLightbox(item)}
                            className="aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-brand-gold/50 transition-all cursor-pointer group relative"
                        >
                            <img
                                src={item.publicUrl}
                                alt={item.caption || 'Team photo'}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                            />
                            {/* Overlay on hover */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="absolute bottom-2 left-2 right-2">
                                    {item.caption && (
                                        <p className="text-white text-xs truncate">{item.caption}</p>
                                    )}
                                    <p className="text-gray-300 text-[10px]">
                                        {item.profiles?.full_name || 'Unknown'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload Modal */}
            {showUpload && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-brand-dark border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-white font-bold text-lg uppercase">Upload Photo</h3>
                            <button
                                onClick={() => { setShowUpload(false); resetPendingFile(); setCaption(''); setSelectedEventId(''); }}
                                disabled={uploading}
                                className="text-gray-400 hover:text-white disabled:opacity-50"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* File picker: dropzone when nothing picked, preview when picked */}
                        {pendingFile ? (
                            <div className="relative">
                                <img
                                    src={pendingPreview}
                                    alt="Preview"
                                    className="w-full h-56 object-cover rounded-xl border border-white/10"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute top-2 right-2 px-2.5 py-1 rounded bg-black/70 border border-white/20 text-white text-[11px] uppercase font-bold tracking-wider hover:bg-black/90"
                                >
                                    Change
                                </button>
                                <p className="text-[11px] text-gray-500 mt-2 truncate">
                                    {pendingFile.name} · {(pendingFile.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                            </div>
                        ) : (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-brand-green/50 transition-colors"
                            >
                                <ImageIcon className="w-10 h-10 text-gray-500 mx-auto mb-2" />
                                <p className="text-gray-400 text-sm">Tap to select a photo</p>
                                <p className="text-gray-600 text-xs mt-1">JPG, PNG, WebP up to 10MB</p>
                            </div>
                        )}
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={handleFileSelect}
                        />

                        {/* Caption */}
                        <input
                            type="text"
                            placeholder="Add a caption (optional)"
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
                        />

                        {/* Event Selector */}
                        <select
                            value={selectedEventId}
                            onChange={(e) => setSelectedEventId(e.target.value)}
                            className="w-full bg-[#1a1a2e] border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
                        >
                            <option value="" className="bg-[#1a1a2e]">No event (general)</option>
                            {events.map(e => (
                                <option key={e.id} value={e.id} className="bg-[#1a1a2e]">
                                    {e.title} ({new Date(e.start_time).toLocaleDateString()})
                                </option>
                            ))}
                        </select>

                        {/* Action buttons */}
                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => { setShowUpload(false); resetPendingFile(); setCaption(''); setSelectedEventId(''); }}
                                disabled={uploading}
                                className="flex-1 py-2.5 rounded-lg border border-white/10 text-gray-300 text-sm font-bold uppercase tracking-wider hover:bg-white/5 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleUpload}
                                disabled={uploading || !pendingFile}
                                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-brand-green text-brand-dark text-sm font-bold uppercase tracking-wider hover:bg-brand-green/90 disabled:opacity-50"
                            >
                                {uploading
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                                    : <><Upload className="w-4 h-4" /> Upload</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox */}
            {lightbox && (
                <div className="fixed inset-0 bg-black/95 z-50 flex flex-col" onClick={() => setLightbox(null)}>
                    {/* Top bar */}
                    <div className="flex items-center justify-between p-4" onClick={(e) => e.stopPropagation()}>
                        <div className="text-white text-sm">
                            <p className="font-bold">{lightbox.caption || 'Untitled'}</p>
                            <p className="text-gray-400 text-xs flex items-center gap-2">
                                <User className="w-3 h-3" />
                                {lightbox.profiles?.full_name || 'Unknown'}
                                <span className="text-gray-600">|</span>
                                <Calendar className="w-3 h-3" />
                                {new Date(lightbox.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                {lightbox.events?.title && (
                                    <>
                                        <span className="text-gray-600">|</span>
                                        {lightbox.events.title}
                                    </>
                                )}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {canDelete(lightbox) && (
                                <button
                                    onClick={() => handleDelete(lightbox)}
                                    className="p-2 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            )}
                            <button
                                onClick={() => setLightbox(null)}
                                className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Image */}
                    <div className="flex-1 flex items-center justify-center p-4 relative" onClick={(e) => e.stopPropagation()}>
                        {lightboxIndex > 0 && (
                            <button
                                onClick={() => navigateLightbox(-1)}
                                className="absolute left-2 md:left-6 p-2 bg-black/50 rounded-full text-white hover:bg-white/20 transition-colors z-10"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                        )}

                        <img
                            src={lightbox.publicUrl}
                            alt={lightbox.caption || 'Photo'}
                            className="max-h-[80vh] max-w-full object-contain rounded-lg"
                        />

                        {lightboxIndex < filtered.length - 1 && (
                            <button
                                onClick={() => navigateLightbox(1)}
                                className="absolute right-2 md:right-6 p-2 bg-black/50 rounded-full text-white hover:bg-white/20 transition-colors z-10"
                            >
                                <ChevronRight className="w-6 h-6" />
                            </button>
                        )}
                    </div>

                    {/* Counter */}
                    <div className="text-center pb-4 text-gray-500 text-xs">
                        {lightboxIndex + 1} / {filtered.length}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GalleryView;
