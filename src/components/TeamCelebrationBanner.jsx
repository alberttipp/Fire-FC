import React, { useState, useEffect } from 'react';
import { X, PartyPopper } from 'lucide-react';
import { supabase } from '../supabaseClient';

// Dismissible team celebration banner. First celebration: the 💯 100 Club —
// every teammate who's hit 100 juggles in a row. Dismissal is keyed to the
// exact club roster, so it stays hidden once dismissed but RE-celebrates when a
// new member joins the club. Lives in-flow at the top of the dashboard.
const DISMISS_KEY = 'fcCelebDismissed';

// "A", "A & B", "A, B & C"
const joinNames = (names) => {
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} & ${names[1]}`;
    return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
};

const TeamCelebrationBanner = ({ teamId }) => {
    const [club, setClub] = useState(null);
    const [hidden, setHidden] = useState(false);

    useEffect(() => {
        if (!teamId) return;
        let cancelled = false;
        (async () => {
            const { data } = await supabase.rpc('get_juggle_leaderboard', { p_team_id: teamId });
            if (cancelled) return;
            const names = (data?.rows || [])
                .filter((r) => (r.current_best || 0) >= 100)
                .sort((a, b) => b.current_best - a.current_best)
                .map((r) => r.first_name);
            setClub(names);
        })();
        return () => { cancelled = true; };
    }, [teamId]);

    if (!club || club.length === 0 || hidden) return null;

    const signature = 'centuryclub:' + club.join(',');
    try { if (localStorage.getItem(DISMISS_KEY) === signature) return null; } catch { /* ignore */ }

    const dismiss = () => {
        try { localStorage.setItem(DISMISS_KEY, signature); } catch { /* ignore */ }
        setHidden(true);
    };

    return (
        <div className="relative overflow-hidden rounded-xl border border-brand-gold/40 bg-gradient-to-r from-brand-gold/20 to-yellow-400/10 p-4 animate-fade-in-up">
            <button onClick={dismiss} aria-label="Dismiss" className="absolute top-2 right-2 p-1 text-brand-gold/70 hover:text-white">
                <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 pr-6">
                <div className="text-3xl shrink-0">💯</div>
                <div className="min-w-0">
                    <p className="text-white font-display font-bold uppercase tracking-wider text-sm flex items-center gap-1.5">
                        <PartyPopper className="w-4 h-4 text-brand-gold" /> 100 Club
                    </p>
                    <p className="text-gray-200 text-sm leading-snug mt-0.5">
                        <span className="font-bold text-white">{joinNames(club)}</span> hit <span className="font-bold">100 juggles in a row</span>! Who's next? 🔥
                    </p>
                </div>
            </div>
        </div>
    );
};

export default TeamCelebrationBanner;
