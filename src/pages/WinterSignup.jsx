import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useBranding } from '../context/BrandingContext';

// Public, branded WINTER SIGN-UP PORTAL. Resolves the club from ?club=slug
// (via BrandingContext), lists the winter teams, and shows — in real time and
// in the open — exactly who has committed to each team (first name + last
// initial only). Parents commit their own kid in a couple taps. No login.
//
// Data: list_winter_teams / list_winter_signups / submit_winter_signup RPCs
// (all anon-safe SECURITY DEFINER; see 20260920_winter_signups_portal.sql).

const FIELD = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-brand-green focus:outline-none';
const LABEL = 'block text-xs uppercase tracking-wider text-gray-400 mb-1';

const PILLARS = [
    ['📈', 'Development-first', 'Every player tracked in our app — touches, training, growth.'],
    ['🎓', 'Great coaching', 'Real instruction, real position training, real feedback.'],
    ['🤏', 'Small teams', 'More touches, more minutes, nobody riding the bench.'],
    ['🎉', 'Lots of fun', 'Kids who love it show up, work hard, and get better.'],
];

// US Youth Soccer birth-year matrix: for the 2026-27 season the "U-number"
// = 2027 - birthYear (e.g. born 2015 -> U12, born 2016 -> U11). Just a hint;
// the parent picks the actual team.
const suggestedU = (dob) => {
    if (!dob) return null;
    const y = new Date(dob).getFullYear();
    if (!y) return null;
    return `U${2027 - y}`;
};

