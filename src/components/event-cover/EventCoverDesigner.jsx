import React, { useRef, useState, useEffect } from 'react';
import { toBlob } from 'html-to-image';
import { Loader2, X, ImageIcon, Sparkles } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useToast } from '../Toast';
import { TEMPLATES, BACKGROUNDS, defaultTemplateForEvent } from './templates';
import CoverPreview from './CoverPreview';

// EventCoverDesigner — picker UI for choosing a template + background,
// live preview, render-to-PNG, upload to storage.
//
// Modes:
//   - inline (default): renders inside CreateEventModal's flow.
//   - modal: full-screen overlay used for the "Edit cover" flow from
//     EventDetailModal.
//
// Props:
//   event       — partial event object for live preview (title, type,
//                  start_time, location_name, opponent_name, kit_color,
//                  team_id, team_name)
//   initial     — existing { template, bg, version } to pre-select
//   onSaved     — (publicUrl, choice) => void   — fires after upload
//                  succeeds. Designer does NOT modify the event row —
//                  caller writes cover_image_url / cover_template on
//                  their own (so the same component works in both the
//                  create flow before insertion AND the edit flow).
//   onCancel    — () => void  — for modal mode
//   modal       — render as a fixed overlay
const EventCoverDesigner = ({ event, initial, onSaved, onCancel, modal = false }) => {
    const toast = useToast();
    const [choice, setChoice] = useState(() => initial || defaultTemplateForEvent(event?.type));
    const [busy, setBusy] = useState(false);
    const previewRef = useRef(null);

    // Sync template default when event type changes (eg picker still open
    // and the caller switches between game / practice in CreateEventModal).
    useEffect(() => {
        if (!initial && event?.type) {
            setChoice(defaultTemplateForEvent(event.type));
        }
    }, [event?.type, initial]);

    const generateAndUpload = async () => {
        if (!previewRef.current || !event?.team_id) {
            toast.error("Need a team to save the cover.");
            return null;
        }
        setBusy(true);
        try {
            // Snapshot the 1200×630 preview DOM node to a PNG blob.
            // pixelRatio:1 so we get exactly 1200×630 px output (no
            // double-density inflation). cacheBust pulls images fresh.
            const blob = await toBlob(previewRef.current, {
                width: 1200, height: 630, pixelRatio: 1, cacheBust: true, backgroundColor: '#000',
            });
            if (!blob) throw new Error('snapshot returned no blob');

            const eventId = event.id || 'pending-' + Date.now();
            const path = `event-covers/${event.team_id}/${eventId}-${Date.now()}.png`;
            const { error: upErr } = await supabase.storage
                .from('media')
                .upload(path, blob, { contentType: 'image/png', upsert: true });
            if (upErr) throw upErr;

            const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
            toast.success('Cover saved.');
            onSaved?.(publicUrl, choice);
            return publicUrl;
        } catch (e) {
            console.error('[EventCoverDesigner] save failed:', e);
            toast.error(`Couldn't save cover: ${e?.message || e}`);
            return null;
        } finally {
            setBusy(false);
        }
    };

    const body = (
        <div className="space-y-4">
            {/* Live preview — CoverPreview is always 1200×630; we wrap
                it in a scaled box for display. The ref points to the
                full-size DOM so html-to-image captures the real pixels. */}
            <div className="flex justify-center bg-black/50 p-3 rounded-lg">
                <div style={{ width: 600, height: 315, overflow: 'hidden' }}>
                    <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left' }}>
                        <CoverPreview ref={previewRef} event={event} choice={choice} />
                    </div>
                </div>
            </div>

            {/* Template picker */}
            <div>
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Template</div>
                <div className="grid grid-cols-3 gap-2">
                    {TEMPLATES.map(t => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setChoice(c => ({ ...c, template: t.id }))}
                            className={`p-3 rounded-lg text-left text-xs transition-colors border ${choice.template === t.id ? 'bg-brand-gold/15 border-brand-gold/50 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}
                        >
                            <div className="font-bold text-sm">{t.label}</div>
                            <div className="text-[10px] text-gray-500 mt-0.5 leading-snug">{t.description}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Background picker */}
            <div>
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Background</div>
                <div className="grid grid-cols-3 gap-2">
                    {BACKGROUNDS.map(b => (
                        <button
                            key={b.id}
                            type="button"
                            onClick={() => setChoice(c => ({ ...c, bg: b.id }))}
                            className={`p-3 rounded-lg text-left text-xs transition-all border h-16 relative overflow-hidden ${choice.bg === b.id ? 'border-brand-gold ring-2 ring-brand-gold/40' : 'border-white/10 hover:border-white/30'}`}
                            style={parseInlineCss(b.css)}
                        >
                            <div className="absolute inset-0 bg-black/30" />
                            <div className="relative text-white font-bold text-xs uppercase tracking-wider">{b.label}</div>
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
                {onCancel && (
                    <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-gray-400 hover:text-white">
                        Cancel
                    </button>
                )}
                <div className="flex-1" />
                <button
                    type="button"
                    onClick={generateAndUpload}
                    disabled={busy}
                    className="px-4 py-2 rounded-lg bg-brand-green text-brand-dark font-bold text-sm flex items-center gap-2 disabled:opacity-50 hover:bg-brand-green/90"
                >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                    Save cover
                </button>
            </div>

            {/* Future-AI tease */}
            <div className="text-[10px] text-gray-500 flex items-center gap-1.5 pt-1">
                <Sparkles className="w-3 h-3" />
                <span>AI-generated backgrounds coming soon (Gemini Imagen).</span>
            </div>
        </div>
    );

    if (!modal) return body;

    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onCancel}>
            <div className="bg-brand-dark border border-white/10 rounded-2xl p-5 max-w-xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-bold text-lg">Edit cover image</h3>
                    <button onClick={onCancel} className="p-1 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                {body}
            </div>
        </div>
    );
};

// CSS-string parser used by the background swatches in the picker.
// Mirrors the one in CoverPreview so the swatch matches what the
// full-size render will produce.
function parseInlineCss(cssString) {
    const result = {};
    cssString.trim().split(';').forEach(part => {
        const colon = part.indexOf(':');
        if (colon < 0) return;
        const k = part.slice(0, colon).trim();
        const v = part.slice(colon + 1).trim();
        if (k && v) {
            const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            result[camel] = v;
        }
    });
    return result;
}

export default EventCoverDesigner;
