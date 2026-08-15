import React, { useEffect, useState } from 'react';
import { X, Loader2, Sparkles, PlayCircle, Plus, Trash2, CheckCircle, ChevronDown, Rocket, BookOpen } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useToast } from '../Toast';
import { FORMATIONS, FORMATION_IDS, SLOT_LABELS } from './lineup/formations';

// Coach HQ → build a team Playbook with AI. Paste the coach's YouTube videos →
// Gemini watches each one → Claude writes a kid-sized lesson per position →
// coach reviews the drafts → publishes. Drafts stage in draft_content, so the
// live Playbook never disappears mid-review.
const ytId = (s) => {
    if (!s) return null;
    const t = String(s).trim();
    if (/^[\w-]{11}$/.test(t)) return t;
    const m = t.match(/(?:v=|youtu\.be\/|\/watch\?.*v=|embed\/)([\w-]{11})/);
    return m ? m[1] : null;
};

const PlaybookAuthoring = ({ teamId, onClose }) => {
    const toast = useToast();
    const [formation, setFormation] = useState('4-3-1');
    const [philosophy, setPhilosophy] = useState('');
    const [videos, setVideos] = useState([{ url: '', title: '' }]);
    const [phase, setPhase] = useState('setup');    // 'setup' | 'working' | 'review'
    const [progress, setProgress] = useState('');
    const [drafts, setDrafts] = useState([]);
    const [expanded, setExpanded] = useState(null);
    const [published, setPublished] = useState(new Set());
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let alive = true;
        (async () => {
            if (!teamId) return;
            const { data } = await supabase.from('teams').select('default_formation').eq('id', teamId).maybeSingle();
            if (alive && data?.default_formation && FORMATIONS[data.default_formation]) setFormation(data.default_formation);
        })();
        return () => { alive = false; };
    }, [teamId]);

    const setVideo = (i, key, val) => setVideos(v => v.map((row, j) => j === i ? { ...row, [key]: val } : row));
    const addVideo = () => setVideos(v => v.length < 4 ? [...v, { url: '', title: '' }] : v);
    const removeVideo = (i) => setVideos(v => v.filter((_, j) => j !== i));

    const run = async () => {
        const vids = videos.filter(v => ytId(v.url));
        setBusy(true);
        setPhase('working');
        try {
            const breakdowns = [];
            const analyzed = [];
            for (let i = 0; i < vids.length; i++) {
                setProgress(`🎬 Watching video ${i + 1} of ${vids.length} — this can take a minute…`);
                const { data, error } = await supabase.functions.invoke('ai-analyze-video', {
                    body: { teamId, url: vids[i].url, title: vids[i].title, formation },
                });
                if (error || !data?.breakdown) {
                    toast.error(`Couldn't analyze video ${i + 1}. ${data?.error || ''}`.trim());
                    continue;
                }
                breakdowns.push(`### ${vids[i].title || `Video ${i + 1}`}\n${data.breakdown}`);
                analyzed.push({ id: ytId(vids[i].url), title: vids[i].title || `Coach video ${i + 1}`, channel: data.channel || '' });
            }

            setProgress('✍️ Writing a lesson for all 9 positions…');
            const slots = (FORMATIONS[formation]?.slots || []).map(s => ({ id: s.id, label: SLOT_LABELS[s.id] || s.id }));
            const { data: gen, error: gErr } = await supabase.functions.invoke('ai-generate-playbook', {
                body: { teamId, formation, philosophy, notes: breakdowns.join('\n\n'), videos: analyzed, slots },
            });
            if (gErr || !gen?.lessons?.length) {
                toast.error(gen?.error || 'Generation failed. Try again.');
                setPhase('setup'); setBusy(false); return;
            }
            setDrafts(gen.lessons);
            setPublished(new Set());
            setPhase('review');
        } catch (e) {
            toast.error(e?.message || 'Something went wrong.');
            setPhase('setup');
        } finally {
            setBusy(false);
        }
    };

    const publish = async (slotId = null) => {
        setBusy(true);
        const { data, error } = await supabase.rpc('publish_playbook', {
            p_team_id: teamId, p_formation: formation, p_slot_id: slotId,
        });
        setBusy(false);
        if (error) { toast.error("Couldn't publish. Try again."); return; }
        if (slotId) {
            setPublished(p => new Set(p).add(slotId));
            toast.success(`Published ${SLOT_LABELS[slotId] || slotId}.`);
        } else {
            setPublished(new Set(drafts.map(d => d.slot_id)));
            toast.success(`Playbook is live — ${data} lessons published! 🎉`);
        }
    };

    return (
        <div className="fixed inset-0 z-[115] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-brand-dark border border-white/10 w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col"
                style={{ maxHeight: 'min(92vh, 92dvh)' }} onClick={(e) => e.stopPropagation()}>
                <div className="shrink-0 flex items-center gap-3 p-4 border-b border-white/10">
                    <div className="w-10 h-10 rounded-xl bg-brand-green/15 border border-brand-green/30 flex items-center justify-center"><BookOpen className="w-5 h-5 text-brand-green" /></div>
                    <div className="min-w-0">
                        <h3 className="text-white font-display uppercase font-bold tracking-wider leading-tight">Build the Playbook</h3>
                        <p className="text-gray-400 text-xs">AI watches your videos and writes a lesson per position</p>
                    </div>
                    <button onClick={onClose} className="ml-auto text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {phase === 'setup' && (
                        <div className="space-y-5">
                            <div>
                                <label className="block text-[11px] uppercase tracking-widest text-brand-gold font-bold mb-2">Formation</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {FORMATION_IDS.map(id => (
                                        <button key={id} onClick={() => setFormation(id)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold tracking-wider ${formation === id ? 'bg-brand-green text-brand-dark' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
                                            {id}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] uppercase tracking-widest text-brand-gold font-bold mb-2">Your playing philosophy <span className="text-gray-500 normal-case">(optional)</span></label>
                                <textarea value={philosophy} onChange={(e) => setPhilosophy(e.target.value)} rows={3}
                                    placeholder="e.g. We build calmly from the back, press from the striker, and attack with width from the fullbacks."
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white text-sm focus:border-brand-green outline-none resize-none" />
                            </div>

                            <div>
                                <label className="block text-[11px] uppercase tracking-widest text-brand-gold font-bold mb-2">Coach videos <span className="text-gray-500 normal-case">(YouTube links — AI watches them)</span></label>
                                <div className="space-y-2">
                                    {videos.map((v, i) => (
                                        <div key={i} className="flex gap-2 items-start">
                                            <div className="flex-1 space-y-1.5">
                                                <input value={v.url} onChange={(e) => setVideo(i, 'url', e.target.value)} placeholder="https://youtube.com/watch?v=…"
                                                    className={`w-full bg-black/40 border rounded-lg p-2.5 text-white text-sm outline-none ${v.url && !ytId(v.url) ? 'border-red-500/50' : 'border-white/10 focus:border-brand-green'}`} />
                                                <input value={v.title} onChange={(e) => setVideo(i, 'title', e.target.value)} placeholder="Title (optional) — e.g. Building out of the Back"
                                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-gray-300 text-xs outline-none focus:border-brand-green" />
                                            </div>
                                            {videos.length > 1 && <button onClick={() => removeVideo(i)} className="text-gray-500 hover:text-red-400 mt-2"><Trash2 className="w-4 h-4" /></button>}
                                        </div>
                                    ))}
                                </div>
                                {videos.length < 4 && <button onClick={addVideo} className="mt-2 text-xs text-brand-green font-bold flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add another video</button>}
                                <p className="text-[11px] text-gray-500 mt-2">No videos? You can still generate — the AI will use your formation + philosophy. Videos make it match how <span className="text-gray-300">you</span> coach.</p>
                            </div>

                            <button onClick={run} disabled={busy}
                                className="w-full py-3.5 rounded-xl bg-brand-green text-brand-dark font-display font-bold uppercase tracking-wider hover:bg-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                                <Sparkles className="w-5 h-5" /> Generate Playbook
                            </button>
                        </div>
                    )}

                    {phase === 'working' && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Loader2 className="w-10 h-10 text-brand-green animate-spin mb-4" />
                            <p className="text-white font-bold">{progress}</p>
                            <p className="text-gray-500 text-xs mt-2">Hang tight — watching a full video takes a moment.</p>
                        </div>
                    )}

                    {phase === 'review' && (
                        <div className="space-y-3">
                            <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/10 p-3 text-sm text-brand-gold">
                                Review the drafts below. <span className="font-bold">Nothing is live to families until you publish.</span>
                            </div>
                            {drafts.map((d) => {
                                const c = d.content || {};
                                const isPub = published.has(d.slot_id);
                                const open = expanded === d.slot_id;
                                return (
                                    <div key={d.slot_id} className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
                                        <button onClick={() => setExpanded(open ? null : d.slot_id)} className="w-full flex items-center gap-3 p-3 text-left">
                                            <span className="w-9 h-9 rounded-lg bg-brand-green/15 border border-brand-green/30 flex items-center justify-center text-brand-green font-display font-black text-[11px] shrink-0">{d.slot_id}</span>
                                            <span className="min-w-0 flex-1">
                                                <span className="text-white font-bold text-sm block truncate">{c.nickname || SLOT_LABELS[d.slot_id]}</span>
                                                <span className="text-gray-400 text-xs block truncate">{c.oneLiner}</span>
                                            </span>
                                            {isPub
                                                ? <span className="text-[10px] uppercase font-bold text-brand-green bg-brand-green/10 border border-brand-green/30 rounded px-2 py-0.5 shrink-0">Live</span>
                                                : <span className="text-[10px] uppercase font-bold text-gray-400 bg-white/5 border border-white/10 rounded px-2 py-0.5 shrink-0">Draft</span>}
                                            <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                                        </button>
                                        {open && (
                                            <div className="px-3 pb-3 space-y-2 border-t border-white/10 pt-3">
                                                {Array.isArray(c.goldenRules) && (
                                                    <div>
                                                        <p className="text-[10px] uppercase tracking-wider text-brand-gold font-bold mb-1">Golden rules</p>
                                                        <ul className="space-y-0.5">{c.goldenRules.map((r, i) => <li key={i} className="text-xs text-gray-200">• {r.rule}</li>)}</ul>
                                                    </div>
                                                )}
                                                {c.video?.id && <p className="text-[11px] text-gray-500">🎬 Deep dive: {c.video.title}</p>}
                                                <p className="text-[11px] text-gray-500">{Array.isArray(c.quiz) ? c.quiz.length : 0}-question quiz included</p>
                                                {!isPub && (
                                                    <button onClick={() => publish(d.slot_id)} disabled={busy}
                                                        className="mt-1 px-3 py-1.5 rounded-lg bg-brand-green/10 border border-brand-green/40 text-brand-green text-xs font-bold uppercase tracking-wider hover:bg-brand-green/20 disabled:opacity-50">
                                                        Publish this one
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {phase === 'review' && (
                    <div className="shrink-0 p-4 border-t border-white/10 flex gap-2">
                        <button onClick={() => { setPhase('setup'); setDrafts([]); }} className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 font-bold uppercase tracking-wider text-sm hover:bg-white/10">Regenerate</button>
                        <button onClick={() => publish(null)} disabled={busy || published.size === drafts.length}
                            className="flex-1 py-3 rounded-xl bg-brand-green text-brand-dark font-display font-bold uppercase tracking-wider hover:bg-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5" />}
                            {published.size === drafts.length ? 'All Published' : 'Publish All'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlaybookAuthoring;