export default function WinterSignup() {
    const brand = useBranding();
    const [teams, setTeams] = useState(null);      // null = loading
    const [signupsByTeam, setSignupsByTeam] = useState({});
    const [modalTeam, setModalTeam] = useState(null); // team object when committing
    const [loadErr, setLoadErr] = useState('');

    const load = async () => {
        const [tRes, sRes] = await Promise.all([
            supabase.rpc('list_winter_teams', { p_org_slug: brand.slug }),
            supabase.rpc('list_winter_signups', { p_org_slug: brand.slug }),
        ]);
        if (tRes.error) { setLoadErr("Couldn't load teams. Please refresh."); setTeams([]); return; }
        setTeams(tRes.data || []);
        const grouped = {};
        (sRes.data || []).forEach((s) => {
            (grouped[s.team_id] = grouped[s.team_id] || []).push(s);
        });
        setSignupsByTeam(grouped);
    };

    useEffect(() => { if (brand?.slug) load(); /* eslint-disable-next-line */ }, [brand?.slug]);

    const totalCommitted = useMemo(
        () => Object.values(signupsByTeam).reduce((n, arr) => n + arr.filter(s => s.status === 'committed').length, 0),
        [signupsByTeam]
    );

    return (
        <div className="min-h-screen bg-brand-dark text-white">
            {/* Hero */}
            <div className="px-4 pt-10 pb-6 text-center max-w-3xl mx-auto">
                <div className="flex items-center gap-3 justify-center mb-4">
                    <img src={brand.logoUrl} alt={brand.name} className="w-14 h-14 object-contain" />
                    <span className="text-2xl font-display font-bold uppercase tracking-wider">{brand.name}</span>
                </div>
                <h1 className="text-3xl md:text-4xl font-display font-bold uppercase tracking-wide leading-tight">
                    Winter Indoor <span className="text-brand-green">Sign-Up</span>
                </h1>
                <p className="text-gray-300 mt-3">
                    7v7 indoor at Elite Sports Center · season kicks off mid-November. Small rosters,
                    tons of touches, and every player developed in our app.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                    Approx. season fee ~$300/player (finalized at registration; fundraising &amp; sponsors can lower it).
                </p>
            </div>

            {/* Pillars */}
            <div className="px-4 max-w-3xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                {PILLARS.map(([icon, title, sub]) => (
                    <div key={title} className="glass-panel p-3 text-center">
                        <div className="text-2xl mb-1">{icon}</div>
                        <div className="text-sm font-bold">{title}</div>
                        <div className="text-[11px] text-gray-400 mt-1 leading-snug">{sub}</div>
                    </div>
                ))}
            </div>

            {/* Teams */}
            <div className="px-4 max-w-3xl mx-auto pb-24">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-display uppercase tracking-wider text-brand-green">Pick your team</h2>
                    {totalCommitted > 0 && <span className="text-xs text-gray-400">{totalCommitted} committed so far</span>}
                </div>

                {teams === null && <p className="text-gray-500">Loading teams…</p>}
                {loadErr && <p className="text-red-400 text-sm">{loadErr}</p>}
                {teams && teams.length === 0 && !loadErr && (
                    <p className="text-gray-400">Sign-up isn't open yet — check back soon.</p>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                    {(teams || []).map((t) => {
                        const list = (signupsByTeam[t.team_id] || []).filter(s => s.status === 'committed');
                        return (
                            <div key={t.team_id} className="glass-panel p-5 flex flex-col">
                                <div className="flex items-baseline justify-between">
                                    <div className="text-xl font-display font-bold">{t.age_group}</div>
                                    <div className="text-sm text-brand-green font-bold">{list.length} committed</div>
                                </div>
                                <div className="text-xs text-gray-400 mb-3">{t.name}</div>

                                {/* Transparent roster-in-progress */}
                                <div className="flex-1 mb-4">
                                    {list.length === 0 ? (
                                        <p className="text-sm text-gray-500 italic">Be the first to commit! 🚀</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                            {list.map((s, i) => (
                                                <span key={i} className="text-xs bg-white/5 border border-white/10 rounded-full px-2.5 py-1">
                                                    {s.first_name} {s.last_initial}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <button onClick={() => setModalTeam(t)} className="btn-primary w-full">
                                    Commit to {t.age_group}
                                </button>
                            </div>
                        );
                    })}
                </div>

                <p className="text-[11px] text-gray-500 text-center mt-6">
                    We show first name + last initial only — full commitment. Real transparency: see exactly who's in before you decide.
                </p>
            </div>

            {modalTeam && (
                <CommitModal
                    team={modalTeam}
                    brandName={brand.name}
                    onClose={() => setModalTeam(null)}
                    onDone={async () => { setModalTeam(null); await load(); }}
                />
            )}
        </div>
    );
}

function CommitModal({ team, brandName, onClose, onDone }) {
    const [form, setForm] = useState({ first: '', last: '', dob: '', guardianName: '', email: '', phone: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

    const hint = suggestedU(form.dob);
    const mismatch = hint && hint !== team.age_group;

    const submit = async () => {
        setError('');
        if (!form.first.trim() || !form.last.trim()) return setError("Player's first and last name are required.");
        if (!form.guardianName.trim() || !form.email.trim()) return setError('Parent name and email are required.');
        setBusy(true);
        try {
            const { data, error } = await supabase.rpc('submit_winter_signup', {
                p_team_id: team.team_id,
                p_player_first: form.first,
                p_player_last: form.last,
                p_dob: form.dob || null,
                p_guardian_name: form.guardianName,
                p_email: form.email,
                p_phone: form.phone,
                p_status: 'committed',
            });
            if (error) throw new Error(error.message);
            if (data && data.success === false) throw new Error(data.message || 'Could not submit.');
            setDone(true);
        } catch (e) {
            setError(e.message || 'Something went wrong.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
            <div className="bg-brand-dark border border-white/10 rounded-t-2xl md:rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                {done ? (
                    <div className="text-center py-4">
                        <div className="text-5xl mb-3">🎉</div>
                        <h3 className="text-xl font-display font-bold uppercase tracking-wider mb-1">You're in!</h3>
                        <p className="text-gray-400 text-sm">
                            {form.first} is committed to {brandName} {team.age_group}. You'll see them on the list now — {brandName} will follow up with next steps.
                        </p>
                        <button onClick={onDone} className="btn-primary w-full mt-5">See the team</button>
                    </div>
                ) : (
                    <>
                        <h3 className="text-xl font-display font-bold uppercase tracking-wider mb-1">Commit to {team.age_group}</h3>
                        <p className="text-gray-400 text-xs mb-4">{team.name} · Winter indoor</p>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={LABEL}>Player first *</label><input className={FIELD} value={form.first} onChange={set('first')} /></div>
                                <div><label className={LABEL}>Player last *</label><input className={FIELD} value={form.last} onChange={set('last')} /></div>
                            </div>
                            <div>
                                <label className={LABEL}>Player date of birth</label>
                                <input type="date" className={FIELD} value={form.dob} onChange={set('dob')} />
                                {mismatch && (
                                    <p className="text-[11px] text-brand-gold mt-1">
                                        Heads up: birth year suggests {hint}. You can still join {team.age_group}, or go back and pick {hint}.
                                    </p>
                                )}
                            </div>
                            <div><label className={LABEL}>Parent / guardian name *</label><input className={FIELD} value={form.guardianName} onChange={set('guardianName')} /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={LABEL}>Email *</label><input type="email" className={FIELD} value={form.email} onChange={set('email')} /></div>
                                <div><label className={LABEL}>Phone</label><input className={FIELD} value={form.phone} onChange={set('phone')} placeholder="(815) 555-0123" /></div>
                            </div>
                            {error && <div className="text-sm text-red-400">{error}</div>}
                            <div className="flex gap-2 pt-1">
                                <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm">Cancel</button>
                                <button onClick={submit} disabled={busy} className="btn-primary flex-1 disabled:opacity-60">
                                    {busy ? 'Committing…' : 'Commit my player'}
                                </button>
                            </div>
                            <p className="text-[11px] text-gray-500 text-center">Your contact info stays private — only first name + last initial shows on the public list.</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
