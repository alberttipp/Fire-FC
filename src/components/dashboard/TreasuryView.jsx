import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet, Lock, Users, Landmark, Target } from 'lucide-react';

// PRIVATE club treasury — visible ONLY to the platform owner (Albert).
// Data: public.club_finances (RLS → is_platform_owner). Tracks income & expenses,
// Actual vs Budget (planned flag), per TEAM (U12/U13 leagues) and per player, plus
// one club-wide bank reconciliation (club_treasury_settings). The nav entry is
// owner-gated too.
const ORG = '8bd0dde0-c2c7-4bb0-9f1e-597bfa6d175c';
const U12 = '0920ff23-1294-4ff3-84c9-7c0f82687386';
const U13 = '545cc936-ad24-4068-bd55-feaca1640f45';
const TEAMS = [{ id: U12, label: 'U12 — International' }, { id: U13, label: 'U13 — Elite' }];
const SEASON_FEE = 200;
const teamShort = (id) => (id === U12 ? 'U12' : id === U13 ? 'U13' : '—');
const fmt = (n) => (n < 0 ? '-$' : '$') + Math.abs(Number(n || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nameOf = (r) => r?.players ? `${r.players.first_name} ${r.players.last_name || ''}`.trim() : null;

const TreasuryView = () => {
    const [rows, setRows] = useState([]);
    const [players, setPlayers] = useState([]);
    const [settings, setSettings] = useState({ opening_balance: 0, bank_balance: 0 });
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    // add-entry form
    const [kind, setKind] = useState('income');
    const [planned, setPlanned] = useState(false); // false = actual, true = budget
    const [amount, setAmount] = useState('');
    const [playerId, setPlayerId] = useState('');
    const [teamId, setTeamId] = useState('');
    const [label, setLabel] = useState('');
    const [when, setWhen] = useState(() => new Date().toISOString().slice(0, 10));
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true); setErr('');
        const [{ data, error }, { data: s }] = await Promise.all([
            supabase.from('club_finances').select('*, players(first_name,last_name)').order('occurred_on', { ascending: false }).order('created_at', { ascending: false }),
            supabase.from('club_treasury_settings').select('opening_balance,bank_balance').eq('org_id', ORG).maybeSingle(),
        ]);
        if (error) setErr(error.message); else setRows(data || []);
        if (s) setSettings({ opening_balance: Number(s.opening_balance) || 0, bank_balance: Number(s.bank_balance) || 0 });
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    useEffect(() => {
        let alive = true;
        (async () => {
            const { data } = await supabase.from('player_teams').select('player_id, team_id, fee, players(first_name,last_name)').in('team_id', [U12, U13]).eq('status', 'active');
            if (!alive) return;
            const map = {};
            (data || []).forEach((r) => {
                if (!r.players) return;
                map[r.player_id] = map[r.player_id] || { id: r.player_id, name: `${r.players.first_name} ${r.players.last_name || ''}`.trim(), teamIds: [], feeByTeam: {} };
                if (!map[r.player_id].teamIds.includes(r.team_id)) map[r.player_id].teamIds.push(r.team_id);
                map[r.player_id].feeByTeam[r.team_id] = r.fee;
            });
            setPlayers(Object.values(map).sort((a, b) => a.name.localeCompare(b.name)));
        })();
        return () => { alive = false; };
    }, []);

    const dualPlayers = useMemo(() => players.filter((p) => p.teamIds.length > 1), [players]);

    // sums: planned flag true=budget, false=actual
    const sum = (fn) => rows.reduce((s, r) => s + (fn(r) ? Number(r.amount) || 0 : 0), 0);
    const bucket = (teamId, kindV, isPlanned) => sum((r) => r.team_id === teamId && r.kind === kindV && !!r.planned === isPlanned);
    const actualIncome = useMemo(() => sum((r) => r.kind === 'income' && !r.planned), [rows]);
    const actualExpense = useMemo(() => sum((r) => r.kind === 'expense' && !r.planned), [rows]);

    const expectedCash = settings.opening_balance + actualIncome - actualExpense;
    const diff = settings.bank_balance - expectedCash;

    const paidByPlayerTeam = useMemo(() => {
        const m = {};
        for (const r of rows) {
            if (r.kind !== 'income' || r.planned || !r.player_id) continue; // actual income only
            const key = `${r.team_id || 'none'}|${r.player_id}`;
            m[key] = (m[key] || 0) + (Number(r.amount) || 0);
        }
        return m;
    }, [rows]);
    const rosterFor = (tid) => players.filter((p) => p.teamIds.includes(tid)).map((p) => {
        const raw = p.feeByTeam ? p.feeByTeam[tid] : null;
        const fee = raw == null ? SEASON_FEE : Number(raw);
        const paid = paidByPlayerTeam[`${tid}|${p.id}`] || 0;
        return { ...p, fee, paid, owes: Math.max(0, fee - paid), dual: p.teamIds.length > 1 };
    }).sort((a, b) => a.name.localeCompare(b.name));

    // Expected income still coming in = unpaid fees across both teams.
    const totalOwed = TEAMS.reduce((s, t) => s + rosterFor(t.id).reduce((a, r) => a + r.owes, 0), 0);

    const onPickPlayer = (pid) => {
        setPlayerId(pid);
        const p = players.find((x) => x.id === pid);
        if (p && p.teamIds.length === 1) setTeamId(p.teamIds[0]);
    };

    const add = async () => {
        const amt = parseFloat(amount);
        if (!amt || amt <= 0) { setErr('Enter a dollar amount.'); return; }
        setSaving(true); setErr('');
        const { error } = await supabase.from('club_finances').insert({
            kind, planned, amount: amt, player_id: playerId || null, team_id: teamId || null, label: label.trim() || null, occurred_on: when,
        });
        if (error) { setErr(error.message); } else { setAmount(''); setLabel(''); setPlayerId(''); setTeamId(''); await load(); }
        setSaving(false);
    };
    const del = async (id) => {
        const { error } = await supabase.from('club_finances').delete().eq('id', id);
        if (!error) setRows((prev) => prev.filter((r) => r.id !== id));
    };
    const saveSetting = async (patch) => {
        const next = { ...settings, ...patch };
        setSettings(next);
        await supabase.from('club_treasury_settings').upsert({ org_id: ORG, ...next, updated_at: new Date().toISOString() });
    };

    const inp = 'bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-brand-green focus:outline-none';
    const money = (v, on) => (
        <input type="number" inputMode="decimal" step="0.01" value={v === 0 ? '' : v} placeholder="0.00"
            onChange={(e) => on(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
            className="w-28 bg-gray-800 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm text-right tabular-nums focus:border-brand-green focus:outline-none" />
    );

    const BudgetActual = ({ id, label }) => {
        const ai = bucket(id, 'income', false), ae = bucket(id, 'expense', false);
        const bi = bucket(id, 'income', true), be = bucket(id, 'expense', true);
        const Row = ({ l, b, a, invert }) => {
            const v = a - b; // variance actual vs budget
            const good = invert ? v <= 0 : v >= 0;
            return (
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 py-1 text-sm items-center">
                    <span className="text-gray-300">{l}</span>
                    <span className="text-right tabular-nums text-gray-400 w-24">{fmt(b)}</span>
                    <span className="text-right tabular-nums text-white w-24">{fmt(a)}</span>
                    <span className={`text-right tabular-nums w-24 ${good ? 'text-brand-green' : 'text-red-400'}`}>{v >= 0 ? '+' : ''}{fmt(v)}</span>
                </div>
            );
        };
        return (
            <div className="glass-panel p-4 md:p-5">
                <h3 className="text-white font-bold mb-2">{label}</h3>
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 text-[10px] text-gray-500 uppercase tracking-widest border-b border-white/10 pb-1 mb-1">
                    <span></span><span className="text-right w-24">Budget</span><span className="text-right w-24">Actual</span><span className="text-right w-24">Variance</span>
                </div>
                <Row l="Income" b={bi} a={ai} />
                <Row l="Expenses" b={be} a={ae} invert />
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 pt-1 mt-1 border-t border-white/10 text-sm items-center font-bold">
                    <span className="text-white">Net</span>
                    <span className="text-right tabular-nums text-gray-400 w-24">{fmt(bi - be)}</span>
                    <span className={`text-right tabular-nums w-24 ${ai - ae >= 0 ? 'text-brand-green' : 'text-red-400'}`}>{fmt(ai - ae)}</span>
                    <span className="w-24" />
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
                    <h3 className="text-white font-bold">{label} — fees</h3>
                    <div className="text-[11px] text-gray-400">Collected <b className="text-brand-green">{fmt(collected)}</b> · Expected <b className="text-white">{fmt(expected)}</b> · Owed <b className="text-brand-gold">{fmt(outstanding)}</b></div>
                </div>
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-[10px] text-gray-500 uppercase tracking-widest border-b border-white/10 pb-1 mb-1">
                    <span>Player</span><span className="text-right">Paid</span><span className="text-right">Owes</span>
                </div>
                <div className="divide-y divide-white/5">
                    {roster.map((r) => (
                        <div key={r.id} className="grid grid-cols-[1fr_auto_auto] gap-x-4 py-1.5 text-sm items-center">
                            <span className="text-white truncate">{r.name}{r.dual && <span className="text-brand-gold text-[10px] font-bold ml-1">· 2 TEAMS</span>}{r.fee === 0 && <span className="text-gray-500 text-[10px] ml-1">· WAIVED</span>}</span>
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
                    <p className="text-gray-400 text-sm mt-0.5">Private — only you. Budget vs actual per team + bank reconciliation.</p>
                </div>
            </div>

            {/* Bank reconciliation (one club account) */}
            <div className="glass-panel p-4 md:p-5">
                <h2 className="text-white font-bold flex items-center gap-2 mb-3"><Landmark className="w-4 h-4 text-brand-green" /> Bank reconciliation</h2>
                <div className="space-y-1.5 text-sm max-w-md">
                    <div className="flex items-center justify-between"><span className="text-gray-400">Opening balance</span>{money(settings.opening_balance, (v) => saveSetting({ opening_balance: v }))}</div>
                    <div className="flex items-center justify-between"><span className="text-gray-400">+ Income (actual)</span><span className="text-brand-green tabular-nums pr-3">{fmt(actualIncome)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-gray-400">− Expenses (actual)</span><span className="text-red-400 tabular-nums pr-3">{fmt(actualExpense)}</span></div>
                    <div className="flex items-center justify-between border-t border-white/10 pt-1.5"><span className="text-white font-bold">= Expected cash</span><span className="text-white font-bold tabular-nums pr-3">{fmt(expectedCash)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-gray-400">Actual bank balance</span>{money(settings.bank_balance, (v) => saveSetting({ bank_balance: v }))}</div>
                    <div className={`flex items-center justify-between rounded-lg px-3 py-2 mt-1 ${Math.abs(diff) < 0.005 ? 'bg-brand-green/10 border border-brand-green/30' : 'bg-red-400/10 border border-red-400/30'}`}>
                        <span className={`font-bold ${Math.abs(diff) < 0.005 ? 'text-brand-green' : 'text-red-400'}`}>{Math.abs(diff) < 0.005 ? '✓ Reconciled' : 'Difference'}</span>
                        <span className={`font-bold tabular-nums ${Math.abs(diff) < 0.005 ? 'text-brand-green' : 'text-red-400'}`}>{fmt(diff)}</span>
                    </div>
                    {Math.abs(diff) >= 0.005 && <p className="text-gray-500 text-[11px]">A non-zero difference means money in the bank isn't all logged here (or vice-versa) — add the missing entries.</p>}
                    <div className="flex items-center justify-between pt-2 mt-1 border-t border-white/10"><span className="text-gray-400">+ Expected income (fees not yet paid)</span><span className="text-brand-gold tabular-nums pr-3">{fmt(totalOwed)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-white font-bold">= Projected cash once all fees are in</span><span className="text-white font-bold tabular-nums pr-3">{fmt(expectedCash + totalOwed)}</span></div>
                </div>
            </div>

            {/* Budget vs Actual, per team */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {TEAMS.map((t) => <BudgetActual key={t.id} id={t.id} label={t.label} />)}
            </div>

            {/* Dual-rostered callout */}
            {dualPlayers.length > 0 && (
                <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-4">
                    <div className="flex items-center gap-2 text-brand-gold font-bold text-sm"><Users className="w-4 h-4" /> Playing on 2 teams (two league fees)</div>
                    <p className="text-gray-300 text-sm mt-1">{dualPlayers.map((p) => p.name).join(', ')}</p>
                    <p className="text-gray-500 text-xs mt-1">Each team charges its own fee (set per membership). Adjust a dual kid's 2nd-team fee once you decide what to charge.</p>
                </div>
            )}

            {/* Per-team fees owed */}
            <div className="space-y-3">
                {TEAMS.map((t) => <TeamRoster key={t.id} id={t.id} label={t.label} />)}
            </div>

            {/* Add entry */}
            <div className="glass-panel p-4 md:p-5 space-y-3">
                <h2 className="text-white font-bold flex items-center gap-2"><Plus className="w-4 h-4 text-brand-green" /> Add an entry</h2>
                <div className="flex flex-wrap gap-2">
                    <div className="flex rounded-lg overflow-hidden border border-white/10">
                        <button onClick={() => setKind('income')} className={`px-3 py-1.5 text-sm font-bold ${kind === 'income' ? 'bg-brand-green text-brand-dark' : 'text-gray-400'}`}>Income</button>
                        <button onClick={() => setKind('expense')} className={`px-3 py-1.5 text-sm font-bold ${kind === 'expense' ? 'bg-red-400 text-brand-dark' : 'text-gray-400'}`}>Expense</button>
                    </div>
                    <div className="flex rounded-lg overflow-hidden border border-white/10">
                        <button onClick={() => setPlanned(false)} className={`px-3 py-1.5 text-sm font-bold ${!planned ? 'bg-white text-brand-dark' : 'text-gray-400'}`}>Actual</button>
                        <button onClick={() => setPlanned(true)} className={`px-3 py-1.5 text-sm font-bold flex items-center gap-1 ${planned ? 'bg-brand-gold text-brand-dark' : 'text-gray-400'}`}><Target className="w-3 h-3" /> Budget</button>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <input type="number" inputMode="decimal" min="0" step="0.01" placeholder="$ amount" value={amount} onChange={(e) => setAmount(e.target.value)} className={inp} />
                    <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={inp}>
                        <option value="" className="bg-gray-800">— team —</option>
                        {TEAMS.map((t) => <option key={t.id} value={t.id} className="bg-gray-800">{t.label}</option>)}
                    </select>
                    <select value={playerId} onChange={(e) => onPickPlayer(e.target.value)} className={inp}>
                        <option value="" className="bg-gray-800">— player (optional) —</option>
                        {players.map((p) => <option key={p.id} value={p.id} className="bg-gray-800">{p.name}{p.teamIds.length > 1 ? ' (both)' : ''}</option>)}
                    </select>
                    <input type="text" placeholder="note (league fee, uniforms…)" value={label} onChange={(e) => setLabel(e.target.value)} className={`${inp} col-span-2 md:col-span-1`} />
                    <input type="date" value={when} onChange={(e) => setWhen(e.target.value)} className={inp} />
                </div>
                <div className="flex items-center justify-between gap-2">
                    {err ? <p className="text-red-400 text-xs">{err}</p> : <span />}
                    <button onClick={add} disabled={saving} className="px-4 py-2 rounded-lg bg-brand-green text-brand-dark font-bold text-sm uppercase tracking-wider hover:bg-white disabled:opacity-50">{saving ? 'Saving…' : 'Add'}</button>
                </div>
            </div>

            {/* Ledger */}
            <div className="glass-panel p-4 md:p-5">
                <h2 className="text-white font-bold mb-3">All entries</h2>
                {loading ? <p className="text-gray-500 text-sm">Loading…</p>
                    : rows.length === 0 ? <p className="text-gray-500 text-sm">No entries yet.</p>
                        : (
                            <div className="divide-y divide-white/5">
                                {rows.map((r) => (
                                    <div key={r.id} className="flex items-center gap-3 py-2.5">
                                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border shrink-0 ${r.kind === 'income' ? 'bg-brand-green/10 border-brand-green/30 text-brand-green' : 'bg-red-400/10 border-red-400/30 text-red-400'}`}>{r.kind === 'income' ? 'In' : 'Out'}</span>
                                        {r.planned && <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-brand-gold/10 text-brand-gold shrink-0">Budget</span>}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-white text-sm truncate">{nameOf(r) || r.label || '—'}</div>
                                            <div className="text-gray-500 text-[11px] truncate">{r.team_id ? teamShort(r.team_id) + ' · ' : ''}{nameOf(r) && r.label ? r.label + ' · ' : ''}{new Date(r.occurred_on + 'T00:00:00').toLocaleDateString()}</div>
                                        </div>
                                        <span className={`font-bold tabular-nums ${r.kind === 'income' ? 'text-brand-green' : 'text-red-400'}`}>{r.kind === 'expense' ? '-' : ''}{fmt(r.amount)}</span>
                                        <button onClick={() => del(r.id)} className="text-gray-600 hover:text-red-400 shrink-0" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                ))}
                            </div>
                        )}
            </div>
        </div>
    );
};

export default TreasuryView;
