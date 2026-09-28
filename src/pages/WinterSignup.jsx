import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useBranding } from '../context/BrandingContext';
import { useAuth } from '../context/AuthContext';

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

// App showcase (real screenshots — other kids' names blurred where present).
const APP_SHOTS = [
    ['/promo/app-card.jpg', 'FIFA-style player cards'],
    ['/promo/app-passport.jpg', 'Personal development plans'],
    ['/promo/app-leaderboard.jpg', 'Every training minute, tracked'],
    ['/promo/app-challenges.jpg', 'Skill challenges'],
    ['/promo/app-warmups.jpg', 'A full training library'],
    ['/promo/app-builder.jpg', 'Coaches build practice by voice'],
];

// Age group under the AUGUST 1 cutoff (US Youth Soccer, 2026-27 season): the
// cohort window runs Aug 1 – Jul 31, so a player born Aug–Dec drops a group vs
// the old Jan-1 birth-year rule. Cohort-start year = birthYear if born Aug+,
// else birthYear-1; U-number = 2026 - cohortStart. (e.g. Aug-Dec 2015 -> U11,
// Jan-Jul 2015 -> U12, Aug-Dec 2014 -> U12.) Just a hint; the parent picks.
const suggestedU = (dob) => {
    if (!dob) return null;
    const d = new Date(dob + 'T00:00:00'); // local midnight, avoids TZ day-shift
    const y = d.getFullYear();
    if (!y) return null;
    const cohortStart = (d.getMonth() + 1) >= 8 ? y : y - 1;
    return `U${2026 - cohortStart}`;
};

