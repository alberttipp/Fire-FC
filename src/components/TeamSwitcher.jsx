import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

// Header team switcher for staff who run more than one team. Shows the active
// team (name · age) and, when there's >1, becomes a dropdown that flips the
// whole app's team context via switchTeam() — which persists to
// profiles.active_team_id so the choice sticks across reloads.
//
// When the user has a single team it renders exactly the static label the
// header showed before (name · age), so nothing changes for them.
const TeamSwitcher = ({ fallbackName, fallbackAge }) => {
    const { profile, memberships, switchTeam } = useAuth();
    const [teams, setTeams] = useState([]);
    const [open, setOpen] = useState(false);
    const boxRef = useRef(null);

    // Unique team ids across the user's memberships.
    const teamIds = useMemo(() => {
        const ids = (memberships || []).map((m) => m?.team_id).filter(Boolean);
        return [...new Set(ids)];
    }, [memberships]);

    useEffect(() => {
        let cancelled = false;
        if (teamIds.length < 2) { setTeams([]); return; }
        (async () => {
            const { data } = await supabase
                .from('teams')
                .select('id, name, age_group')
                .in('id', teamIds);
            if (!cancelled) setTeams(data || []);
        })();
        return () => { cancelled = true; };
    }, [teamIds]);

    // Close on outside click.
    useEffect(() => {
        if (!open) return;
        const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    const activeId = profile?.team_id;
    const active = teams.find((t) => t.id === activeId);
    const name = active?.name || fallbackName;
    const age = active?.age_group || fallbackAge;

    // Single team (or names not loaded yet) → static label, unchanged behavior.
    if (teamIds.length < 2) {
        if (!name) return null;
        return (
            <>
                <span className="text-gray-600"> · </span>
                <span className="text-gray-300">{name}</span>
                {age && <span className="text-brand-gold"> · {age}</span>}
            </>
        );
    }

    return (
        <span className="relative inline-flex items-center" ref={boxRef}>
            <span className="text-gray-600"> · </span>
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
                className="inline-flex items-center gap-1 text-gray-200 hover:text-white transition-colors"
                title="Switch team"
            >
                <span className="text-gray-300">{name || 'Pick team'}</span>
                {age && <span className="text-brand-gold"> · {age}</span>}
                <ChevronDown className={`w-3 h-3 text-brand-green transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                /* Spans (with block display), NOT divs: this renders inside the
                   header's <p>, and a <div>/<p> inside a <p> auto-closes it. */
                <span className="absolute left-0 top-full mt-1 z-[80] min-w-[200px] block rounded-lg border border-white/10 bg-brand-dark shadow-2xl p-1 normal-case tracking-normal">
                    <span className="block px-3 py-1.5 text-[10px] uppercase tracking-widest text-gray-500 font-bold">Switch team</span>
                    {teams
                        .slice()
                        .sort((a, b) => (a.age_group || '').localeCompare(b.age_group || ''))
                        .map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={(e) => { e.stopPropagation(); switchTeam(t.id); setOpen(false); }}
                                className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md text-left text-sm transition-colors ${t.id === activeId ? 'bg-brand-green/10 text-brand-green' : 'text-gray-200 hover:bg-white/5'}`}
                            >
                                <span className="min-w-0 truncate">
                                    {t.name}
                                    {t.age_group && <span className="text-gray-500"> · {t.age_group}</span>}
                                </span>
                                {t.id === activeId && <Check className="w-4 h-4 shrink-0" />}
                            </button>
                        ))}
                </span>
            )}
        </span>
    );
};

export default TeamSwitcher;
