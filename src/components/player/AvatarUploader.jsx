import React, { useRef, useState } from 'react';
import { Camera, Loader2, User } from 'lucide-react';
import { useToast } from '../Toast';
import { uploadPlayerPhoto } from '../../utils/playerPhoto';

// Avatar upload widget. Routes through the `process-avatar` edge function,
// which resizes, removes the background (remove.bg), stores the cutout, sets
// players.avatar_url, and does the staff/guardian/self permission check — so
// the same widget works for coaches AND parents/kids.

const MIME_TO_EXT = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
};

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB hard cap as a safety net

const AvatarUploader = ({
    playerId,
    playerName = '',
    currentAvatarUrl = null,
    canEdit = false,
    size = 'md', // 'sm' | 'md' | 'lg'
    onUploaded, // (newPublicUrl: string) => void
}) => {
    const toast = useToast();
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    // Optimistic preview — flips back to currentAvatarUrl on failure
    const [localUrl, setLocalUrl] = useState(null);

    const sizeClass = {
        sm: 'w-14 h-14',
        md: 'w-20 h-20 md:w-24 md:h-24',
        lg: 'w-28 h-28 md:w-32 md:h-32',
    }[size] || 'w-20 h-20';

    const displayedUrl = localUrl || currentAvatarUrl;
    const initial = (playerName || '?').trim().charAt(0).toUpperCase();

    const openPicker = () => {
        if (!canEdit || uploading) return;
        fileInputRef.current?.click();
    };

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        // Always clear input so picking the same file twice re-fires
        e.target.value = '';
        if (!file) return;

        if (!MIME_TO_EXT[file.type]) {
            toast.error("Image must be JPG, PNG, WebP, or HEIC.");
            return;
        }
        if (file.size > MAX_BYTES) {
            toast.error(`Image is too big (${Math.round(file.size / 1024 / 1024)} MB). Max 8 MB.`);
            return;
        }
        if (!playerId) {
            toast.error("No player selected.");
            return;
        }

        // Optimistic preview from the picked file
        const previewUrl = URL.createObjectURL(file);
        setLocalUrl(previewUrl);
        setUploading(true);

        try {
            const { url, cutout } = await uploadPlayerPhoto(playerId, file);
            setLocalUrl(url);
            toast.success(cutout ? 'Photo updated — background removed. ✨' : 'Player photo updated.');
            if (typeof onUploaded === 'function') onUploaded(url);
        } catch (err) {
            console.error('[AvatarUploader] upload failed:', err);
            const msg = err?.message || 'Upload failed.';
            toast.error(/not allowed|policy|permission/i.test(msg)
                ? "You don't have permission to upload this player's photo."
                : `Upload failed: ${msg}`);
            setLocalUrl(null);
        } finally {
            setUploading(false);
            try { URL.revokeObjectURL(previewUrl); } catch (_) {}
        }
    };

    return (
        <div className="relative inline-block">
            <div
                className={`${sizeClass} rounded-full overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-brand-gold/40 flex items-center justify-center`}
            >
                {displayedUrl ? (
                    <img
                        src={displayedUrl}
                        alt={playerName ? `${playerName} avatar` : 'Player avatar'}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                ) : (
                    <span className="text-3xl md:text-4xl font-display font-bold text-brand-gold/70">
                        {initial || <User className="w-1/2 h-1/2 text-brand-gold/50" />}
                    </span>
                )}
                {uploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-full">
                        <Loader2 className="w-6 h-6 text-brand-gold animate-spin" />
                    </div>
                )}
            </div>

            {canEdit && (
                <>
                    <button
                        type="button"
                        onClick={openPicker}
                        disabled={uploading}
                        aria-label="Change player photo"
                        className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-brand-gold text-black border-2 border-brand-dark shadow-lg flex items-center justify-center hover:bg-brand-gold/90 disabled:opacity-50 transition-colors"
                    >
                        <Camera className="w-4 h-4" />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                        onChange={handleFile}
                        className="hidden"
                    />
                </>
            )}
        </div>
    );
};

export default AvatarUploader;
