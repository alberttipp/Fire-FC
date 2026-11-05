import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet, CalendarClock, Lock, Users } from 'lucide-react';

// PRIVATE club money ledger — visible ONLY to the platform owner (Albert).
// Data lives in public.club_finances (RLS restricts all access to
// is_platform_owner()); the nav entry is also owner-gated. Tracks income,
// expenses, and expected future costs, per-kid, per-TEAM, and in total — so
// each league's fees can be reconciled separately and dual-rostered kids
// (on two teams/leagues) are called out.
const U12 = '0920ff23-1294-4ff3-84c9-7c0f82687386';
const U13 = '545cc936-ad24-4068-bd55-feaca1640f45';
const TEAMS = [{ id: U12, label: 'U12 — International' }, { id: U13, label: 'U13 — Elite' }];
const SEASON_FEE = 200; // flat per-player season fee (same for everyone right now); players.season_fee overrides (0 = waived)
const teamShort = (id) => (id === U12 ? 'U12' : id === U13 ? 'U13' : '—');
const fmt = (n) => '$' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nameOf = (r) => r?.players ? `${r.players.first_name} ${r.players.last_name || ''}`.trim() : null;

const KINDS = [
    { v: 'income', label: 'Income', tint: 'text-brand-green', bg: 'bg-brand-green/10 border-brand-green/30' },
    { v: 'expense', label: 'Expense', tint: 'text-red-400', bg: 'bg-red-400/10 border-red-400/30' },
    { v: 'expected', label: 'Expected (future)', tint: 'text-brand-gold', bg: 'bg-brand-gold/10 border-brand-gold/30' },
];
const emptyTotals = () => ({ income: 0, expense: 0, expected: 0 });

