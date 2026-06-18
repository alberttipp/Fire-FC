import React, { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { uploadPlayerPhoto } from '../../utils/playerPhoto';
import { useToast } from '../Toast';

// Small text button used in the card row to add/replace a player's photo.
// Picks a file, resizes, and runs it through the process-avatar edge function
// (auto background removal). Calls onUploaded(newUrl) so the card refreshes.
const PhotoUploadButton = ({ playerId, onUploaded, label = '📷 Photo' }) => {
    const toast = useToast();
    const inputRef = useRef(null);
    const [busy, setBusy] = useState(false);

    const handle = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !playerId) return;
        setBusy(true);
        try {
            const { url, cutout } = await uploadPlayerPhoto(playerId, file);
            toast.success(cutout ? 'Photo added — background removed! ✨' : 'Photo updated.');
            onUploaded?.(url);
        } catch (err) {
            const msg = err?.message || '';
            toast.error(/not allowed|403/i.test(msg) ? "You can't change this player's photo." : `Couldn't upload: ${msg}`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                disabled={busy}
                className="text-xs text-gray-400 hover:text-brand-gold font-bold uppercase tracking-wider transition-colors disabled:opacity-50 inline-flex items-center gap-1"
            >
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {busy ? 'Processing…' : label}
            </button>
            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                onChange={handle}
                className="hidden"
            />
        </>
    );
};

export default PhotoUploadButton;