export default function WinterSignup() {
    const brand = useBranding();
    const [teams, setTeams] = useState(null);      // null = loading
    const [modalTeam, setModalTeam] = useState(null); // card config when committing
    const [coachModal, setCoachModal] = useState(false); // "interested in coaching" capture
    const [loadErr, setLoadErr] = useState('');

    // Public view intentionally does NOT load or show who has committed / how
    // many (Albert may re-enable later). Only the team list is fetched.
    const load = async () => {
        const tRes = await supabase.rpc('list_winter_teams', { p_org_slug: brand.slug });
        if (tRes.error) { setLoadErr("Couldn't load teams. Please refresh."); setTeams([]); return; }
        setTeams(tRes.data || []);
    };

    useEffect(() => {
        if (!brand?.slug) return;
        load();
        // Anonymous open tracking — one visit id per browser, deduped server-side to once/day.
        try {
            let vid = localStorage.getItem('rc_visit_id');
            if (!vid) { vid = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('rc_visit_id', vid); }
            // supabase query builders are lazy — MUST call .then() (or await) or the
            // request never fires. Fire-and-forget with .then(ok, err), never .catch.
            supabase.rpc('log_winter_visit', { p_org_slug: brand.slug, p_visit_id: vid, p_path: 'winter-signup' }).then(() => {}, () => {});
        } catch { /* ignore */ }
        /* eslint-disable-next-line */
    }, [brand?.slug]);

    // Build the public picker. We run TWO U12 squads (open to U11 & U12 players),
    // so all U12 team rows collapse into ONE public card — parents join one growing
    // list and we draft them into the two squads in-app. U11-age kids are welcome on
    // that same U12 card, so the standalone U11 team isn't shown publicly. U10 is its
    // own recruiting card. Momentum = total committed across every winter team (a
    // count only — never names — as social proof to keep the list growing).
    const list = teams || [];
    const u12s = list
        .filter((t) => t.age_group === 'U12')
        .sort((a, b) => Number(b.committed_count || 0) - Number(a.committed_count || 0));
    const u12Intake = u12s[0] || null;
    const u10 = list.find((t) => t.age_group === 'U10') || null;
    const totalCommitted = list.reduce((s, t) => s + Number(t.committed_count || 0), 0);

    const cards = [];
    if (u12Intake) cards.push({
        team: u12Intake,
        label: 'U12',
        title: 'U12 · Winter Squads',
        sub: 'U11 & U12 players welcome',
        note: "We're forming two U12 squads — grab your spot and we'll place your player.",
        welcomesYounger: true,
    });
    if (u10) cards.push({
        team: u10,
        label: 'U10',
        title: 'U10',
        sub: 'Now forming',
        note: 'Players — and a coach — wanted. Get in from day one.',
        welcomesYounger: false,
        coachCta: true,
    });

    return (
        <div className="min-h-screen text-white" style={{ background: 'radial-gradient(120% 90% at 50% -10%, #16305c 0%, #0b1a33 55%)' }}>
            {/* Hero */}
            <div className="px-4 pt-10 pb-6 text-center max-w-3xl mx-auto">
                <div className="flex items-center gap-3 justify-center mb-4">
                    <img src={brand.logoUrl} alt={brand.name} className="w-14 h-14 object-contain" />
                    <span className="text-2xl font-display font-bold uppercase tracking-wider">{brand.name}</span>
                </div>
                <h1 className="text-3xl md:text-4xl font-display font-bold uppercase tracking-wide leading-tight">
                    Winter Indoor <span className="text-[#e6cd87]">Sign-Up</span>
                </h1>
                <p className="text-gray-300 mt-3">
                    Winter International League · 8v8 indoor. Small rosters, tons of touches, and every
                    player developed in our app.
                </p>
                <p className="text-xs text-[#e6cd87] mt-2">
                    Season dates &amp; final fee are being confirmed — commit now to hold your spot.
                </p>
            </div>

            <StaffLogin />
            <StaffPanel orgSlug={brand.slug} teams={teams || []} />

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

            {/* App showcase */}
            <div className="px-4 max-w-3xl mx-auto mb-8">
                <div className="text-center mb-4">
                    <h2 className="text-lg font-display uppercase tracking-wider text-[#e6cd87]">Inside the app</h2>
                    <p className="text-sm text-gray-300 mt-1">Real development, tracked — every touch, minute &amp; rep.</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {APP_SHOTS.map(([src, cap]) => (
                        <div key={src} className="glass-panel p-2">
                            <img src={src} alt={cap} loading="lazy" className="w-full aspect-video object-cover rounded-md border border-white/10" />
                            <div className="text-[11px] text-gray-300 text-center mt-2 leading-snug">{cap}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Season details */}
            <div className="px-4 max-w-3xl mx-auto mb-8">
                <div className="glass-panel p-5 space-y-2.5">
                    <div className="text-[#e6cd87] font-display uppercase tracking-wider text-sm mb-1">The details</div>
                    <Detail k="League" v="Winter International League — indoor" />
                    <Detail k="Format" v="8v8 indoor (confirming with the league)" />
                    <Detail k="Season" v="Start date & schedule being finalized — commit to hold your spot." />
                    <Detail k="Coaches" v="Jeremy Gunderson & Kevan Watkins lead the U12 squads together." />
                    <Detail k="Practice" v="Both teams train together — at least 1 practice a week, plus a second day of competitive free play. Rock Valley College, with Elite Sports Center & Sports Core 2 as backups." />
                    <Detail k="Cost" v="Kept as low as possible — college field time and sponsors covering indoor time. Target $150–250/player depending on field costs; final fee confirmed soon." />
                </div>
            </div>

            {/* The kit */}
            <div className="px-4 max-w-3xl mx-auto mb-8">
                <div className="glass-panel p-5">
                    <div className="text-[#e6cd87] font-display uppercase tracking-wider text-sm mb-1">The kit</div>
                    <p className="text-sm text-gray-300 mb-4">Represent your city. Navy &amp; gold, home and away.</p>
                    <div className="flex items-end justify-center gap-6 md:gap-12 flex-wrap">
                        <img src="/branding/rockcity-jersey.png" alt="Rock City FC jersey" className="h-44 md:h-60 object-contain drop-shadow-2xl" />
                        <img src="/branding/rockcity-hoodie.png" alt="Rock City FC hoodie" className="h-44 md:h-60 object-contain drop-shadow-2xl" />
                    </div>
                </div>
            </div>

            {/* Teams */}
            <div className="px-4 max-w-3xl mx-auto pb-24">
                <h2 className="text-lg font-display uppercase tracking-wider text-[#e6cd87] mb-3">Claim your spot</h2>

                {/* Momentum — social proof (count only, never names) to keep the list growing */}
                {totalCommitted > 0 && (
                    <div className="glass-panel p-4 mb-4 flex items-center gap-3 border border-[#c9a24b]/40">
                        <div className="text-3xl">🔥</div>
                        <div>
                            <div className="text-lg font-display font-bold text-[#e6cd87] leading-none">
                                {totalCommitted} players committed <span className="text-white">and growing</span>
                            </div>
                            <div className="text-xs text-gray-300 mt-1">Two U12 squads forming — the more that join, the better we build. Come be part of it.</div>
                        </div>
                    </div>
                )}

                {teams === null && <p className="text-gray-500">Loading teams…</p>}
                {loadErr && <p className="text-red-400 text-sm">{loadErr}</p>}
                {teams && cards.length === 0 && !loadErr && (
                    <p className="text-gray-400">Sign-up isn't open yet — check back soon.</p>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                    {cards.map((c) => (
                        <div key={c.team.team_id} className="glass-panel p-5 flex flex-col">
                            <div className="text-xl font-display font-bold">{c.title}</div>
                            <div className="text-xs text-[#e6cd87] mb-1">{c.sub}</div>
                            {!c.welcomesYounger && c.team.coach_name && <div className="text-xs text-gray-400">Coach {c.team.coach_name}</div>}
                            <p className="text-sm text-gray-300 mt-2 mb-4 leading-snug">{c.note}</p>
                            <div className="mt-auto space-y-2">
                                <button onClick={() => setModalTeam(c)} className="px-6 py-2.5 rounded font-display font-bold uppercase tracking-wider text-[#0b1a33] bg-gradient-to-b from-[#e6cd87] to-[#c29a3f] hover:brightness-110 transition w-full">
                                    Commit your player
                                </button>
                                {c.coachCta && (
                                    <button onClick={() => setCoachModal(true)} className="px-6 py-2.5 rounded font-display font-bold uppercase tracking-wider text-[#e6cd87] border border-[#c9a24b]/50 hover:bg-white/5 transition w-full">
                                        I'm interested in coaching
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <QASection orgSlug={brand.slug} brandName={brand.name} />

            {modalTeam && (
                <CommitModal
                    card={modalTeam}
                    brandName={brand.name}
                    onClose={() => setModalTeam(null)}
                    onDone={async () => { setModalTeam(null); await load(); }}
                />
            )}

            {coachModal && (
                <CoachInterestModal
                    orgSlug={brand.slug}
                    brandName={brand.name}
                    onClose={() => setCoachModal(false)}
                />
            )}
        </div>
    );
}

// Live Q&A. Anyone can ask (notifies staff); club staff (manager/coach of the
// org, detected via am_i_winter_staff) get inline answer controls right here.
// Answered questions become a public FAQ.
function QASection({ orgSlug, brandName }) {
    const { user, profile } = useAuth();
    const [qa, setQa] = useState([]);          // answered (public)
    const [isStaff, setIsStaff] = useState(false);
    const [adminQs, setAdminQs] = useState([]); // all (staff only)
    const [q, setQ] = useState('');
    const [askerName, setAskerName] = useState('');
    const [askerContact, setAskerContact] = useState('');
    const [asked, setAsked] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    const load = async () => {
        const pub = await supabase.rpc('list_winter_qa', { p_org_slug: orgSlug });
        setQa(pub.data || []);
        if (user?.id) {
            const staffRes = await supabase.rpc('am_i_winter_staff', { p_org_slug: orgSlug });
            const staff = staffRes.data === true;
            setIsStaff(staff);
            if (staff) {
                const adm = await supabase.rpc('list_winter_questions_admin', { p_org_slug: orgSlug });
                setAdminQs(adm.data || []);
            }
        }
    };
    useEffect(() => { if (orgSlug) load(); /* eslint-disable-next-line */ }, [orgSlug, user?.id]);

    const submit = async () => {
        setErr('');
        if (!q.trim()) { setErr('Please type your question.'); return; }
        setBusy(true);
        const { data, error } = await supabase.rpc('submit_winter_question', {
            p_org_slug: orgSlug, p_question: q, p_asker_name: askerName, p_asker_contact: askerContact,
        });
        setBusy(false);
        if (error || (data && data.success === false)) { setErr((data && data.message) || 'Could not send — please try again.'); return; }
        setAsked(true); setQ(''); setAskerName(''); setAskerContact('');
    };

    const pending = adminQs.filter((x) => x.status === 'pending');

    return (
        <div className="px-4 max-w-3xl mx-auto pb-24">
            <h2 className="text-lg font-display uppercase tracking-wider text-[#e6cd87] mb-3">Questions &amp; Answers</h2>

            {/* Ask box */}
            <div className="glass-panel p-5 mb-5">
                {asked ? (
                    <div className="text-center py-2">
                        <div className="text-3xl mb-1">✅</div>
                        <p className="text-sm text-gray-300">Thanks! Your question was sent to {brandName} — we'll post the answer right here.</p>
                        <button onClick={() => setAsked(false)} className="text-xs text-[#e6cd87] mt-2">Ask another</button>
                    </div>
                ) : (
                    <>
                        <div className="text-sm font-bold mb-2">Ask a question</div>
                        <textarea className={FIELD} rows={2} placeholder="e.g. What days is practice? Do we need indoor shoes?" value={q} onChange={(e) => setQ(e.target.value)} />
                        <div className="grid grid-cols-2 gap-3 mt-2">
                            <input className={FIELD} placeholder="Your name (optional)" value={askerName} onChange={(e) => setAskerName(e.target.value)} />
                            <input className={FIELD} placeholder="Email/phone (optional, private)" value={askerContact} onChange={(e) => setAskerContact(e.target.value)} />
                        </div>
                        {err && <div className="text-sm text-red-400 mt-2">{err}</div>}
                        <button onClick={submit} disabled={busy} className="px-6 py-2.5 rounded font-display font-bold uppercase tracking-wider text-[#0b1a33] bg-gradient-to-b from-[#e6cd87] to-[#c29a3f] hover:brightness-110 transition w-full mt-3 disabled:opacity-60">{busy ? 'Sending…' : 'Send question'}</button>
                        <p className="text-[11px] text-gray-500 text-center mt-2">Your contact info stays private — only the question &amp; answer are posted.</p>
                    </>
                )}
            </div>

            {/* Staff answering panel */}
            {isStaff && pending.length > 0 && (
                <div className="mb-5">
                    <div className="text-xs uppercase tracking-wider text-[#e6cd87] font-bold mb-2">Pending — needs an answer ({pending.length})</div>
                    <div className="space-y-3">
                        {pending.map((x) => (
                            <PendingCard key={x.id} q={x} defaultName={profile?.full_name || ''} onDone={load} />
                        ))}
                    </div>
                </div>
            )}

            {/* Public answered FAQ */}
            {qa.length === 0 ? (
                <p className="text-sm text-gray-500">No questions answered yet — be the first to ask!</p>
            ) : (
                <div className="space-y-3">
                    {qa.map((x) => (
                        <div key={x.id} className="glass-panel p-4">
                            <div className="text-sm font-semibold text-white">Q: {x.question}</div>
                            {x.asker_name && <div className="text-[11px] text-gray-500 mt-0.5">— asked by {x.asker_name}</div>}
                            <div className="text-sm text-gray-300 mt-2 whitespace-pre-wrap">A: {x.answer}</div>
                            {x.answered_by_name && <div className="text-[11px] text-[#e6cd87] mt-1">— {x.answered_by_name}</div>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function PendingCard({ q, defaultName, onDone }) {
    const [ans, setAns] = useState('');
    const [name, setName] = useState(defaultName || '');
    const [busy, setBusy] = useState(false);
    const post = async () => {
        if (!ans.trim()) return;
        setBusy(true);
        await supabase.rpc('answer_winter_question', { p_question_id: q.id, p_answer: ans, p_answered_by_name: name });
        setBusy(false); onDone();
    };
    const hide = async () => { setBusy(true); await supabase.rpc('hide_winter_question', { p_question_id: q.id }); setBusy(false); onDone(); };
    return (
        <div className="glass-panel p-4 border border-[#c9a24b]/40">
            <div className="text-sm font-semibold">Q: {q.question}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">{q.asker_name || 'Anonymous'}{q.asker_contact ? ` · ${q.asker_contact}` : ''}</div>
            <textarea className={`${FIELD} mt-2`} rows={2} placeholder="Type your answer…" value={ans} onChange={(e) => setAns(e.target.value)} />
            <div className="flex items-center gap-2 mt-2">
                <input className={FIELD} placeholder="Answered by" value={name} onChange={(e) => setName(e.target.value)} />
                <button onClick={post} disabled={busy} className="px-6 py-2.5 rounded font-display font-bold uppercase tracking-wider text-[#0b1a33] bg-gradient-to-b from-[#e6cd87] to-[#c29a3f] hover:brightness-110 transition shrink-0 disabled:opacity-60">Post</button>
                <button onClick={hide} disabled={busy} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs shrink-0" title="Hide spam">Hide</button>
            </div>
        </div>
    );
}

// Lets a coach/manager sign in right on this page (they all have existing app
// logins). Only shows when logged out; once signed in, AuthContext updates and
// the StaffPanel below reveals itself. Parents never need this to sign a kid up.
function StaffLogin() {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [pw, setPw] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    if (user) return null;
    const signIn = async () => {
        setErr(''); setBusy(true);
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
        setBusy(false);
        if (error) { setErr('Login failed — check your email & password.'); return; }
        // AuthContext picks up the session; StaffPanel renders automatically.
    };
    return (
        <div className="px-4 max-w-3xl mx-auto mb-8">
            {!open ? (
                <div className="text-right">
                    <button onClick={() => setOpen(true)} className="text-xs text-[#e6cd87] hover:underline">
                        Coach or manager? Log in to see sign-ups →
                    </button>
                </div>
            ) : (
                <div className="glass-panel p-5 border border-[#c9a24b]/40">
                    <div className="text-[#e6cd87] font-display uppercase tracking-wider text-sm mb-3">Coach / Manager login</div>
                    <div className="space-y-3">
                        <input className={FIELD} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                        <input className={FIELD} type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') signIn(); }} />
                        {err && <div className="text-sm text-red-400">{err}</div>}
                        <div className="flex gap-2">
                            <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm">Cancel</button>
                            <button onClick={signIn} disabled={busy} className="px-6 py-2.5 rounded font-display font-bold uppercase tracking-wider text-[#0b1a33] bg-gradient-to-b from-[#e6cd87] to-[#c29a3f] hover:brightness-110 transition flex-1 disabled:opacity-60">
                                {busy ? 'Logging in…' : 'Log in'}
                            </button>
                        </div>
                        <p className="text-[11px] text-gray-500">Use your existing {`Rock City FC`} login. Parents don't need to log in to sign a player up.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

// Coaches-only dashboard: link opens, commits, and a SQUAD PLANNER — a tentative
// tagging board (Unassigned / each squad) that lives entirely in winter_signups.
// It does NOT create rosters or notify anyone; it's just how staff decide who
// goes where before drafting. Renders only for org staff (Albert + the coaches).
const shortTeamName = (n) => (n || '').replace(/^.*?—\s*/, '') || n;

function StaffPanel({ orgSlug, teams }) {
    const { user } = useAuth();
    const [isStaff, setIsStaff] = useState(false);
    const [stats, setStats] = useState(null);
    const [roster, setRoster] = useState([]);
    const [savingId, setSavingId] = useState(null);
    useEffect(() => {
        if (!user?.id || !orgSlug) return;
        (async () => {
            const s = await supabase.rpc('am_i_winter_staff', { p_org_slug: orgSlug });
            if (s.data !== true) return;
            setIsStaff(true);
            const [st, ros] = await Promise.all([
                supabase.rpc('winter_stats_admin', { p_org_slug: orgSlug }),
                supabase.rpc('list_winter_signups_admin', { p_org_slug: orgSlug }),
            ]);
            setStats(st.data || null);
            setRoster(ros.data || []);
        })();
    }, [user?.id, orgSlug]);
    if (!isStaff) return null;

    const squads = teams || [];
    const assign = async (signupId, teamId) => {
        setSavingId(signupId);
        setRoster((prev) => prev.map((r) => (r.id === signupId ? { ...r, assigned_team_id: teamId || null } : r)));
        await supabase
            .rpc('assign_winter_signup', { p_org_slug: orgSlug, p_signup_id: signupId, p_team_id: teamId || null })
            .then(() => {}, () => {});
        setSavingId(null);
    };

    // One bucket per squad (in team order) + Unassigned last.
    const buckets = [
        ...squads.map((s) => ({ key: s.team_id, label: shortTeamName(s.name), kids: roster.filter((r) => r.assigned_team_id === s.team_id) })),
        { key: 'unassigned', label: 'Unassigned', kids: roster.filter((r) => !r.assigned_team_id) },
    ];

    return (
        <div className="px-4 max-w-3xl mx-auto mb-8">
            <div className="glass-panel p-5 border border-[#c9a24b]/40">
                <div className="text-[#e6cd87] font-display uppercase tracking-wider text-sm mb-3">Coaches only · live numbers</div>
                {stats && (
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        <Stat label="Link opens" value={stats.opens_total} />
                        <Stat label="Unique visitors" value={stats.unique_visitors} />
                        <Stat label="Committed" value={stats.commits} />
                    </div>
                )}
                {stats?.opens_by_day?.length > 0 && (
                    <div className="mb-4">
                        <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Opens by day</div>
                        <div className="flex flex-wrap gap-2 text-xs text-gray-300">
                            {stats.opens_by_day.map((d) => <span key={d.day} className="bg-white/5 rounded px-2 py-1">{d.day}: {d.opens}</span>)}
                        </div>
                    </div>
                )}

                <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">Squad planner ({roster.length} committed)</div>
                {roster.length === 0 ? (
                    <p className="text-sm text-gray-500">No commits yet.</p>
                ) : (
                    <>
                        <div className="flex flex-wrap gap-2 mb-4 text-xs">
                            {buckets.map((b) => (
                                <span key={b.key} className="bg-white/5 rounded px-2 py-1 text-gray-300">
                                    {b.label}: <span className="text-[#e6cd87] font-bold">{b.kids.length}</span>
                                </span>
                            ))}
                        </div>
                        <div className="space-y-4">
                            {buckets.map((b) => (
                                <div key={b.key}>
                                    <div className="text-xs font-bold text-white mb-1.5">{b.label} <span className="text-gray-500">· {b.kids.length}</span></div>
                                    {b.kids.length === 0 ? (
                                        <p className="text-[11px] text-gray-600 pl-1">—</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {b.kids.map((r) => (
                                                <div key={r.id} className="border-b border-white/5 pb-2">
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                        <span className="font-semibold text-white text-sm">{r.player_first} {r.player_last}</span>
                                                        <span className="text-[11px] text-[#e6cd87]">{suggestedU(r.dob) || r.age_group}</span>
                                                        <select
                                                            value={r.assigned_team_id || ''}
                                                            onChange={(e) => assign(r.id, e.target.value)}
                                                            disabled={savingId === r.id}
                                                            className="ml-auto bg-[#0b1a33] border border-white/15 rounded px-2 py-1 text-xs text-white disabled:opacity-50"
                                                        >
                                                            <option value="">Unassigned</option>
                                                            {squads.map((s) => <option key={s.team_id} value={s.team_id}>{shortTeamName(s.name)}</option>)}
                                                        </select>
                                                    </div>
                                                    {(r.guardian_name || r.guardian_phone || r.guardian_email) && (
                                                        <div className="text-[11px] text-gray-500 mt-0.5">{[r.guardian_name, r.guardian_phone, r.guardian_email].filter(Boolean).join(' · ')}</div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
                <p className="text-[11px] text-gray-500 mt-3">Assignments are just a plan — they don't build rosters or notify anyone. Only you &amp; your coaches see this.</p>
            </div>
        </div>
    );
}
const Stat = ({ label, value }) => (
    <div className="bg-white/5 rounded-lg p-3 text-center">
        <div className="text-2xl font-display font-bold text-[#e6cd87]">{value ?? 0}</div>
        <div className="text-[10px] uppercase tracking-wider text-gray-400 mt-0.5">{label}</div>
    </div>
);

const Detail = ({ k, v }) => (
    <div className="flex gap-3 text-sm">
        <div className="w-20 shrink-0 text-xs uppercase tracking-wider text-gray-500 font-bold pt-0.5">{k}</div>
        <div className="text-gray-200 flex-1 leading-snug">{v}</div>
    </div>
);

// "Interested in coaching" capture (U10). Reuses the winter Q&A pipe so it lands
// in the coaches' Pending list (with private contact) and pushes a notification
// to all winter staff — no separate table needed. Staff follow up, then Hide it.
function CoachInterestModal({ orgSlug, brandName, onClose }) {
    const [form, setForm] = useState({ name: '', contact: '', note: '' });
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [done, setDone] = useState(false);
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

    const submit = async () => {
        setErr('');
        if (!form.name.trim() || !form.contact.trim()) return setErr('Your name and a way to reach you are required.');
        setBusy(true);
        const q = `🧑‍🏫 COACHING INTEREST (U10): ${form.note.trim() || 'Interested in helping coach the U10 team.'}`;
        const { data, error } = await supabase.rpc('submit_winter_question', {
            p_org_slug: orgSlug, p_question: q, p_asker_name: form.name, p_asker_contact: form.contact,
        });
        setBusy(false);
        if (error || (data && data.success === false)) { setErr('Could not send — please try again.'); return; }
        setDone(true);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
            <div className="bg-[#0b1a33] border border-white/10 rounded-t-2xl md:rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                {done ? (
                    <div className="text-center py-4">
                        <div className="text-5xl mb-3">🙌</div>
                        <h3 className="text-xl font-display font-bold uppercase tracking-wider mb-1">Thank you!</h3>
                        <p className="text-gray-400 text-sm">{brandName} will reach out about coaching the U10 team. Appreciate you stepping up!</p>
                        <button onClick={onClose} className="px-6 py-2.5 rounded font-display font-bold uppercase tracking-wider text-[#0b1a33] bg-gradient-to-b from-[#e6cd87] to-[#c29a3f] hover:brightness-110 transition w-full mt-5">Close</button>
                    </div>
                ) : (
                    <>
                        <h3 className="text-xl font-display font-bold uppercase tracking-wider mb-1">Interested in coaching?</h3>
                        <p className="text-gray-400 text-xs mb-4">We're looking for a U10 coach — tell us about yourself and we'll be in touch.</p>
                        <div className="space-y-3">
                            <div><label className={LABEL}>Your name *</label><input className={FIELD} value={form.name} onChange={set('name')} /></div>
                            <div><label className={LABEL}>Email or phone *</label><input className={FIELD} value={form.contact} onChange={set('contact')} placeholder="you@email.com / (815) 555-0123" /></div>
                            <div><label className={LABEL}>Anything to add? (experience, your player, etc.)</label><textarea className={FIELD} rows={3} value={form.note} onChange={set('note')} /></div>
                            {err && <div className="text-sm text-red-400">{err}</div>}
                            <div className="flex gap-2 pt-1">
                                <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm">Cancel</button>
                                <button onClick={submit} disabled={busy} className="px-6 py-2.5 rounded font-display font-bold uppercase tracking-wider text-[#0b1a33] bg-gradient-to-b from-[#e6cd87] to-[#c29a3f] hover:brightness-110 transition flex-1 disabled:opacity-60">
                                    {busy ? 'Sending…' : 'Send'}
                                </button>
                            </div>
                            <p className="text-[11px] text-gray-500 text-center">Your contact info stays private — it only goes to {brandName} staff.</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function CommitModal({ card, brandName, onClose, onDone }) {
    const team = card.team;
    const [form, setForm] = useState({ first: '', last: '', dob: '', guardianName: '', email: '', phone: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

    const hint = suggestedU(form.dob);
    // On the U12 card both U11 & U12 players are welcome, so a younger birth year
    // is reassured, not redirected. Elsewhere, a genuine mismatch nudges the parent.
    const welcomeYounger = card.welcomesYounger && (hint === 'U11' || hint === 'U12');
    const mismatch = hint && hint !== card.label && !welcomeYounger;

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
            <div className="bg-[#0b1a33] border border-white/10 rounded-t-2xl md:rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                {done ? (
                    <div className="text-center py-4">
                        <div className="text-5xl mb-3">🎉</div>
                        <h3 className="text-xl font-display font-bold uppercase tracking-wider mb-1">You're in!</h3>
                        <p className="text-gray-400 text-sm">
                            {form.first} is committed to {brandName} {card.label}. {brandName} will be in touch with next steps — see you on the pitch! ⚽
                        </p>
                        <button onClick={onDone} className="px-6 py-2.5 rounded font-display font-bold uppercase tracking-wider text-[#0b1a33] bg-gradient-to-b from-[#e6cd87] to-[#c29a3f] hover:brightness-110 transition w-full mt-5">Done</button>
                    </div>
                ) : (
                    <>
                        <h3 className="text-xl font-display font-bold uppercase tracking-wider mb-1">Commit to {card.label}</h3>
                        <p className="text-gray-400 text-xs mb-4">{card.sub} · Winter indoor</p>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={LABEL}>Player first *</label><input className={FIELD} value={form.first} onChange={set('first')} /></div>
                                <div><label className={LABEL}>Player last *</label><input className={FIELD} value={form.last} onChange={set('last')} /></div>
                            </div>
                            <div>
                                <label className={LABEL}>Player date of birth</label>
                                <input type="date" className={FIELD} value={form.dob} onChange={set('dob')} />
                                {welcomeYounger && form.dob && (
                                    <p className="text-[11px] text-[#e6cd87] mt-1">
                                        {hint} age — perfect. U11 &amp; U12 players train and compete together this winter.
                                    </p>
                                )}
                                {mismatch && (
                                    <p className="text-[11px] text-[#e6cd87] mt-1">
                                        Heads up: birth year suggests {hint}. You can still join {card.label}, or go back and pick {hint}.
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
                                <button onClick={submit} disabled={busy} className="px-6 py-2.5 rounded font-display font-bold uppercase tracking-wider text-[#0b1a33] bg-gradient-to-b from-[#e6cd87] to-[#c29a3f] hover:brightness-110 transition flex-1 disabled:opacity-60">
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
