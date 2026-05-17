import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

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
}) => {
    const { user } = useAuth();
    const [rows, setRows] = useState([]);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!targetId) return;
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
    }, [tableName, columnName, targetId]);

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
                setRows(prev => prev.filter(r => r.id !== mine));
                const { error } = await supabase.from(tableName).delete().eq('id', mine);
                if (error) throw error;
            } else {
                const optimistic = { id: `tmp-${Date.now()}`, emoji, user_id: user.id };
                setRows(prev => [...prev, optimistic]);
                const insert = { [columnName]: targetId, user_id: user.id, emoji };
                const { data, error } = await supabase
                    .from(tableName)
                    .insert(insert)
                    .select('id, emoji, user_id')
                    .single();
                if (error) throw error;
                setRows(prev => prev.map(r => r.id === optimistic.id ? data : r));
            }
            // After any tap from the picker, close it. (Caller controls
            // visibility; calling onClosePicker here is just a hint.)
            if (pickerOpen && onClosePicker) onClosePicker();
        } catch (err) {
            console.warn('[ReactionBar] toggle failed:', err);
            setRows(snapshot);
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
                onClick={(e) => e.stopPropagation()}
            >
                {DEFAULT_EMOJIS.map(e => {
                    const { mineId } = summary[e] || { mineId: null };
                    const reacted = !!mineId;
                    return (
                        <button
                            key={e}
                            type="button"
                            onClick={() => toggle(e)}
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
        <div className={`flex flex-wrap ${alignCls} ${gapCls}`} onClick={(e) => e.stopPropagation()}>
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
