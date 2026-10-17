import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useBranding } from '../context/BrandingContext';
import { useAuth } from '../context/AuthContext';

// PORTUGAL TOUR HQ — public, branded trip portal for the Rockford Raptors trip
// to the International Football Tournament in São Miguel, Azores (April 2027).
// Parents hard-commit a player (deadline Nov 15) or raise a hand as
// "interested"; staff see live stats + the full organizer roster with deposit
// tracking. No login needed to commit. Mirrors WinterSignup.jsx architecture;
// data via the anon-safe RPCs in 20261017_portugal_tour_portal.sql.

const FIELD = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-brand-green focus:outline-none';
const LABEL = 'block text-xs uppercase tracking-wider text-gray-400 mb-1';
const CTA = 'px-6 py-2.5 rounded font-display font-bold uppercase tracking-wider text-[#0b1a33] bg-gradient-to-b from-[#ff9d5c] to-[#f36721] hover:brightness-110 transition disabled:opacity-60';

// Everything date/cost-related lives here so edits are one-line changes as the
// club confirms details.
const TRIP = {
    title: 'Portugal Tour 2027',
    event: 'International Football Tournament',
    location: 'São Miguel, Azores · Portugal',
    when: 'April 2027 (exact dates announced by the tournament)',
    deadline: '2026-11-15',
    deadlineLabel: 'November 15',
    ageGroups: ['U11', 'U12'],
    guaranteed: 10,  // first N players are locked on the roster
    maxRoster: 12,   // hard cap per team
};

// This portal is the Raptors' trip HQ only — any other club slug gets a
// neutral hand-off (white-label rule: never render one club's content under
// another club's brand).
const RAPTORS_SLUG = 'rockford-raptors';

const daysLeft = () => {
    const end = new Date(TRIP.deadline + 'T23:59:59-06:00'); // Central
    return Math.max(0, Math.ceil((end - new Date()) / 86400000));
};

const ROADMAP = [
    ['Now → Nov 15', 'Commit your player', 'Spots are first-come. Commit below — the first 10 per team are locked, 11–12 fill the bench.'],
    ['Mid-November', 'Kickoff meeting', 'Rosters announced, full cost breakdown, deposit collected, every question answered in one night.'],
    ['December', 'Rosters locked + fundraising launch', 'Team fundraising kicks off to knock down the family cost. Flights booked as a group window.'],
    ['Jan → March', 'Train as a tournament squad', 'Regular sessions with THIS roster — set pieces, shape, chemistry. We arrive as a team, not a collection of kids.'],
    ['April 2027', 'Fly out & compete', 'São Miguel, Azores. We are not going for the experience — we are going to win it.'],
];

const FAQ = [
    ['Who is this for?', `Raptors ${TRIP.ageGroups.join(' & ')} players (and invited guest players). First ${TRIP.guaranteed} committed players per team are guaranteed the roster; max ${TRIP.maxRoster}.`],
    ['What does the player fee cover?', 'Tournament participation, transportation in Portugal, and meals for the player. The flight is separate (see the flight guide above). The final fee number is presented at the kickoff meeting.'],
    ['Can the family come?', 'Absolutely — this is an unbelievable family trip. Families book their own flights, then either stay in the team hotel (small per-person fee set by the hotel) or grab an Airbnb, which is often cheaper for a whole family.'],
    ['When is money due?', `A player deposit secures the roster spot (collected at/after the kickoff meeting). Any family members attending must also pay their deposit by the due date. Full payment schedule comes with the roster — no surprises.`],
    ["What if we're not 100% sure yet?", 'Pick "Interested — tell me more" on the form. Zero obligation; you\'ll get every update and can convert to a full commit any time a spot is still open.'],
    ['Why this page instead of club emails?', 'Past trips came together last-minute with info trickling out. This page is the single source of truth — live spot counts, the full plan, and one place to commit. Run like a program, not a scramble.'],
];

