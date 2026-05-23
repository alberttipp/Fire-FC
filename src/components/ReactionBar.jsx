import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';

// =====================================================================
// ReactionBar — emoji reactions on a "target" (chat message or gallery
// photo). Two states:
//   - Default: compact chip strip showing only emojis that have at least
//     one reaction. If nothing has been reacted yet, renders nothing.
//   - Picker (when pickerOpen=true): horizontal row of all 8 default
//     emojis. Tap one to add/remove your reaction. Auto-closes after a
//     selection via onClosePicker.
//
// Props:
//   tableName: 'message_reactions' | 'media_reactions'
//   columnName: 'message_id' | 'media_id'
//   targetId: uuid of the parent row
//   align: 'left' | 'right' | 'center'
//   compact: smaller buttons + spacing
//   pickerOpen: when true, render the full 8-emoji picker. Caller
//     controls visibility (typically toggled by a long-press handler
//     on the parent UI).
//   onClosePicker: called after a reaction is toggled OR when user
//     taps outside (caller wires this).
// =====================================================================

const DEFAULT_EMOJIS = ['👍', '❤️', '😂', '🔥', '⚽', '🙌', '👏', '🎉'];

const ReactionBar = ({
    tableName,
    columnName,
    targetId,
    align = 'left',
    compact = false,
    pickerOpen = false,
    onClosePicker,
    // When the parent already has all reactions for this target (e.g.
    // ChatView batch-fetches all visible messages' reactions in one
    // query), it passes them in via initialRows so this component
    // skips its own fetch. Without this prop ChatView would fire one
    // GET /message_reactions per visible message — the N+1 that
    // saturated PostgREST 2026-05-23. When undefined (e.g. gallery
    // media reactions where bars are rendered one at a time) we fall
    // back to the eager fetch.
    initialRows,
}) => {
    const { user } = useAuth();
    const toast = useToast();
    const [rows, setRows] = useState(initialRows || []);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!targetId) return;
        // If the parent owns the data, mirror it into local state and
        // skip the fetch. Mirroring (not a controlled component) lets
        // toggle() do optimistic updates locally without a parent
        // round-trip on every tap.
        if (initialRows !== undefined) {
            setRows(initialRows);
            return;
        }
        let cancelled = false;
        (async () => {
            const { data, error } = await supabase
                .from(tableName)
                .select('id, emoji, user_id')
                .eq(columnName, targetId);
            if (cancelled) return;
            if (error) {
                console.warn(`[ReactionBar] fetch ${tableName} failed:`, error);
                setRows([]);
            } else {
                setRows(data || []);
            }
        })();
        return () => { cancelled = true; };
    }, [tableName, columnName, targetId, initialRows]);

    // {emoji: {count, mineId}} — order preserves first-seen for chips
    const { summary, orderedReacted } = useMemo(() => {
        const o = {};
        const seenOrder = [];
        rows.forEach(r => {
            if (!o[r.emoji]) {
                o[r.emoji] = { count: 0, mineId: null };
                seenOrder.push(r.emoji);
            }
            o[r.emoji].count += 1;
            if (r.user_id === user?.id) o[r.emoji].mineId = r.id;
        });
        return { summary: o, orderedReacted: seenOrder };
    }, [rows, user?.id]);

    const toggle = async (emoji) => {
        if (!user?.id || busy) return;
        const entry = summary[emoji];
        const mine = entry?.mineId;

        setBusy(true);
        const snapshot = rows;
        try {
            if (mine) {
                // Delete by composite key, not id — the optimistic row from
                // a fresh add wouldn't have a real DB id yet. UNIQUE
                // (target, user, emoji) guarantees exactly one row matches.
                setRows(prev => prev.filter(r => !(r.user_id === user.id && r.emoji === emoji)));
                const { error } = await supabase
                    .from(tableName)
                    .delete()
                    .eq(columnName, targetId)
                    .eq('user_id', user.id)
                    .eq('emoji', emoji);
                if (error) throw error;
            } else {
                // Optimistic insert. Keep the tmp row in state; do NOT call
                // .insert().select().single() — if the returning SELECT is
                // filtered by RLS (which the message_reactions SELECT policy
                // proxies through messages), data comes back null and the
                // map below would replace the optimistic row with undefined
                // → emoji silently disappears. Bug Albert hit 2026-05-18.
                // Keep the optimistic row; a real id will replace it on the
                // next mount/refetch (cheap and accurate enough).
                const optimisticId = `tmp-${Date.now()}-${emoji}`;
                const optimistic = { id: optimisticId, emoji, user_id: user.id };
                setRows(prev => [...prev, optimistic]);
                const insert = { [columnName]: targetId, user_id: user.id, emoji };
                const { error } = await supabase.from(tableName).insert(insert);
                if (error) throw error;
                // No need to swap the id — we don't reference it server-side
                // until the next page-load refetch, and toggle() identifies
                // "mine" by user_id+emoji presence, not by id matching.
            }
            // After any tap from the picker, close it.
            if (pickerOpen && onClosePicker) onClosePicker();
        } catch (err) {
            console.warn('[ReactionBar] toggle failed:', err);
            setRows(snapshot);
            const msg = err?.message || String(err);
            toast?.error?.(`Couldn't save reaction: ${msg}`);
        } finally {
            setBusy(false);
        }
    };

    const alignCls = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
    const chipBtn = compact ? 'h-6 px-1.5 text-[12px]' : 'h-7 px-2 text-sm';
    const pickerBtn = compact ? 'h-8 w-8 text-base' : 'h-9 w-9 text-lg';
    const gapCls = compact ? 'gap-1' : 'gap-1.5';

    // ----- Picker mode: show all 8 emojis -----
    if (pickerOpen) {
        return (
            <div
                className={`flex flex-wrap ${alignCls} ${gapCls} p-1.5 rounded-2xl bg-brand-dark border border-white/15 shadow-lg`}
                // Stop BOTH click AND touchstart from bubbling to the document
                // outside-tap closer in ChatView. Without onTouchStart, the
                // native touchstart on an emoji button reaches the document
                // listener and closes the picker before the synthesized
                // click ever fires on the button — the emoji "just
                // disappears" with no reaction recorded.
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
            >
                {DEFAULT_EMOJIS.map(e => {
                    const { mineId } = summary[e] || { mineId: null };
                    const reacted = !!mineId;
                    return (
                        <button
                            key={e}
                            type="button"
                            onClick={() => toggle(e)}
                            // Belt-and-suspenders: also stop the touchstart at
                            // the button itself so the outside-tap closer
                            // can't preempt the click on any browser that
                            // dispatches touch events before bubbling reaches
                            // the picker container.
                            onTouchStart={(e) => e.stopPropagation()}
                            disabled={busy}
                            aria-label={`React with ${e}`}
                            className={`inline-flex items-center justify-center rounded-full transition-all leading-none ${pickerBtn} ${reacted
                                ? 'bg-brand-gold/20 ring-2 ring-brand-gold/60'
                                : 'bg-white/[0.05] hover:bg-white/[0.12] active:scale-95'} disabled:opacity-60`}
                        >
                            {e}
                        </button>
                    );
                })}
            </div>
        );
    }

    // ----- Default mode: chips for existing reactions only -----
    if (orderedReacted.length === 0) return null;

    return (
        <div
            className={`flex flex-wrap ${alignCls} ${gapCls}`}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
        >
            {orderedReacted.map(e => {
                const { count, mineId } = summary[e];
                const reacted = !!mineId;
                return (
                    <button
                        key={e}
                        type="button"
                        onClick={() => toggle(e)}
                        disabled={busy}
                        aria-label={`Toggle ${e} reaction`}
                        className={`inline-flex items-center gap-1 rounded-full border transition-colors leading-none ${chipBtn} ${reacted
                            ? 'bg-brand-gold/15 border-brand-gold/50 text-white'
                            : 'bg-white/[0.04] border-white/10 text-gray-300 hover:bg-white/[0.08]'} disabled:opacity-60`}
                    >
                        <span>{e}</span>
                        <span className={`${compact ? 'text-[10px]' : 'text-xs'} font-bold ${reacted ? 'text-brand-gold' : 'text-gray-400'}`}>
                            {count}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

export default ReactionBar;
