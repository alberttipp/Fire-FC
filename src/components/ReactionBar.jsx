import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

// =====================================================================
// ReactionBar — emoji reactions on any "target" row (a chat message or a
// gallery photo). Generic enough to reuse — caller tells us which table
// and which column the foreign key lives on.
//
// Props:
//   tableName: 'message_reactions' | 'media_reactions'
//   columnName: 'message_id' | 'media_id'
//   targetId: uuid of the message / media row
//   compact: boolean — smaller buttons + spacing for chat
//   align: 'left' | 'right' | 'center' (default 'left')
//   initialRows: optional pre-fetched rows (avoids one query per item)
//
// Rendering rules:
// - Always show the 8 default emojis as toggle buttons.
// - For each emoji, badge it with the count if > 0.
// - If the current user has reacted with that emoji, highlight the button
//   (gold border + gold tint).
// - Tap toggles: if you already reacted with that emoji, DELETE; else INSERT.
// - Optimistic UI: state updates immediately; rollback on error.
// =====================================================================

const DEFAULT_EMOJIS = ['👍', '❤️', '😂', '🔥', '⚽', '🙌', '👏', '🎉'];

const ReactionBar = ({
    tableName,
    columnName,
    targetId,
    compact = false,
    align = 'left',
    initialRows = null,
}) => {
    const { user } = useAuth();
    const [rows, setRows] = useState(initialRows || []);
    const [busy, setBusy] = useState(false);

    // Fetch reactions if not provided by caller
    useEffect(() => {
        if (initialRows || !targetId) return;
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

    // Derive {emoji: {count, mineId}} so we can render counts + know what to delete.
    const summary = useMemo(() => {
        const o = {};
        DEFAULT_EMOJIS.forEach(e => { o[e] = { count: 0, mineId: null }; });
        rows.forEach(r => {
            if (!o[r.emoji]) o[r.emoji] = { count: 0, mineId: null };
            o[r.emoji].count += 1;
            if (r.user_id === user?.id) o[r.emoji].mineId = r.id;
        });
        return o;
    }, [rows, user?.id]);

    const toggle = async (emoji) => {
        if (!user?.id || busy) return;
        const entry = summary[emoji];
        const mine = entry?.mineId;

        // Optimistic update
        setBusy(true);
        const snapshot = rows;
        try {
            if (mine) {
                // Remove
                setRows(prev => prev.filter(r => r.id !== mine));
                const { error } = await supabase.from(tableName).delete().eq('id', mine);
                if (error) throw error;
            } else {
                // Add — temp client-side row, will be replaced on next refresh
                const optimistic = { id: `tmp-${Date.now()}`, emoji, user_id: user.id };
                setRows(prev => [...prev, optimistic]);
                const insert = { [columnName]: targetId, user_id: user.id, emoji };
                const { data, error } = await supabase
                    .from(tableName)
                    .insert(insert)
                    .select('id, emoji, user_id')
                    .single();
                if (error) throw error;
                // Swap the temp id for the real one
                setRows(prev => prev.map(r => r.id === optimistic.id ? data : r));
            }
        } catch (err) {
            console.warn('[ReactionBar] toggle failed:', err);
            setRows(snapshot); // rollback
        } finally {
            setBusy(false);
        }
    };

    const alignCls = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
    const btnSize = compact ? 'h-7 px-1.5 text-[13px]' : 'h-8 px-2 text-base';
    const gapCls = compact ? 'gap-1' : 'gap-1.5';

    return (
        <div className={`flex flex-wrap ${alignCls} ${gapCls}`} onClick={(e) => e.stopPropagation()}>
            {DEFAULT_EMOJIS.map(e => {
                const { count, mineId } = summary[e] || { count: 0, mineId: null };
                const reacted = !!mineId;
                return (
                    <button
                        key={e}
                        type="button"
                        onClick={() => toggle(e)}
                        disabled={busy}
                        aria-label={`React with ${e}`}
                        className={`inline-flex items-center gap-1 rounded-full border transition-colors leading-none ${btnSize} ${reacted
                            ? 'bg-brand-gold/15 border-brand-gold/50 text-white'
                            : 'bg-white/[0.04] border-white/10 text-gray-300 hover:bg-white/[0.08]'} disabled:opacity-60`}
                    >
                        <span>{e}</span>
                        {count > 0 && (
                            <span className={`${compact ? 'text-[10px]' : 'text-xs'} font-bold ${reacted ? 'text-brand-gold' : 'text-gray-400'}`}>
                                {count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default ReactionBar;
