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
    const [modalTeam, setModalTeam] = useState(null); // team object when committing
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

            <StaffPanel orgSlug={brand.slug} />

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
                    <Detail k="Coaches" v="U11 — Kevan Watkins · U12 — Jeremy Gunderson." />
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
                <h2 className="text-lg font-display uppercase tracking-wider text-[#e6cd87] mb-3">Pick your team</h2>

                {teams === null && <p className="text-gray-500">Loading teams…</p>}
                {loadErr && <p className="text-red-400 text-sm">{loadErr}</p>}
                {teams && teams.length === 0 && !loadErr && (
                    <p className="text-gray-400">Sign-up isn't open yet — check back soon.</p>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                    {(teams || []).map((t) => (
                        <div key={t.team_id} className="glass-panel p-5 flex flex-col">
                            <div className="text-xl font-display font-bold">{t.age_group}</div>
                            <div className="text-xs text-gray-400 mb-1">{t.name}</div>
                            {t.coach_name && <div className="text-xs text-[#e6cd87] mb-4">Coach {t.coach_name}</div>}
                            <button onClick={() => setModalTeam(t)} className="mt-auto px-6 py-2.5 rounded font-display font-bold uppercase tracking-wider text-[#0b1a33] bg-gradient-to-b from-[#e6cd87] to-[#c29a3f] hover:brightness-110 transition w-full">
                                Commit to {t.age_group}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <QASection orgSlug={brand.slug} brandName={brand.name} />

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

// Coaches-only dashboard: link opens, commits, and the full committed roster
// (names + contact). Renders only for org staff (Albert + the two coaches).
function StaffPanel({ orgSlug }) {
    const { user } = useAuth();
    const [isStaff, setIsStaff] = useState(false);
    const [stats, setStats] = useState(null);
    const [roster, setRoster] = useState([]);
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
                <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Committed players ({roster.length})</div>
                {roster.length === 0 ? (
                    <p className="text-sm text-gray-500">No commits yet.</p>
                ) : (
                    <div className="space-y-1.5">
                        {roster.map((r, i) => (
                            <div key={i} className="text-sm flex flex-wrap gap-x-3 gap-y-0.5 border-b border-white/5 pb-1.5">
                                <span className="font-semibold text-white">{r.player_first} {r.player_last}</span>
                                <span className="text-[#e6cd87]">{r.age_group}</span>
                                {r.guardian_name && <span className="text-gray-400">{r.guardian_name}</span>}
                                {r.guardian_email && <span className="text-gray-400">{r.guardian_email}</span>}
                                {r.guardian_phone && <span className="text-gray-400">{r.guardian_phone}</span>}
                            </div>
                        ))}
                    </div>
                )}
                <p className="text-[11px] text-gray-500 mt-3">Only you and your coaches see this panel — parents never do.</p>
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
            <div className="bg-[#0b1a33] border border-white/10 rounded-t-2xl md:rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                {done ? (
                    <div className="text-center py-4">
                        <div className="text-5xl mb-3">🎉</div>
                        <h3 className="text-xl font-display font-bold uppercase tracking-wider mb-1">You're in!</h3>
                        <p className="text-gray-400 text-sm">
                            {form.first} is committed to {brandName} {team.age_group}. You'll see them on the list now — {brandName} will follow up with next steps.
                        </p>
                        <button onClick={onDone} className="px-6 py-2.5 rounded font-display font-bold uppercase tracking-wider text-[#0b1a33] bg-gradient-to-b from-[#e6cd87] to-[#c29a3f] hover:brightness-110 transition w-full mt-5">See the team</button>
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
                                    <p className="text-[11px] text-[#e6cd87] mt-1">
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
