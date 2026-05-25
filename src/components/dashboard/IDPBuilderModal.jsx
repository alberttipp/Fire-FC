import React, { useState, useEffect, useMemo } from 'react';
import { X, Target, Loader2, Plus, Check, ChevronRight, Trash2, Award, Dumbbell, ArrowRight, FileText, Save, Search } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { IDP_SKILLS, SKILL_BY_SLUG, OFFENSE_SKILLS, DEFENSE_SKILLS } from '../../data/idpSkills';

// Coach-side modal. Builds and updates a player's IDP — three 30-day
// blocks of skill moves. Coach taps "Mark mastered" on a skill, which
// fires the DB trigger that awards the matching badge automatically.
//
// Props:
//   player        — { id, first_name, ... }
//   existingIDP   — player_idps row or null
//   existingSkills — array of idp_skill_progress rows (may be empty)
//   onClose(didChange) — called when the user dismisses. `didChange`=true
//                        tells the parent to refetch the hub.
//   onToast(type, msg) — bridge to the toast provider

const IDPBuilderModal = ({ player, existingIDP, existingSkills = [], onClose, onToast }) => {
    const { user } = useAuth();
    const [idp, setIdp] = useState(existingIDP);
    const [skills, setSkills] = useState(existingSkills);
    const [busy, setBusy] = useState(false);
    const [activePicker, setActivePicker] = useState(null); // block number when skill picker open
    const [activeDrillPicker, setActiveDrillPicker] = useState(null); // block number when drill library open
    const [drillsCache, setDrillsCache] = useState({}); // skill_slug -> drills[]
    const [didChange, setDidChange] = useState(false);

    // Coach notes (timestamped) — uses the existing coach_notes table for
    // per-player logging. Notes are not strictly IDP-scoped; they show
    // the player's full timeline so the coach sees context while planning.
    const [notes, setNotes] = useState([]);
    const [notesLoading, setNotesLoading] = useState(true);
    const [newNote, setNewNote] = useState('');
    const [savingNote, setSavingNote] = useState(false);

    const playerName = player?.display_name || `${player?.first_name || ''} ${player?.last_name || ''}`.trim() || 'Player';

    // Fetch coach notes for this player
    useEffect(() => {
        if (!player?.id) return;
        let cancelled = false;
        (async () => {
            setNotesLoading(true);
            try {
                const { data } = await supabase
                    .from('coach_notes')
                    .select('id, note_text, tags, created_at, coach_id')
                    .eq('player_id', player.id)
                    .order('created_at', { ascending: false })
                    .limit(10);
                if (!cancelled) setNotes(data || []);
            } finally {
                if (!cancelled) setNotesLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [player?.id]);

    const handleAddNote = async () => {
        if (!newNote.trim() || !player?.id || !user?.id) return;
        setSavingNote(true);
        try {
            const { data, error } = await supabase
                .from('coach_notes')
                .insert({
                    player_id: player.id,
                    coach_id: user.id,
                    note_text: newNote.trim(),
                    tags: ['idp'],
                })
                .select()
                .single();
            if (error) throw error;
            setNotes((prev) => [data, ...prev]);
            setNewNote('');
            setDidChange(true);
            onToast?.('success', 'Note saved.');
        } catch (err) {
            console.error('[IDPBuilder] add note error', err);
            onToast?.('error', "Couldn't save note. Try again.");
        } finally {
            setSavingNote(false);
        }
    };

    const skillsByBlock = useMemo(() => {
        const out = { 1: [], 2: [], 3: [] };
        for (const s of skills) {
            if (out[s.block_number]) out[s.block_number].push(s);
        }
        return out;
    }, [skills]);

    const blockSkillSlugs = useMemo(() => {
        const out = { 1: [], 2: [], 3: [] };
        for (const n of [1, 2, 3]) {
            out[n] = skillsByBlock[n].map((s) => s.skill_slug);
        }
        return out;
    }, [skillsByBlock]);

    // Fetch drills covering the current block whenever it changes
    useEffect(() => {
        if (!idp) return;
        const currentBlock = idp.current_block || 1;
        const slugs = blockSkillSlugs[currentBlock];
        if (slugs.length === 0) {
            setDrillsCache((c) => ({ ...c, [currentBlock]: [] }));
            return;
        }
        const key = `${currentBlock}:${slugs.sort().join(',')}`;
        if (drillsCache[key]) return;
        (async () => {
            const { data, error } = await supabase
                .from('drills')
                .select('id, name, description, category, duration, tagged_skills')
                .overlaps('tagged_skills', slugs)
                .eq('is_custom', false)
                .limit(12);
            if (error) {
                console.error('[IDPBuilder] drill fetch error', error);
                return;
            }
            setDrillsCache((c) => ({ ...c, [key]: data || [] }));
        })();
    }, [idp?.current_block, blockSkillSlugs, drillsCache, idp]);

    const currentDrills = useMemo(() => {
        if (!idp) return [];
        const currentBlock = idp.current_block || 1;
        const slugs = blockSkillSlugs[currentBlock];
        const key = `${currentBlock}:${[...slugs].sort().join(',')}`;
        return drillsCache[key] || [];
    }, [idp, blockSkillSlugs, drillsCache]);

    const startIDP = async () => {
        if (!player?.id || !user?.id) return;
        setBusy(true);
        try {
            const today = new Date();
            const end = new Date(today);
            end.setDate(end.getDate() + 90);
            const { data, error } = await supabase
                .from('player_idps')
                .insert({
                    player_id: player.id,
                    coach_id: user.id,
                    title: `${playerName.split(' ')[0]}'s 90-Day Plan`,
                    start_date: today.toISOString().slice(0, 10),
                    end_date: end.toISOString().slice(0, 10),
                    status: 'active',
                    current_block: 1,
                    block_duration_days: 30,
                })
                .select()
                .single();
            if (error) throw error;
            setIdp(data);
            setSkills([]);
            setDidChange(true);
            onToast?.('success', 'IDP started.');
        } catch (err) {
            console.error('[IDPBuilder] startIDP error', err);
            onToast?.('error', "Couldn't start the IDP. Try again.");
        } finally {
            setBusy(false);
        }
    };

    const addSkill = async (blockNumber, skillSlug) => {
        if (!idp) return;
        if (blockSkillSlugs[blockNumber].includes(skillSlug)) return;
        if (blockSkillSlugs[blockNumber].length >= 3) {
            onToast?.('warning', 'Pick a maximum of 3 skills per block.');
            return;
        }
        setBusy(true);
        try {
            const { data, error } = await supabase
                .from('idp_skill_progress')
                .insert({
                    idp_id: idp.id,
                    block_number: blockNumber,
                    skill_slug: skillSlug,
                    status: blockNumber === (idp.current_block || 1) ? 'active' : 'pending',
                })
                .select()
                .single();
            if (error) throw error;
            setSkills((prev) => [...prev, data]);
            setDidChange(true);
        } catch (err) {
            console.error('[IDPBuilder] addSkill error', err);
            onToast?.('error', "Couldn't add that skill. Try again.");
        } finally {
            setBusy(false);
        }
    };

    const removeSkill = async (rowId) => {
        setBusy(true);
        try {
            const { error } = await supabase.from('idp_skill_progress').delete().eq('id', rowId);
            if (error) throw error;
            setSkills((prev) => prev.filter((s) => s.id !== rowId));
            setDidChange(true);
        } catch (err) {
            console.error('[IDPBuilder] removeSkill error', err);
            onToast?.('error', "Couldn't remove that skill.");
        } finally {
            setBusy(false);
        }
    };

    const markMastered = async (row) => {
        setBusy(true);
        try {
            const { data, error } = await supabase
                .from('idp_skill_progress')
                .update({
                    status: 'mastered',
                    mastered_at: new Date().toISOString(),
                    mastered_by: user.id,
                })
                .eq('id', row.id)
                .select()
                .single();
            if (error) throw error;
            setSkills((prev) => prev.map((s) => (s.id === row.id ? data : s)));
            setDidChange(true);
            const meta = SKILL_BY_SLUG[row.skill_slug];
            onToast?.('success', `${meta?.name || 'Skill'} mastered! Badge unlocked.`);
        } catch (err) {
            console.error('[IDPBuilder] markMastered error', err);
            onToast?.('error', "Couldn't mark mastered. Try again.");
        } finally {
            setBusy(false);
        }
    };

    const unmarkMastered = async (row) => {
        setBusy(true);
        try {
            const { data, error } = await supabase
                .from('idp_skill_progress')
                .update({ status: 'active', mastered_at: null, mastered_by: null })
                .eq('id', row.id)
                .select()
                .single();
            if (error) throw error;
            setSkills((prev) => prev.map((s) => (s.id === row.id ? data : s)));
            setDidChange(true);
        } catch (err) {
            console.error('[IDPBuilder] unmark error', err);
            onToast?.('error', "Couldn't update.");
        } finally {
            setBusy(false);
        }
    };

    const graduateToNextBlock = async () => {
        if (!idp) return;
        const next = (idp.current_block || 1) + 1;
        if (next > 3) {
            // Complete the IDP entirely
            try {
                const { data, error } = await supabase
                    .from('player_idps')
                    .update({ status: 'completed', current_block: 3 })
                    .eq('id', idp.id)
                    .select()
                    .single();
                if (error) throw error;
                setIdp(data);
                setDidChange(true);
                onToast?.('success', `${playerName.split(' ')[0]} graduated the full 90-day plan! 🎉`);
            } catch (err) {
                console.error('[IDPBuilder] complete error', err);
                onToast?.('error', "Couldn't graduate.");
            }
            return;
        }
        setBusy(true);
        try {
            const { data, error } = await supabase
                .from('player_idps')
                .update({ current_block: next })
                .eq('id', idp.id)
                .select()
                .single();
            if (error) throw error;
            setIdp(data);
            // Flip next-block pending → active
            const toActivate = skills.filter((s) => s.block_number === next && s.status === 'pending');
            if (toActivate.length > 0) {
                await supabase
                    .from('idp_skill_progress')
                    .update({ status: 'active' })
                    .in('id', toActivate.map((s) => s.id));
                setSkills((prev) => prev.map((s) => (toActivate.find((t) => t.id === s.id) ? { ...s, status: 'active' } : s)));
            }
            setDidChange(true);
            onToast?.('success', `Graduated to Block ${next}!`);
        } catch (err) {
            console.error('[IDPBuilder] graduate error', err);
            onToast?.('error', "Couldn't graduate to the next block.");
        } finally {
            setBusy(false);
        }
    };

    const handleSoloTrain = (drillId) => {
        // Open the selected player's dashboard in preview mode so staff can
        // see the drill in the real player context instead of hitting the
        // auth-linked player login path.
        const params = new URLSearchParams({
            preview: player.id,
            previewRole: 'player',
            drillIds: drillId,
            from: 'idp',
        });
        const url = `/player-dashboard?${params.toString()}`;
        window.open(url, '_blank');
    };

    return (
        <div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
            onClick={() => onClose(didChange)}
        >
            <div
                className="bg-brand-dark border border-white/10 w-full max-w-2xl h-[95vh] sm:h-auto sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
            >
                {/* Header — extra top padding so iOS notch and the rounded
                    modal corner don't clip the title. */}
                <div className="pt-7 sm:pt-5 px-5 pb-4 border-b border-white/10 flex items-start gap-3 shrink-0">
                    <div className="w-10 h-10 rounded-full bg-brand-gold/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Target className="w-5 h-5 text-brand-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold text-base truncate leading-snug">{playerName}'s IDP</h3>
                        {idp ? (
                            <p className="text-xs text-gray-400 mt-0.5">
                                Block {idp.current_block || 1} of 3 · {idp.status === 'completed' ? 'COMPLETED' : 'ACTIVE'}
                            </p>
                        ) : (
                            <p className="text-xs text-gray-400 mt-0.5">No active plan yet</p>
                        )}
                    </div>
                    <button onClick={() => onClose(didChange)} className="p-1 -m-1 text-gray-500 hover:text-white shrink-0">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                    {!idp ? (
                        <div className="text-center py-10 space-y-4">
                            <div className="w-16 h-16 rounded-full bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center mx-auto">
                                <Target className="w-8 h-8 text-brand-gold" />
                            </div>
                            <div>
                                <p className="text-white font-bold mb-1">Start a 90-Day Plan</p>
                                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                                    Three 30-day blocks. Pick up to 3 skills per block. Mark them mastered and the badges unlock automatically.
                                </p>
                            </div>
                            <button
                                onClick={startIDP}
                                disabled={busy}
                                className="px-6 py-2.5 bg-brand-green text-brand-dark rounded-lg font-bold uppercase tracking-wider text-sm hover:bg-white transition-colors disabled:opacity-60"
                            >
                                {busy ? 'Starting…' : 'Start IDP'}
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Block panels */}
                            {[1, 2, 3].map((blockNumber) => (
                                <BlockPanel
                                    key={blockNumber}
                                    blockNumber={blockNumber}
                                    isCurrent={(idp.current_block || 1) === blockNumber}
                                    isComplete={blockNumber < (idp.current_block || 1) || idp.status === 'completed'}
                                    rows={skillsByBlock[blockNumber]}
                                    onOpenPicker={() => setActivePicker(blockNumber)}
                                    onRemoveSkill={removeSkill}
                                    onMarkMastered={markMastered}
                                    onUnmark={unmarkMastered}
                                    drills={(idp.current_block || 1) === blockNumber ? currentDrills : []}
                                    onSoloTrain={handleSoloTrain}
                                    onOpenDrillPicker={() => setActiveDrillPicker(blockNumber)}
                                    busy={busy}
                                />
                            ))}

                            {/* Graduate to next block */}
                            {idp.status !== 'completed' && (
                                <button
                                    onClick={graduateToNextBlock}
                                    disabled={busy}
                                    className="w-full py-3 bg-brand-green/10 hover:bg-brand-green/20 border-2 border-brand-green/30 hover:border-brand-green/50 rounded-xl text-brand-green font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                                >
                                    {(idp.current_block || 1) === 3
                                        ? <>Complete the Plan <Award className="w-4 h-4" /></>
                                        : <>Graduate to Block {(idp.current_block || 1) + 1} <ArrowRight className="w-4 h-4" /></>}
                                </button>
                            )}

                            {/* Coach Notes (timestamped) */}
                            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <FileText className="w-4 h-4 text-brand-green" />
                                    <h4 className="text-white font-bold text-sm uppercase tracking-wider">Coach Notes</h4>
                                </div>

                                <div className="flex gap-2 mb-3 min-w-0">
                                    <input
                                        type="text"
                                        value={newNote}
                                        onChange={(e) => setNewNote(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote(); }}
                                        placeholder="Add a quick note about this player…"
                                        className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg p-2.5 text-white text-sm outline-none focus:border-brand-green"
                                        disabled={savingNote}
                                    />
                                    <button
                                        onClick={handleAddNote}
                                        disabled={!newNote.trim() || savingNote}
                                        className="shrink-0 px-3 py-2 bg-brand-green/15 border border-brand-green/30 hover:bg-brand-green/25 text-brand-green text-xs font-bold uppercase tracking-wider rounded-lg disabled:opacity-50"
                                    >
                                        {savingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                                    </button>
                                </div>

                                {notesLoading ? (
                                    <div className="flex justify-center py-3">
                                        <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                                    </div>
                                ) : notes.length === 0 ? (
                                    <p className="text-xs text-gray-500 italic text-center py-3">No notes yet for this player.</p>
                                ) : (
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                        {notes.map((n) => (
                                            <div key={n.id} className="p-2 rounded-lg bg-white/5 border border-white/5">
                                                <p className="text-sm text-white leading-relaxed">{n.note_text}</p>
                                                <p className="text-[10px] text-gray-500 mt-1">
                                                    {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer: Save & Close button */}
                {idp && (
                    <div className="border-t border-white/10 p-4 shrink-0 bg-brand-dark">
                        <button
                            onClick={() => onClose(didChange)}
                            className="w-full py-3 rounded-xl font-display font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-brand-green to-green-500 text-brand-dark shadow-lg shadow-brand-green/30 hover:shadow-brand-green/50 hover:scale-[1.01] transition-all"
                        >
                            <Save className="w-4 h-4" /> Save & Close
                        </button>
                        <p className="text-[10px] text-gray-500 text-center mt-2">
                            Changes are saved automatically as you make them.
                        </p>
                    </div>
                )}
            </div>

            {/* Skill Picker overlay */}
            {activePicker !== null && (
                <SkillPicker
                    blockNumber={activePicker}
                    alreadyPicked={blockSkillSlugs[activePicker]}
                    onPick={async (slug) => {
                        await addSkill(activePicker, slug);
                    }}
                    onClose={() => setActivePicker(null)}
                />
            )}

            {/* Drill library picker — coach can pull in any drill (filtered
                by skills picked in the block by default, but searchable
                across the whole catalog) */}
            {activeDrillPicker !== null && (
                <DrillLibraryPicker
                    blockNumber={activeDrillPicker}
                    blockSlugs={blockSkillSlugs[activeDrillPicker]}
                    onPick={(drillId) => {
                        // For now we just open the solo training deep-link, which
                        // matches the existing recommended-drills "Solo" button
                        // behavior. Future v2 could link the drill to the IDP block.
                        handleSoloTrain(drillId);
                    }}
                    onClose={() => setActiveDrillPicker(null)}
                />
            )}
        </div>
    );
};

const BlockPanel = ({ blockNumber, isCurrent, isComplete, rows, onOpenPicker, onRemoveSkill, onMarkMastered, onUnmark, drills, onSoloTrain, onOpenDrillPicker, busy }) => {
    const mastered = rows.filter((r) => r.status === 'mastered').length;
    const total = rows.length;
    const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;

    return (
        <div
            className={`rounded-2xl border-2 transition-colors ${
                isCurrent
                    ? 'border-brand-gold/50 bg-brand-gold/5'
                    : isComplete
                        ? 'border-brand-green/30 bg-brand-green/5'
                        : 'border-white/10 bg-white/[0.02]'
            }`}
        >
            <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span
                            className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded ${
                                isCurrent
                                    ? 'bg-brand-gold text-brand-dark'
                                    : isComplete
                                        ? 'bg-brand-green/20 text-brand-green'
                                        : 'bg-white/10 text-gray-400'
                            }`}
                        >
                            Block {blockNumber}
                        </span>
                        {isCurrent && (
                            <span className="text-[10px] uppercase tracking-widest text-brand-gold/80 font-bold">Current</span>
                        )}
                        {isComplete && !isCurrent && (
                            <span className="text-[10px] uppercase tracking-widest text-brand-green/80 font-bold">Done</span>
                        )}
                    </div>
                    <span className="text-xs text-gray-500">
                        {mastered}/{total} mastered
                    </span>
                </div>

                {total > 0 && (
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
                        <div
                            className="h-full bg-gradient-to-r from-brand-green to-brand-gold rounded-full"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                )}

                {/* Skill rows */}
                <div className="space-y-2">
                    {rows.length === 0 && (
                        <p className="text-xs text-gray-500 italic py-2">No skills picked yet for this block.</p>
                    )}
                    {rows.map((row) => {
                        const meta = SKILL_BY_SLUG[row.skill_slug];
                        if (!meta) return null;
                        const isMastered = row.status === 'mastered';
                        return (
                            <div
                                key={row.id}
                                className={`flex items-center gap-2 p-2 rounded-lg border ${
                                    isMastered
                                        ? 'bg-brand-green/10 border-brand-green/30'
                                        : 'bg-white/5 border-white/10'
                                }`}
                            >
                                <span className="text-lg shrink-0">{meta.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-bold ${isMastered ? 'text-brand-green' : 'text-white'}`}>
                                        {meta.name}
                                    </p>
                                    <p className="text-[10px] uppercase tracking-wider text-gray-500">{meta.category}</p>
                                </div>
                                {isMastered ? (
                                    <>
                                        <span className="text-[10px] uppercase tracking-wider text-brand-green font-bold flex items-center gap-1">
                                            <Check className="w-3 h-3" /> Mastered
                                        </span>
                                        <button
                                            onClick={() => onUnmark(row)}
                                            disabled={busy}
                                            className="text-[10px] text-gray-500 hover:text-white px-2"
                                            title="Undo mastery"
                                        >
                                            Undo
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => onMarkMastered(row)}
                                        disabled={busy}
                                        className="px-3 py-1.5 bg-brand-gold/15 border border-brand-gold/30 hover:bg-brand-gold/25 text-brand-gold text-xs font-bold uppercase tracking-wider rounded transition-colors disabled:opacity-60"
                                    >
                                        Mark Mastered
                                    </button>
                                )}
                                <button
                                    onClick={() => onRemoveSkill(row.id)}
                                    disabled={busy || isMastered}
                                    className="p-1.5 text-gray-500 hover:text-red-400 disabled:opacity-30"
                                    title={isMastered ? 'Already mastered — undo first' : 'Remove'}
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        );
                    })}
                    {rows.length < 3 && (
                        <button
                            onClick={onOpenPicker}
                            disabled={busy}
                            className="w-full p-2 rounded-lg border-2 border-dashed border-white/15 hover:border-brand-gold/40 hover:bg-white/5 text-gray-400 hover:text-brand-gold text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                            <Plus className="w-3.5 h-3.5" /> Add skill
                        </button>
                    )}
                </div>

                {/* Recommended drills + "Add from library" (current block only) */}
                {isCurrent && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold flex items-center gap-1.5">
                                <Dumbbell className="w-3 h-3 text-brand-green" /> Recommended Drills
                            </p>
                            {onOpenDrillPicker && (
                                <button
                                    onClick={onOpenDrillPicker}
                                    className="text-[10px] uppercase tracking-widest font-bold text-brand-gold hover:text-white transition-colors flex items-center gap-1"
                                >
                                    <Plus className="w-3 h-3" /> Browse library
                                </button>
                            )}
                        </div>
                        {drills.length > 0 ? (
                            <div className="space-y-1.5">
                                {drills.slice(0, 6).map((d) => (
                                    <div key={d.id} className="flex items-center gap-2 p-2 rounded bg-white/[0.02] border border-white/5">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-white truncate">{d.name}</p>
                                            <p className="text-[10px] text-gray-500 truncate">{d.category} · {d.duration || 10} min</p>
                                        </div>
                                        <button
                                            onClick={() => onSoloTrain(d.id)}
                                            className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-brand-green/15 border border-brand-green/30 text-brand-green hover:bg-brand-green/25"
                                        >
                                            Solo
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-gray-500 italic">No matching drills yet — try "Browse library" above to pull from the full catalog.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// Tile-grid skill picker — opens as a sheet over the modal.
const SkillPicker = ({ blockNumber, alreadyPicked, onPick, onClose }) => {
    const [tab, setTab] = useState('offense');
    const list = tab === 'offense' ? OFFENSE_SKILLS : DEFENSE_SKILLS;

    return (
        <div
            className="fixed inset-0 z-[210] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
            onClick={onClose}
        >
            <div
                className="bg-brand-dark border border-white/10 w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[80vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-white/10 flex items-center gap-3">
                    <h4 className="text-white font-bold text-sm flex-1">Pick a skill for Block {blockNumber}</h4>
                    <button onClick={onClose} className="text-gray-500 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-3 border-b border-white/10 flex gap-1">
                    <button
                        onClick={() => setTab('offense')}
                        className={`flex-1 py-2 rounded text-xs font-bold uppercase tracking-wider transition-colors ${
                            tab === 'offense'
                                ? 'bg-brand-gold text-brand-dark'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                    >
                        Offense
                    </button>
                    <button
                        onClick={() => setTab('defense')}
                        className={`flex-1 py-2 rounded text-xs font-bold uppercase tracking-wider transition-colors ${
                            tab === 'defense'
                                ? 'bg-brand-gold text-brand-dark'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                    >
                        Defense
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2">
                    {list.map((s) => {
                        const taken = alreadyPicked.includes(s.slug);
                        return (
                            <button
                                key={s.slug}
                                disabled={taken}
                                onClick={async () => {
                                    await onPick(s.slug);
                                    onClose();
                                }}
                                className={`p-3 rounded-xl border-2 text-left transition-colors ${
                                    taken
                                        ? 'border-white/10 bg-white/[0.02] opacity-40 cursor-not-allowed'
                                        : 'border-white/10 bg-white/5 hover:border-brand-gold/40 hover:bg-brand-gold/5'
                                }`}
                            >
                                <div className="text-2xl mb-1">{s.icon}</div>
                                <p className="text-sm font-bold text-white truncate">{s.name}</p>
                                <p className="text-[10px] text-gray-500 leading-snug mt-1 line-clamp-2">{s.description}</p>
                                {taken && (
                                    <span className="mt-2 inline-block text-[9px] uppercase tracking-wider text-gray-500">Already picked</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// A lightweight drill library picker scoped to the IDP modal. Pre-filters
// to drills tagged with one of the current block's skill slugs, but the
// coach can switch to "All drills" and search by name. Tapping a drill
// fires onPick(drillId) — the parent decides what to do (currently:
// deep-link to a solo training session).
const DrillLibraryPicker = ({ blockNumber, blockSlugs = [], onPick, onClose }) => {
    const [drills, setDrills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState(blockSlugs.length > 0 ? 'block' : 'all');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                let query = supabase
                    .from('drills')
                    .select('id, name, category, duration, tagged_skills')
                    .eq('is_custom', false)
                    .order('name', { ascending: true });
                if (filter === 'block' && blockSlugs.length > 0) {
                    query = query.overlaps('tagged_skills', blockSlugs);
                }
                const { data } = await query.limit(120);
                if (!cancelled) setDrills(data || []);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [filter, blockSlugs]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return drills;
        return drills.filter((d) =>
            (d.name || '').toLowerCase().includes(q) ||
            (d.category || '').toLowerCase().includes(q)
        );
    }, [drills, search]);

    return (
        <div
            className="fixed inset-0 z-[210] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
            onClick={onClose}
        >
            <div
                className="bg-brand-dark border border-white/10 w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-white/10 flex items-center gap-3">
                    <h4 className="text-white font-bold text-sm flex-1">Browse drills for Block {blockNumber}</h4>
                    <button onClick={onClose} className="text-gray-500 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-3 pt-3 space-y-2 border-b border-white/10 pb-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name or category…"
                            className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-3 py-2 text-sm text-white outline-none focus:border-brand-green"
                        />
                    </div>
                    <div className="flex gap-1.5">
                        {blockSlugs.length > 0 && (
                            <button
                                onClick={() => setFilter('block')}
                                className={`px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                                    filter === 'block'
                                        ? 'bg-brand-gold text-brand-dark'
                                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                }`}
                            >
                                Block skills only
                            </button>
                        )}
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                                filter === 'all'
                                    ? 'bg-brand-gold text-brand-dark'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                        >
                            All drills
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                    {loading ? (
                        <div className="flex justify-center py-6">
                            <Loader2 className="w-5 h-5 text-brand-green animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-6">No drills match.</p>
                    ) : (
                        filtered.map((d) => (
                            <button
                                key={d.id}
                                onClick={() => onPick(d.id)}
                                className="w-full text-left flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white truncate">{d.name}</p>
                                    <p className="text-[10px] text-gray-500 truncate">
                                        {d.category} · {d.duration || 10} min
                                        {d.tagged_skills?.length > 0 && ` · ${d.tagged_skills.length} skill${d.tagged_skills.length === 1 ? '' : 's'} tagged`}
                                    </p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-500" />
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default IDPBuilderModal;
