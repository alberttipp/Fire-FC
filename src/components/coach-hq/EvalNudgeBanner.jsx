import React, { useState, useEffect, useCallback } from 'react';
import { Star, ChevronRight, Camera, Sparkles } from 'lucide-react';
import { supabase } from '../../supabaseClient';

// Coach HQ nudge: "Build your player cards." Evaluations are the marquee
// feature but adoption stalls at the activation step — so make the gap
// impossible to miss and one tap from doing it. Shows rated-progress + how
// many players still need a photo (a card with no photo looks unfinished,
// which kills the wow). Hides itself once every card is built.
//
// onStart() should navigate to the Team/roster view, where tapping a player
// opens PlayerEvaluationModal.
const EvalNudgeBanner = ({ teamId, onStart }) => {
    const [state, setState] = useState(null); // { total, rated, photos }

    const load = useCallback(async () => {
        if (!teamId) return;
        const { data: roster } = await supabase
            .from('player_teams')
            .select('player_id, players!inner(id, avatar_url)')
            .eq('team_id', teamId)
            .eq('status', 'active');
        const ids = (roster || []).map(r => r.player_id);
        if (ids.length === 0) { setState({ total: 0, rated: 0, photos: 0 }); return; }
        const { data: evals } = await supabase
            .from('evaluations')
            .select('player_id')
            .in('player_id', ids);
        const rated = new Set((evals || []).map(e => e.player_id)).size;
        const photos = (roster || []).filter(r => r.players?.avatar_url).length;
        setState({ total: ids.length, rated, photos });
    }, [teamId]);

    useEffect(() => { load(); }, [load]);

    if (!state || state.total === 0) return null;
    const { total, rated, photos } = state;
    const noPhoto = total - photos;
    const done = rated >= total;
    const pct = Math.round((rated / total) * 100);

    // Once every card is built, show a brief celebratory state instead of nagging.
    if (done) {
        return (
            <div className="w-full glass-panel border-l-4 border-l-brand-green p-3 flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-brand-green shrink-0" />
                <span className="flex-1 text-left text-white text-sm font-medium">
                    All {total} player cards are built 🎉 — review &amp; refresh them anytime in Team.
                </span>
                <button onClick={onStart} className="text-xs text-brand-green hover:text-white font-bold uppercase tracking-wider shrink-0">Open</button>
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={onStart}
            className="w-full text-left glass-panel border-l-4 border-l-brand-gold p-4 hover:bg-brand-gold/5 transition-colors"
        >
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-gold/15 flex items-center justify-center shrink-0">
                    <Star className="w-5 h-5 text-brand-gold" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-white font-bold text-sm">
                        {rated === 0 ? 'Build your players’ FIFA cards' : 'Keep building player cards'}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                        {rated} of {total} rated
                        {noPhoto > 0 && <span className="text-brand-gold"> · {noPhoto} still need a photo <Camera className="w-3 h-3 inline -mt-0.5" /></span>}
                    </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
            </div>
            {/* progress bar */}
            <div className="mt-3 h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-brand-gold rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 text-[11px] text-brand-gold font-bold uppercase tracking-wider">
                {rated === 0 ? 'Tap to rate your first player →' : `${total - rated} to go →`}
            </div>
        </button>
    );
};

export default EvalNudgeBanner;