const TreasuryView = () => {
    const [rows, setRows] = useState([]);
    const [players, setPlayers] = useState([]);   // {id,name,teamIds:[]}
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    const [kind, setKind] = useState('income');
    const [amount, setAmount] = useState('');
    const [playerId, setPlayerId] = useState('');
    const [teamId, setTeamId] = useState('');
    const [label, setLabel] = useState('');
    const [when, setWhen] = useState(() => new Date().toISOString().slice(0, 10));
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true); setErr('');
        const { data, error } = await supabase
            .from('club_finances')
            .select('*, players(first_name,last_name)')
            .order('occurred_on', { ascending: false })
            .order('created_at', { ascending: false });
        if (error) setErr(error.message); else setRows(data || []);
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    useEffect(() => {
        let alive = true;
        (async () => {
            const { data } = await supabase
                .from('player_teams')
                .select('player_id, team_id, players(first_name,last_name,season_fee)')
                .in('team_id', [U12, U13])
                .eq('status', 'active');
            if (!alive) return;
            const map = {};
            (data || []).forEach((r) => {
                if (!r.players) return;
                map[r.player_id] = map[r.player_id] || { id: r.player_id, name: `${r.players.first_name} ${r.players.last_name || ''}`.trim(), teamIds: [], fee: r.players.season_fee };
                if (!map[r.player_id].teamIds.includes(r.team_id)) map[r.player_id].teamIds.push(r.team_id);
            });
            setPlayers(Object.values(map).sort((a, b) => a.name.localeCompare(b.name)));
        })();
        return () => { alive = false; };
    }, []);

    const dualPlayers = useMemo(() => players.filter((p) => p.teamIds.length > 1), [players]);

    // Income collected per (team, player) — drives the per-team Paid/Owes roster.
    const paidByPlayerTeam = useMemo(() => {
        const m = {};
        for (const r of rows) {
            if (r.kind !== 'income' || !r.player_id) continue;
            const key = `${r.team_id || 'none'}|${r.player_id}`;
            m[key] = (m[key] || 0) + (Number(r.amount) || 0);
        }
        return m;
    }, [rows]);
    const rosterFor = (tid) => players.filter((p) => p.teamIds.includes(tid)).map((p) => {
        const fee = p.fee == null ? SEASON_FEE : Number(p.fee);
        const paid = paidByPlayerTeam[`${tid}|${p.id}`] || 0;
        return { ...p, fee, paid, owes: Math.max(0, fee - paid), dual: p.teamIds.length > 1 };
    }).sort((a, b) => a.name.localeCompare(b.name));

    // When a single-team player is picked, auto-tag the entry to their team.
    const onPickPlayer = (pid) => {
        setPlayerId(pid);
        const p = players.find((x) => x.id === pid);
        if (p && p.teamIds.length === 1) setTeamId(p.teamIds[0]);
    };

    const totalsFor = (filterFn) => {
        const t = emptyTotals();
        for (const r of rows) { if (!filterFn(r)) continue; const a = Number(r.amount) || 0; if (r.kind === 'income') t.income += a; else if (r.kind === 'expense') t.expense += a; else t.expected += a; }
        return t;
    };
    const overall = useMemo(() => totalsFor(() => true), [rows]);
    const byTeam = useMemo(() => ({ [U12]: totalsFor((r) => r.team_id === U12), [U13]: totalsFor((r) => r.team_id === U13) }), [rows]);

    const byPlayer = useMemo(() => {
        const m = {};
        for (const r of rows) {
            if (r.kind !== 'income') continue;
            const key = r.player_id || '_unassigned';
            m[key] = m[key] || { name: nameOf(r) || 'Unassigned', team: r.team_id, total: 0 };
            m[key].total += Number(r.amount) || 0;
        }
        return Object.values(m).sort((a, b) => b.total - a.total);
    }, [rows]);

    const add = async () => {
        const amt = parseFloat(amount);
        if (!amt || amt <= 0) { setErr('Enter a dollar amount.'); return; }
        setSaving(true); setErr('');
        const { error } = await supabase.from('club_finances').insert({
            kind, amount: amt, player_id: playerId || null, team_id: teamId || null, label: label.trim() || null, occurred_on: when,
        });
        if (error) { setErr(error.message); } else { setAmount(''); setLabel(''); setPlayerId(''); setTeamId(''); await load(); }
        setSaving(false);
    };
    const del = async (id) => {
        const { error } = await supabase.from('club_finances').delete().eq('id', id);
        if (!error) setRows((prev) => prev.filter((r) => r.id !== id));
    };

    const inp = 'bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-brand-green focus:outline-none';

    const TeamCard = ({ id, label }) => {
        const t = byTeam[id];
        return (
            <div className="glass-panel p-4">
                <div className="text-brand-gold text-[11px] uppercase tracking-widest font-bold">{label}</div>
                <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-gray-400">Income</span><span className="text-brand-green font-bold tabular-nums">{fmt(t.income)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Expenses</span><span className="text-red-400 font-bold tabular-nums">{fmt(t.expense)}</span></div>
                    <div className="flex justify-between border-t border-white/10 pt-1"><span className="text-gray-300">Net</span><span className={`font-bold tabular-nums ${t.income - t.expense >= 0 ? 'text-brand-green' : 'text-red-400'}`}>{fmt(t.income - t.expense)}</span></div>
                    {t.expected > 0 && <div className="flex justify-between"><span className="text-gray-400">Expected</span><span className="text-brand-gold font-bold tabular-nums">{fmt(t.expected)}</span></div>}
                </div>
            </div>
        );
    };

    const TeamRoster = ({ id, label }) => {
        const roster = rosterFor(id);
        const collected = roster.reduce((s, r) => s + r.paid, 0);
        const expected = roster.reduce((s, r) => s + r.fee, 0);
        const outstanding = roster.reduce((s, r) => s + r.owes, 0);
        return (
            <div className="glass-panel p-4 md:p-5">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <h2 className="text-white font-bold">{label}</h2>
                    <div className="text-[11px] text-gray-400">Collected <b className="text-brand-green">{fmt(collected)}</b> · Expected <b className="text-white">{fmt(expected)}</b> · Still owed <b className="text-brand-gold">{fmt(outstanding)}</b></div>
                </div>
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-[10px] text-gray-500 uppercase tracking-widest border-b border-white/10 pb-1 mb-1">
                    <span>Player</span><span className="text-right">Paid</span><span className="text-right">Owes</span>
                </div>
                <div className="divide-y divide-white/5">
                    {roster.map((r) => (
                        <div key={r.id} className="grid grid-cols-[1fr_auto_auto] gap-x-4 py-1.5 text-sm items-center">
                            <span className="text-white truncate">
                                {r.name}
                                {r.dual && <span className="text-brand-gold text-[10px] font-bold ml-1">· 2 TEAMS</span>}
                                {r.fee === 0 && <span className="text-gray-500 text-[10px] ml-1">· WAIVED</span>}
                            </span>
                            <span className="text-right tabular-nums text-brand-green">{r.paid > 0 ? fmt(r.paid) : '—'}</span>
                            <span className={`text-right tabular-nums font-bold ${r.owes > 0 ? 'text-brand-gold' : 'text-gray-600'}`}>{r.owes > 0 ? fmt(r.owes) : '✓'}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-4xl mx-auto px-4 md:px-6 pb-24 pt-6 space-y-6">
            <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-brand-gold" />
                <div>
                    <h1 className="text-3xl text-white font-display font-bold uppercase tracking-wider">Treasury</h1>
                    <p className="text-gray-400 text-sm mt-0.5">Private money tracker — visible only to you. Separated by team.</p>
                </div>
            </div>

            {/* Overall tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="glass-panel p-4"><div className="flex items-center gap-1.5 text-brand-green text-[11px] uppercase tracking-widest font-bold"><TrendingUp className="w-3.5 h-3.5" /> Income</div><div className="text-white text-2xl font-display font-bold mt-1">{fmt(overall.income)}</div></div>
                <div className="glass-panel p-4"><div className="flex items-center gap-1.5 text-red-400 text-[11px] uppercase tracking-widest font-bold"><TrendingDown className="w-3.5 h-3.5" /> Expenses</div><div className="text-white text-2xl font-display font-bold mt-1">{fmt(overall.expense)}</div></div>
                <div className="glass-panel p-4"><div className="flex items-center gap-1.5 text-white text-[11px] uppercase tracking-widest font-bold"><Wallet className="w-3.5 h-3.5" /> Net</div><div className={`text-2xl font-display font-bold mt-1 ${overall.income - overall.expense >= 0 ? 'text-brand-green' : 'text-red-400'}`}>{fmt(overall.income - overall.expense)}</div></div>
                <div className="glass-panel p-4"><div className="flex items-center gap-1.5 text-brand-gold text-[11px] uppercase tracking-widest font-bold"><CalendarClock className="w-3.5 h-3.5" /> Expected</div><div className="text-white text-2xl font-display font-bold mt-1">{fmt(overall.expected)}</div></div>
            </div>

            {/* Per team */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TEAMS.map((t) => <TeamCard key={t.id} id={t.id} label={t.label} />)}
            </div>

            {/* Dual-rostered callout */}
            {dualPlayers.length > 0 && (
                <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-4">
                    <div className="flex items-center gap-2 text-brand-gold font-bold text-sm"><Users className="w-4 h-4" /> Playing on 2 teams (two league fees)</div>
                    <p className="text-gray-300 text-sm mt-1">{dualPlayers.map((p) => p.name).join(', ')}</p>
                    <p className="text-gray-500 text-xs mt-1">Their deposit is tagged to one team above. Decide each one's total and add an "Expected" (what they still owe) or an extra Income entry for the 2nd league so both teams reconcile.</p>
                </div>
            )}

            {/* Per-team Paid / Owes roster */}
            <div className="space-y-3">
                {TEAMS.map((t) => <TeamRoster key={t.id} id={t.id} label={t.label} />)}
            </div>

            {/* Add entry */}
            <div className="glass-panel p-4 md:p-5 space-y-3">
                <h2 className="text-white font-bold flex items-center gap-2"><Plus className="w-4 h-4 text-brand-green" /> Add an entry</h2>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                    <select value={kind} onChange={(e) => setKind(e.target.value)} className={inp}>
                        {KINDS.map((k) => <option key={k.v} value={k.v} className="bg-gray-800">{k.label}</option>)}
                    </select>
                    <input type="number" inputMode="decimal" min="0" step="0.01" placeholder="$ amount" value={amount} onChange={(e) => setAmount(e.target.value)} className={inp} />
                    <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={inp}>
                        <option value="" className="bg-gray-800">— team —</option>
                        {TEAMS.map((t) => <option key={t.id} value={t.id} className="bg-gray-800">{t.label}</option>)}
                    </select>
                    <select value={playerId} onChange={(e) => onPickPlayer(e.target.value)} className={inp}>
                        <option value="" className="bg-gray-800">— player (optional) —</option>
                        {players.map((p) => <option key={p.id} value={p.id} className="bg-gray-800">{p.name}{p.teamIds.length > 1 ? ' (both)' : ''}</option>)}
                    </select>
                    <input type="text" placeholder="note (uniforms, field, league fee…)" value={label} onChange={(e) => setLabel(e.target.value)} className={`${inp} col-span-2 md:col-span-1`} />
                    <input type="date" value={when} onChange={(e) => setWhen(e.target.value)} className={inp} />
                </div>
                <div className="flex items-center justify-between gap-2">
                    {err ? <p className="text-red-400 text-xs">{err}</p> : <span />}
                    <button onClick={add} disabled={saving} className="px-4 py-2 rounded-lg bg-brand-green text-brand-dark font-bold text-sm uppercase tracking-wider hover:bg-white disabled:opacity-50">{saving ? 'Saving…' : 'Add'}</button>
                </div>
            </div>

            {/* By player */}
            {byPlayer.length > 0 && (
                <div className="glass-panel p-4 md:p-5">
                    <h2 className="text-white font-bold mb-3">Paid by player</h2>
                    <div className="divide-y divide-white/5">
                        {byPlayer.map((p, i) => (
                            <div key={i} className="flex items-center justify-between py-2 text-sm">
                                <span className="text-white">{p.name} <span className="text-gray-600 text-xs">· {teamShort(p.team)}</span></span>
                                <span className="text-brand-green font-bold tabular-nums">{fmt(p.total)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Ledger */}
            <div className="glass-panel p-4 md:p-5">
                <h2 className="text-white font-bold mb-3">All entries</h2>
                {loading ? <p className="text-gray-500 text-sm">Loading…</p>
                    : rows.length === 0 ? <p className="text-gray-500 text-sm">No entries yet — add income, expenses, or expected costs above.</p>
                        : (
                            <div className="divide-y divide-white/5">
                                {rows.map((r) => {
                                    const km = KINDS.find((k) => k.v === r.kind) || KINDS[0];
                                    return (
                                        <div key={r.id} className="flex items-center gap-3 py-2.5">
                                            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${km.bg} ${km.tint} shrink-0`}>{km.label.split(' ')[0]}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white text-sm truncate">{nameOf(r) || r.label || '—'}</div>
                                                <div className="text-gray-500 text-[11px] truncate">{r.team_id ? teamShort(r.team_id) + ' · ' : ''}{nameOf(r) && r.label ? r.label + ' · ' : ''}{new Date(r.occurred_on + 'T00:00:00').toLocaleDateString()}</div>
                                            </div>
                                            <span className={`font-bold tabular-nums ${km.tint}`}>{r.kind === 'expense' ? '-' : ''}{fmt(r.amount)}</span>
                                            <button onClick={() => del(r.id)} className="text-gray-600 hover:text-red-400 shrink-0" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
            </div>
        </div>
    );
};

export default TreasuryView;
