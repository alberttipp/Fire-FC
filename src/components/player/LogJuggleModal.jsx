import React, { useState, useRef } from 'react';
import { X, Loader2, Trophy, Sparkles, Video } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useToast } from '../Toast';

// Log a juggling session OR set the starting baseline.
//   mode='baseline' — one number ("your best right now") + honesty pledge
//   mode='session'  — best this session, total juggles, minutes
// Optional short video (uploaded to the media bucket under team-<id>/, which
// only works when the user has a real session — kid-mode silently skips it).
const LogJuggleModal = ({ mode = 'session', playerId, teamId, playerName, currentBest = 0, onClose, onDone }) => {
    const toast = useToast();
    const isBaseline = mode === 'baseline';

    const [best, setBest] = useState('');
    const [total, setTotal] = useState('');
    const [minutes, setMinutes] = useState('');
    const [pledged, setPledged] = useState(false);
    const [videoFile, setVideoFile] = useState(null);
    const [saving, setSaving] = useState(false);
    const fileRef = useRef(null);

    const num = (v) => {
        const n = parseInt(v, 10);
        return Number.isFinite(n) && n >= 0 ? n : null;
    };

    const uploadVideoIfAny = async () => {
        if (!videoFile || !teamId) return null;
        try {
            const ext = (videoFile.name.split('.').pop() || 'mp4').toLowerCase();
            const path = `team-${teamId}/juggle-${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
            const { error } = await supabase.storage.from('media').upload(path, videoFile, {
                contentType: videoFile.type || undefined, cacheControl: '3600',
            });
            if (error) throw error;
            return supabase.storage.from('media').getPublicUrl(path).data?.publicUrl || null;
        } catch (e) {
            console.warn('[juggle] video upload skipped:', e?.message);
            return null; // non-fatal — log without the clip
        }
    };

    const handleSave = async () => {
        const bestN = num(best);
        if (bestN === null) {
            toast.error(isBaseline ? 'Enter your best juggles in a row.' : 'Enter your best run this session.');
            return;
        }
        if (isBaseline && !pledged) {
            toast.error('Tap the honesty pledge first 🤝');
            return;
        }
        setSaving(true);
        try {
            const videoUrl = await uploadVideoIfAny();
            if (isBaseline) {
                const { data, error } = await supabase.rpc('set_juggle_baseline', {
                    p_player_id: playerId, p_best_count: bestN, p_video_url: videoUrl,
                });
                if (error) throw error;
                if (!data?.success) throw new Error(data?.message || 'Could not save baseline.');
                toast.success(`Baseline locked in: ${bestN}. Now go beat it! ⚽`);
            } else {
                const { data, error } = await supabase.rpc('log_juggle_session', {
                    p_player_id: playerId,
                    p_best_in_session: bestN,
                    p_total_juggles: num(total) ?? 0,
                    p_attempts: 1,
                    p_minutes: num(minutes) ?? 0,
                    p_video_url: videoUrl,
                });
                if (error) throw error;
                if (!data?.success) throw new Error(data?.message || 'Could not save.');
                if (data.is_personal_best) toast.success(`🎉 New personal best — ${data.new_best} in a row!`);
                else toast.success('Session logged — keep it up! ⚽');
            }
            if (onDone) onDone();
            onClose();
        } catch (err) {
            console.error('[juggle] save error', err);
            toast.error(err.message || "Couldn't save. Try again.");
        } finally {
            setSaving(false);
        }
    };

    const NumberField = ({ label, hint, value, onChange, autoFocus }) => (
        <div>
            <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-1.5">{label}</label>
            <input
                type="number" inputMode="numeric" min="0" value={value}
                onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} placeholder="0"
                className="w-full bg-black/50 border border-white/10 rounded-lg py-3 px-4 text-white text-2xl font-mono text-center focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
            />
            {hint && <p className="text-[11px] text-gray-500 mt-1">{hint}</p>}
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-brand-dark border border-white/10 w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl relative max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-11 h-11 rounded-full bg-brand-green/15 border-2 border-brand-green/40 flex items-center justify-center text-xl">⚽</div>
                        <div className="min-w-0">
                            <h3 className="text-white font-bold text-lg leading-tight">{isBaseline ? 'Set your starting score' : 'Log a juggling session'}</h3>
                            <p className="text-gray-400 text-xs">{playerName ? `${playerName} · ` : ''}June Juggling Competition</p>
                        </div>
                        <button onClick={onClose} className="ml-auto text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                    </div>

                    {isBaseline ? (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/10 p-3 text-sm text-brand-gold">
                                Go juggle right now and count your best run in a row. This is your starting point — locks in after kickoff, so be honest and we'll watch you grow! 📈
                            </div>
                            <NumberField label="Best juggles in a row (right now)" value={best} onChange={setBest} autoFocus />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {currentBest > 0 && (
                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                    <Trophy className="w-4 h-4 text-brand-gold" /> Your record so far: <span className="font-bold text-white">{currentBest}</span>
                                </div>
                            )}
                            <NumberField label="Best run this session" hint="Most juggles in a row you hit just now" value={best} onChange={setBest} autoFocus />
                            <NumberField label="Total juggles (all attempts)" hint="Roughly how many total — counts toward the team goal" value={total} onChange={setTotal} />
                            <NumberField label="Minutes spent" hint="Adds to your weekly / career training time too" value={minutes} onChange={setMinutes} />
                        </div>
                    )}

                    {/* Optional video */}
                    <div className="mt-4">
                        <input type="file" accept="video/*,image/*" ref={fileRef} className="hidden"
                               onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
                        <button type="button" onClick={() => fileRef.current?.click()}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-sm hover:bg-white/10">
                            <Video className="w-4 h-4" /> {videoFile ? `Video added: ${videoFile.name.slice(0, 24)}` : 'Add a video (optional)'}
                        </button>
                    </div>

                    {isBaseline && (
                        <button type="button" onClick={() => setPledged((v) => !v)}
                                className={`mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-bold transition-colors ${pledged ? 'bg-brand-green/15 border-brand-green/40 text-brand-green' : 'bg-white/5 border-white/10 text-gray-300'}`}>
                            <Sparkles className="w-4 h-4" /> {pledged ? "I'll count honestly! 🤝" : 'Tap: I promise to count honestly 🤝'}
                        </button>
                    )}

                    <button onClick={handleSave} disabled={saving}
                            className="mt-5 w-full py-3.5 rounded-lg bg-brand-green text-brand-dark font-display font-bold uppercase tracking-wider hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving…</> : (isBaseline ? 'Lock in my start' : 'Save session')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LogJuggleModal;