export default function PortugalTour() {
    const brand = useBranding();
    const { user, signOut } = useAuth();
    const [stats, setStats] = useState(null);
    const [modalAge, setModalAge] = useState(null); // 'U11' | 'U12' when form open
    const [shareMsg, setShareMsg] = useState('');

    // No ?club= in the URL → this link belongs to the Raptors; make it explicit
    // (also defeats any stale sticky-club session state).
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (!params.get('club')) {
            params.set('club', RAPTORS_SLUG);
            window.location.replace(`/portugal?${params.toString()}`);
        }
    }, []);

    const isRaptors = brand.slug === RAPTORS_SLUG;

    const loadStats = async () => {
        const { data } = await supabase.rpc('portugal_public_stats', { p_org_slug: RAPTORS_SLUG });
        if (data) setStats(data);
    };

    useEffect(() => {
        if (!isRaptors) return;
        loadStats();
        // Anonymous open tracking — one visit id per browser, deduped server-side
        // to once/day. ?src= gives per-channel attribution (first touch wins).
        try {
            let vid = localStorage.getItem('pt_visit_id');
            if (!vid) { vid = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('pt_visit_id', vid); }
            const urlSrc = new URLSearchParams(window.location.search).get('src');
            let src = localStorage.getItem('pt_src');
            if (urlSrc && !src) { src = urlSrc; localStorage.setItem('pt_src', src); }
            // supabase builders are lazy — must call .then() or the request never fires.
            supabase.rpc('log_portugal_visit', { p_org_slug: RAPTORS_SLUG, p_visit_id: vid, p_source: src || urlSrc || null }).then(() => {}, () => {});
        } catch { /* ignore */ }
        /* eslint-disable-next-line */
    }, [isRaptors]);

    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/portugal?club=${RAPTORS_SLUG}` : '';
    const share = async () => {
        const data = { title: `${brand.name} — ${TRIP.title}`, text: `Commit your player for the Raptors trip to Portugal (April 2027):`, url: shareUrl };
        try { if (navigator.share) { await navigator.share(data); return; } } catch { return; }
        try { await navigator.clipboard.writeText(shareUrl); setShareMsg('Link copied!'); setTimeout(() => setShareMsg(''), 2500); }
        catch { setShareMsg(shareUrl); }
    };

    const dLeft = useMemo(daysLeft, []);

    if (brand.slug && !isRaptors) {
        return (
            <div className="min-h-screen text-white flex items-center justify-center p-6" style={{ background: 'radial-gradient(120% 90% at 50% -10%, #16305c 0%, #0b1a33 55%)' }}>
                <div className="max-w-md w-full text-center space-y-4">
                    <img src={brand.logoUrl} alt={brand.name} className="w-16 h-16 object-contain mx-auto" />
                    <h1 className="text-2xl font-display font-bold uppercase tracking-wider">{brand.name}</h1>
                    <p className="text-gray-300 text-sm">This trip page belongs to the Rockford Raptors. Looking for your club's app?</p>
                    <a href={`/login?club=${encodeURIComponent(brand.slug)}`} className="inline-block px-6 py-3 rounded-lg bg-brand-green text-brand-dark font-display font-bold uppercase tracking-wider">
                        Open the {brand.shortName || brand.name} app
                    </a>
                </div>
            </div>
        );
    }

    const spotCards = [
        { age: 'U11', committed: Number(stats?.u11_committed || 0) },
        { age: 'U12', committed: Number(stats?.u12_committed || 0) },
    ];

    return (
        <div className="min-h-screen text-white" style={{ background: 'radial-gradient(120% 90% at 50% -10%, #34231c 0%, #0b1a33 60%)' }}>
            {/* Top bar */}
            <div className="px-4 pt-4 max-w-3xl mx-auto flex items-center justify-end gap-2">
                {shareMsg && <span className="text-xs text-[#ff9d5c] mr-1">{shareMsg}</span>}
                <button onClick={share} className="text-xs font-display font-bold uppercase tracking-wider text-[#0b1a33] bg-gradient-to-b from-[#ff9d5c] to-[#f36721] hover:brightness-110 transition rounded px-3 py-1.5">
                    🔗 Share this page
                </button>
                {user && (
                    <button onClick={async () => { await signOut(); }} className="text-xs font-bold uppercase tracking-wider text-gray-300 border border-white/20 hover:bg-white/5 transition rounded px-3 py-1.5">
                        Sign out
                    </button>
                )}
            </div>

            {/* Hero */}
            <div className="px-4 pt-6 pb-6 text-center max-w-3xl mx-auto">
                <div className="flex items-center gap-3 justify-center mb-4">
                    <img src={brand.logoUrl} alt={brand.name} className="w-14 h-14 object-contain" />
                    <span className="text-2xl font-display font-bold uppercase tracking-wider">{brand.name}</span>
                </div>
                <h1 className="text-3xl md:text-5xl font-display font-bold uppercase tracking-wide leading-tight">
                    <span className="text-[#ff9d5c]">Portugal</span> Tour 2027
                </h1>
                <p className="text-gray-300 mt-3">
                    {TRIP.event} · {TRIP.location}<br />{TRIP.when}
                </p>
                <div className="mt-4 inline-flex items-center gap-3 rounded-xl border border-[#f36721]/50 bg-[#f36721]/10 px-5 py-3">
                    <div className="text-3xl font-display font-bold text-[#ff9d5c]">{dLeft}</div>
                    <div className="text-left text-xs uppercase tracking-wider text-gray-300 leading-tight">
                        days left to commit<br /><span className="text-white font-bold">deadline {TRIP.deadlineLabel}</span>
                    </div>
                </div>
            </div>

            <StaffLogin brandName={brand.name} />
            <StaffPanel />

            {/* Spot tracker + commit CTAs */}
            <div className="px-4 max-w-3xl mx-auto mb-10">
                <h2 className="text-lg font-display uppercase tracking-wider text-[#ff9d5c] mb-3">Claim a roster spot</h2>
                <div className="grid md:grid-cols-2 gap-4">
                    {spotCards.map(({ age, committed }) => {
                        const left = Math.max(0, TRIP.maxRoster - committed);
                        return (
                            <div key={age} className="glass-panel p-5 flex flex-col">
                                <div className="flex items-baseline justify-between">
                                    <div className="text-xl font-display font-bold">{age} Squad</div>
                                    <div className="text-xs text-[#ff9d5c]">{committed} of {TRIP.maxRoster} spots claimed</div>
                                </div>
                                <div className="h-2 rounded-full bg-white/10 mt-2 overflow-hidden">
                                    <div className="h-full rounded-full bg-gradient-to-r from-[#f36721] to-[#ff9d5c]" style={{ width: `${Math.min(100, (committed / TRIP.maxRoster) * 100)}%` }} />
                                </div>
                                <p className="text-sm text-gray-300 mt-3 mb-4 leading-snug">
                                    {age === 'U12'
                                        ? `First ${TRIP.guaranteed} committed are locked in. The U12 squad goes if it fills — commit now to make it happen.`
                                        : `First ${TRIP.guaranteed} committed are locked in; spots ${TRIP.guaranteed + 1}–${TRIP.maxRoster} round out the squad.`}
                                    {left > 0 && left <= 4 && <span className="text-[#ff9d5c] font-semibold"> Only {left} left.</span>}
                                </p>
                                <button onClick={() => setModalAge(age)} className={`${CTA} w-full mt-auto`}>
                                    {left === 0 ? 'Join the waitlist' : 'Commit my player'}
                                </button>
                            </div>
                        );
                    })}
                </div>
                {Number(stats?.interested || 0) > 0 && (
                    <p className="text-xs text-gray-400 mt-3 text-center">{stats.interested} more {Number(stats.interested) === 1 ? 'family is' : 'families are'} deciding — don't wait on a spot.</p>
                )}
            </div>

            {/* The mission */}
            <div className="px-4 max-w-3xl mx-auto mb-10">
                <div className="glass-panel p-5 border border-[#f36721]/40">
                    <div className="text-[#ff9d5c] font-display uppercase tracking-wider text-sm mb-2">The mission</div>
                    <p className="text-sm text-gray-200 leading-relaxed">
                        This trip has been an amazing experience in the past — but it always came together late, with
                        information showing up at the last minute. Not this time. We're picking the squad <b>now</b>,
                        locking the plan early, fundraising as a team, and training together all winter so we step off
                        the plane in the Azores ready to <b>win the whole thing</b>.
                    </p>
                    <ul className="text-sm text-gray-300 mt-3 space-y-1.5">
                        <li>✅ One page with everything — no digging through email chains</li>
                        <li>✅ Live roster count — you always know where the squad stands</li>
                        <li>✅ Team fundraising to cut every family's cost</li>
                        <li>✅ A real training block with the tournament roster, Jan–March</li>
                    </ul>
                </div>
            </div>

            {/* The details */}
            <div className="px-4 max-w-3xl mx-auto mb-10">
                <div className="glass-panel p-5 space-y-2.5">
                    <div className="text-[#ff9d5c] font-display uppercase tracking-wider text-sm mb-1">The details</div>
                    <Detail k="Event" v={`${TRIP.event} — ${TRIP.location}`} />
                    <Detail k="When" v={TRIP.when} />
                    <Detail k="Teams" v={`${TRIP.ageGroups.join(' + ')} · first ${TRIP.guaranteed} players locked per team, max ${TRIP.maxRoster}`} />
                    <Detail k="Player fee" v="Covers tournament participation, transportation in Portugal, and meals. Final number presented at the kickoff meeting — fundraising will bring it down." />
                    <Detail k="Not included" v="The flight (booked per family — full guide below) and family travel costs." />
                    <Detail k="Family" v="Families are welcome and encouraged! Stay in the team hotel (small per-person fee) or get an Airbnb — often cheaper for a whole crew." />
                    <Detail k="Deposit" v="A player deposit secures the spot; family members attending pay their deposit by the due date. Amounts + schedule at the kickoff meeting." />
                </div>
            </div>

            {/* Flight guide */}
            <div className="px-4 max-w-3xl mx-auto mb-10">
                <div className="glass-panel p-5">
                    <div className="text-[#ff9d5c] font-display uppercase tracking-wider text-sm mb-2">✈️ Flight guide</div>
                    <div className="space-y-2.5">
                        <Detail k="Airline" v={<span>SATA / Azores Airlines — book direct at <a href="https://www.sata.pt" target="_blank" rel="noopener noreferrer" className="text-[#ff9d5c] underline">sata.pt</a> (Priceline &amp; co. work too).</span>} />
                        <Detail k="Airport" v="PDL — Ponta Delgada, São Miguel island." />
                        <Detail k="Typical route" v="Chicago (ORD) → Boston (BOS) or New York (JFK) → PDL, same coming home. You can book straight through from Chicago, or book the Boston leg separately — sometimes cheaper and gives more options." />
                        <Detail k="Pro tip" v="We'll coordinate a booking window as a group so the squad lands together. Don't book until rosters are locked in December." />
                    </div>
                </div>
            </div>

            {/* Roadmap */}
            <div className="px-4 max-w-3xl mx-auto mb-10">
                <h2 className="text-lg font-display uppercase tracking-wider text-[#ff9d5c] mb-3">The plan</h2>
                <div className="space-y-3">
                    {ROADMAP.map(([when, title, sub], i) => (
                        <div key={when} className="glass-panel p-4 flex gap-4 items-start">
                            <div className="w-9 h-9 rounded-full bg-[#f36721]/20 border border-[#f36721]/50 flex items-center justify-center font-display font-bold text-[#ff9d5c] shrink-0">{i + 1}</div>
                            <div>
                                <div className="text-xs uppercase tracking-wider text-[#ff9d5c]">{when}</div>
                                <div className="font-bold text-white">{title}</div>
                                <div className="text-sm text-gray-300 leading-snug mt-0.5">{sub}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Fundraising */}
            <div className="px-4 max-w-3xl mx-auto mb-10">
                <div className="glass-panel p-5 border border-[#f36721]/40">
                    <div className="text-[#ff9d5c] font-display uppercase tracking-wider text-sm mb-2">💰 Fundraising</div>
                    <p className="text-sm text-gray-200 leading-relaxed">
                        Once rosters lock in December, we launch team fundraising — local business sponsorships,
                        events, and more — with every dollar cutting the cost for all families equally. Own a business
                        (or know one) that wants their name on a team going to Portugal? Say so in the sign-up notes
                        and we'll reach out.
                    </p>
                </div>
            </div>

            {/* FAQ */}
            <div className="px-4 max-w-3xl mx-auto pb-10">
                <h2 className="text-lg font-display uppercase tracking-wider text-[#ff9d5c] mb-3">FAQ</h2>
                <div className="space-y-3">
                    {FAQ.map(([q, a]) => (
                        <div key={q} className="glass-panel p-4">
                            <div className="text-sm font-semibold text-white">{q}</div>
                            <div className="text-sm text-gray-300 mt-1 leading-snug">{a}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom CTA */}
            <div className="px-4 max-w-3xl mx-auto pb-24 text-center">
                <div className="glass-panel p-6 border border-[#f36721]/40">
                    <div className="text-xl font-display font-bold uppercase tracking-wide mb-1">Don't get left behind</div>
                    <p className="text-sm text-gray-300 mb-4">Commit by {TRIP.deadlineLabel} — the squad, the plan, and the plane are leaving either way.</p>
                    <div className="flex flex-col md:flex-row gap-2 justify-center">
                        {TRIP.ageGroups.map((age) => (
                            <button key={age} onClick={() => setModalAge(age)} className={CTA}>Commit — {age}</button>
                        ))}
                    </div>
                </div>
            </div>

            {modalAge && (
                <CommitModal
                    age={modalAge}
                    brandName={brand.name}
                    onClose={() => setModalAge(null)}
                    onDone={async () => { setModalAge(null); await loadStats(); }}
                />
            )}
        </div>
    );
}

const Detail = ({ k, v }) => (
    <div className="flex gap-3 text-sm">
        <div className="w-24 shrink-0 text-xs uppercase tracking-wider text-gray-500 font-bold pt-0.5">{k}</div>
        <div className="text-gray-200 flex-1 leading-snug">{v}</div>
    </div>
);

const COUNT_OPTS = [0, 1, 2, 3, 4, 5];

function CommitModal({ age, brandName, onClose, onDone }) {
    const [form, setForm] = useState({
        first: '', last: '', contactName: '', relation: 'Mom', email: '', phone: '',
        commitment: 'committed', parents: 1, siblings: 0, other: 0, notes: '',
        ackPlayer: false, ackFamily: false,
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
    const committed = form.commitment === 'committed';

    const submit = async () => {
        setError('');
        if (!form.first.trim() || !form.last.trim()) return setError("Player's first and last name are required.");
        if (!form.contactName.trim() || !form.email.trim()) return setError('Your name and email are required.');
        if (committed && !form.phone.trim()) return setError('A phone number is required for a full commit.');
        if (committed && !form.ackPlayer) return setError('Please acknowledge the player deposit to commit.');
        if (committed && (Number(form.parents) + Number(form.siblings) + Number(form.other) > 0) && !form.ackFamily)
            return setError('Please acknowledge the family-member deposit (or set family travelers to 0).');
        setBusy(true);
        try {
            const { data, error } = await supabase.rpc('submit_portugal_signup', {
                p_org_slug: RAPTORS_SLUG,
                p_age_group: age,
                p_player_first: form.first,
                p_player_last: form.last,
                p_contact_name: form.contactName,
                p_contact_relation: form.relation,
                p_email: form.email,
                p_phone: form.phone,
                p_commitment: form.commitment,
                p_family_parents: Number(form.parents),
                p_family_siblings: Number(form.siblings),
                p_family_other: Number(form.other),
                p_ack_player: form.ackPlayer,
                p_ack_family: form.ackFamily,
                p_notes: form.notes,
                p_source: (typeof window !== 'undefined' && localStorage.getItem('pt_src')) || null,
            });
            if (error) throw new Error(error.message);
            if (data && data.success === false) throw new Error(data.message || 'Could not submit.');
            setDone(true);
        } catch (e) {
            setError(e.message || 'Something went wrong — please try again.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center justify-center p-0 md:p-4 overflow-y-auto" onClick={onClose}>
            <div className="bg-[#0b1a33] border border-white/10 rounded-t-2xl md:rounded-2xl w-full max-w-md p-6 my-auto" onClick={(e) => e.stopPropagation()}>
                {done ? (
                    <div className="text-center py-4">
                        <div className="text-5xl mb-3">{committed ? '🎉' : '📬'}</div>
                        <h3 className="text-xl font-display font-bold uppercase tracking-wider mb-1">{committed ? "You're on the list!" : 'Got it!'}</h3>
                        <p className="text-gray-400 text-sm">
                            {committed
                                ? `${form.first} is committed to the ${age} Portugal squad. Next step: the kickoff meeting (watch your email) — deposit collected there to lock the spot.`
                                : `We'll send ${form.first ? `${form.first}'s family` : 'you'} every update. Convert to a full commit any time a spot is open.`}
                        </p>
                        <button onClick={onDone} className={`${CTA} w-full mt-5`}>Done</button>
                    </div>
                ) : (
                    <>
                        <h3 className="text-xl font-display font-bold uppercase tracking-wider mb-1">{age} · Portugal 2027</h3>
                        <p className="text-gray-400 text-xs mb-4">{brandName} · {TRIP.location}</p>
                        <div className="space-y-3">
                            {/* Commitment level first — it drives what's required below */}
                            <div className="grid grid-cols-1 gap-2">
                                {[['committed', "✅ 100% IN — hold our spot"], ['interested', '🤔 Interested — tell me more first']].map(([val, label]) => (
                                    <button key={val} onClick={() => setForm({ ...form, commitment: val })}
                                        className={`text-left text-sm rounded-lg border px-3 py-2.5 transition ${form.commitment === val ? 'border-[#f36721] bg-[#f36721]/15 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}`}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={LABEL}>Player first *</label><input className={FIELD} value={form.first} onChange={set('first')} /></div>
                                <div><label className={LABEL}>Player last *</label><input className={FIELD} value={form.last} onChange={set('last')} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={LABEL}>Your name *</label><input className={FIELD} value={form.contactName} onChange={set('contactName')} /></div>
                                <div>
                                    <label className={LABEL}>Relation</label>
                                    <select className={FIELD} value={form.relation} onChange={set('relation')}>
                                        {['Mom', 'Dad', 'Guardian', 'Grandparent', 'Other'].map((r) => <option key={r}>{r}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={LABEL}>Email *</label><input type="email" className={FIELD} value={form.email} onChange={set('email')} /></div>
                                <div><label className={LABEL}>Phone {committed ? '*' : ''}</label><input className={FIELD} value={form.phone} onChange={set('phone')} placeholder="(815) 555-0123" /></div>
                            </div>
                            <div>
                                <label className={LABEL}>Family coming along? (besides the player)</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[['parents', 'Parents'], ['siblings', 'Siblings'], ['other', 'Others']].map(([k, lbl]) => (
                                        <div key={k}>
                                            <select className={FIELD} value={form[k]} onChange={set(k)}>
                                                {COUNT_OPTS.map((n) => <option key={n} value={n}>{n}</option>)}
                                            </select>
                                            <div className="text-[10px] text-gray-500 text-center mt-0.5">{lbl}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div><label className={LABEL}>Anything we should know? (questions, business sponsor, etc.)</label><textarea className={FIELD} rows={2} value={form.notes} onChange={set('notes')} /></div>
                            {committed && (
                                <div className="space-y-2 rounded-lg border border-[#f36721]/40 bg-[#f36721]/10 p-3">
                                    <label className="flex items-start gap-2 text-xs text-gray-200">
                                        <input type="checkbox" className="mt-0.5" checked={form.ackPlayer} onChange={set('ackPlayer')} />
                                        <span>I understand a <b>player deposit</b> must be made to secure the roster spot. *</span>
                                    </label>
                                    <label className="flex items-start gap-2 text-xs text-gray-200">
                                        <input type="checkbox" className="mt-0.5" checked={form.ackFamily} onChange={set('ackFamily')} />
                                        <span>I understand any <b>family members</b> going must pay their deposit by the due date.</span>
                                    </label>
                                </div>
                            )}
                            {error && <div className="text-sm text-red-400">{error}</div>}
                            <div className="flex gap-2 pt-1">
                                <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm">Cancel</button>
                                <button onClick={submit} disabled={busy} className={`${CTA} flex-1`}>
                                    {busy ? 'Sending…' : committed ? 'Lock it in' : 'Keep me posted'}
                                </button>
                            </div>
                            <p className="text-[11px] text-gray-500 text-center">Your contact info stays private — only trip organizers see it.</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// Organizer sign-in right on the page (existing app logins). Once signed in,
// AuthContext updates and StaffPanel reveals itself.
function StaffLogin({ brandName }) {
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
    };
    return (
        <div className="px-4 max-w-3xl mx-auto mb-8">
            {!open ? (
                <button onClick={() => setOpen(true)} className="w-full glass-panel border border-[#f36721]/50 rounded-xl px-5 py-3 flex items-center justify-center gap-2 text-[#ff9d5c] font-display font-bold uppercase tracking-wider text-sm hover:bg-white/5 transition">
                    🔑 Trip organizers — log in
                </button>
            ) : (
                <div className="glass-panel p-5 border border-[#f36721]/40">
                    <div className="text-[#ff9d5c] font-display uppercase tracking-wider text-sm mb-3">Organizer login</div>
                    <div className="space-y-3">
                        <input className={FIELD} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                        <input className={FIELD} type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') signIn(); }} />
                        {err && <div className="text-sm text-red-400">{err}</div>}
                        <div className="flex gap-2">
                            <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm">Cancel</button>
                            <button onClick={signIn} disabled={busy} className={`${CTA} flex-1`}>{busy ? 'Logging in…' : 'Log in'}</button>
                        </div>
                        <p className="text-[11px] text-gray-500">Use your existing {brandName} login. Parents don't need to log in to commit a player.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

const SOURCE_LABELS = { 'direct / other': 'Direct / other' };

function StaffPanel() {
    const { user } = useAuth();
    const [isStaff, setIsStaff] = useState(false);
    const [stats, setStats] = useState(null);
    const [rows, setRows] = useState([]);
    const [savingId, setSavingId] = useState(null);

    const load = async () => {
        const [st, ros] = await Promise.all([
            supabase.rpc('portugal_stats_admin', { p_org_slug: RAPTORS_SLUG }),
            supabase.rpc('list_portugal_signups_admin', { p_org_slug: RAPTORS_SLUG }),
        ]);
        setStats(st.data || null);
        setRows(ros.data || []);
    };

    useEffect(() => {
        if (!user?.id) { setIsStaff(false); return; }
        (async () => {
            const s = await supabase.rpc('am_i_portugal_staff', { p_org_slug: RAPTORS_SLUG });
            if (s.data !== true) return;
            setIsStaff(true);
            await load();
        })();
        /* eslint-disable-next-line */
    }, [user?.id]);
    if (!isStaff) return null;

    const save = async (id, patch) => {
        setSavingId(id);
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
        await supabase.rpc('update_portugal_signup_admin', {
            p_signup_id: id,
            p_status: patch.status ?? null,
            p_deposit_paid: patch.deposit_paid ?? null,
            p_admin_notes: patch.admin_notes ?? null,
        }).then(() => {}, () => {});
        setSavingId(null);
    };

    const exportCsv = () => {
        const cols = ['age_group', 'player_first', 'player_last', 'commitment', 'status', 'deposit_paid',
            'contact_name', 'contact_relation', 'contact_email', 'contact_phone',
            'family_parents', 'family_siblings', 'family_other', 'ack_player_deposit', 'ack_family_deposit',
            'notes', 'admin_notes', 'source', 'created_at'];
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = 'portugal-2027-signups.csv';
        a.click();
        URL.revokeObjectURL(a.href);
    };

    const groups = [
        { label: 'U11 — committed', kids: rows.filter((r) => r.age_group === 'U11' && r.commitment === 'committed') },
        { label: 'U12 — committed', kids: rows.filter((r) => r.age_group === 'U12' && r.commitment === 'committed') },
        { label: 'Interested (not committed yet)', kids: rows.filter((r) => r.commitment === 'interested') },
    ];

    return (
        <div className="px-4 max-w-3xl mx-auto mb-8">
            <div className="glass-panel p-5 border border-[#f36721]/40">
                <div className="flex items-center justify-between mb-3">
                    <div className="text-[#ff9d5c] font-display uppercase tracking-wider text-sm">Organizers only · live numbers</div>
                    <button onClick={exportCsv} className="text-xs font-bold uppercase tracking-wider text-gray-300 border border-white/20 hover:bg-white/5 transition rounded px-3 py-1.5">⬇ CSV</button>
                </div>
                {stats && (
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
                        <Stat label="Opens" value={stats.opens_total} />
                        <Stat label="Visitors" value={stats.unique_visitors} />
                        <Stat label="Committed" value={stats.committed} />
                        <Stat label="Interested" value={stats.interested} />
                        <Stat label="Deposits" value={stats.deposits_paid} />
                        <Stat label="Family going" value={stats.family_travelers} />
                    </div>
                )}
                {stats?.opens_by_day?.length > 0 && (
                    <div className="mb-3">
                        <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Opens by day</div>
                        <div className="flex flex-wrap gap-2 text-xs text-gray-300">
                            {stats.opens_by_day.map((d) => <span key={d.day} className="bg-white/5 rounded px-2 py-1">{d.day}: {d.opens}</span>)}
                        </div>
                    </div>
                )}
                {stats?.opens_by_source?.length > 0 && (
                    <div className="mb-4">
                        <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Where traffic came from</div>
                        <div className="flex flex-wrap gap-2 text-xs text-gray-300">
                            {stats.opens_by_source.map((s) => (
                                <span key={s.source} className="bg-white/5 rounded px-2 py-1">{SOURCE_LABELS[s.source] || s.source}: <span className="text-[#ff9d5c] font-bold">{s.visitors}</span></span>
                            ))}
                        </div>
                    </div>
                )}

                {rows.length === 0 ? (
                    <p className="text-sm text-gray-500">No sign-ups yet — share the link!</p>
                ) : (
                    <div className="space-y-5">
                        {groups.filter((g) => g.kids.length > 0).map((g) => (
                            <div key={g.label}>
                                <div className="text-xs font-bold text-white mb-2">{g.label} <span className="text-gray-500">· {g.kids.length}</span></div>
                                <div className="space-y-2.5">
                                    {g.kids.map((r) => (
                                        <div key={r.id} className="border-b border-white/5 pb-2.5">
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                <span className="font-semibold text-white text-sm">{r.player_first} {r.player_last}</span>
                                                <span className="text-[11px] text-[#ff9d5c]">{r.age_group}</span>
                                                {(r.family_parents + r.family_siblings + r.family_other) > 0 && (
                                                    <span className="text-[11px] text-gray-400">+{r.family_parents + r.family_siblings + r.family_other} family</span>
                                                )}
                                                <label className="flex items-center gap-1.5 text-[11px] text-gray-300 ml-auto">
                                                    <input type="checkbox" checked={!!r.deposit_paid} disabled={savingId === r.id}
                                                        onChange={(e) => save(r.id, { deposit_paid: e.target.checked })} />
                                                    deposit
                                                </label>
                                                <select value={r.status} disabled={savingId === r.id}
                                                    onChange={(e) => save(r.id, { status: e.target.value })}
                                                    className="bg-[#0b1a33] border border-white/15 rounded px-2 py-1 text-xs text-white disabled:opacity-50">
                                                    {['new', 'confirmed', 'waitlist', 'withdrawn'].map((s) => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                            <div className="text-[11px] text-gray-500 mt-1">
                                                {[r.contact_name && `${r.contact_name}${r.contact_relation ? ` (${r.contact_relation})` : ''}`, r.contact_phone, r.contact_email].filter(Boolean).join(' · ')}
                                            </div>
                                            {r.notes && <div className="text-[11px] text-gray-400 mt-0.5 italic">"{r.notes}"</div>}
                                            <input
                                                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] text-gray-300 placeholder-gray-600 focus:outline-none focus:border-[#f36721]/60 mt-1.5"
                                                placeholder="Private organizer note…"
                                                defaultValue={r.admin_notes || ''}
                                                onBlur={(e) => { if (e.target.value !== (r.admin_notes || '')) save(r.id, { admin_notes: e.target.value }); }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <p className="text-[11px] text-gray-500 mt-3">Only Raptors staff see this panel. Deposit + status changes save instantly.</p>
            </div>
        </div>
    );
}

const Stat = ({ label, value }) => (
    <div className="bg-white/5 rounded-lg p-2.5 text-center">
        <div className="text-xl font-display font-bold text-[#ff9d5c]">{value ?? 0}</div>
        <div className="text-[9px] uppercase tracking-wider text-gray-400 mt-0.5">{label}</div>
    </div>
);
