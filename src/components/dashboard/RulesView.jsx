import React, { useEffect, useState } from 'react';
import { FileText, Download, ExternalLink, Activity } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import EcnlU11Rules from './EcnlU11Rules';
import EcnlU18Rules from './EcnlU18Rules';
import FutsalRules from './FutsalRules';
import { formationSizeForAgeGroup } from '../coach-hq/lineup/formations';

// League-rules viewer. Team-aware: ECNL teams get native rules (9v9 Pre-ECNL for
// U11/U12, 11v11 ECNL for U13+); other teams get their bundled league PDF.
const DOCS = [
    {
        id: 'indoor-saturday-packet-2026-27',
        title: '2026-27 Indoor League — Rules, Waiver & Packet',
        subtitle: 'International Soccer League · Saturday indoor',
        path: '/docs/2026-27-indoor-saturday-packet.pdf',
    },
    {
        id: 'international-league-rockford',
        title: 'International Soccer League — Rockford',
        subtitle: 'League info & details',
        path: '/docs/international-soccer-league-rockford.pdf',
    },
];

const RulesView = () => {
    const { profile } = useAuth();
    const [team, setTeam] = useState(null); // null = loading
    // Staff-only waiver roster (list_waiver_signatures is staff-gated server-side;
    // parents get an error which we swallow, so the panel simply never shows for them).
    const [waivers, setWaivers] = useState(null);
    const [activity, setActivity] = useState(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let active = true;
        if (profile?.team_id) {
            supabase.from('teams').select('name, age_group, programs(league_name), organizations(slug, name)').eq('id', profile.team_id).maybeSingle()
                .then(({ data }) => { if (active) setTeam(data || {}); });
        } else {
            setTeam({});
        }
        // Waiver status across EVERY team the staff manages — works for managers
        // who aren't pinned to a single team (that's why the panel was blank).
        supabase.rpc('list_staff_waivers')
            .then(({ data, error }) => { if (active && !error && Array.isArray(data)) setWaivers(data); });
        // Parent engagement (who clicked Venmo / opened the waiver / set a jersey) —
        // staff-gated server-side, same scope as the waiver list.
        supabase.rpc('winter_activity_overview')
            .then(({ data, error }) => { if (active && !error && Array.isArray(data)) setActivity(data); });
        return () => { active = false; };
    }, [profile?.team_id]);

    const copyWaiverList = async () => {
        if (!waivers?.length) return;
        const byTeam = waivers.reduce((acc, w) => { (acc[w.team_name] = acc[w.team_name] || []).push(w); return acc; }, {});
        const lines = [];
        Object.entries(byTeam).forEach(([tname, rows]) => {
            const signed = rows.filter(r => r.signed);
            lines.push(`${tname} — Waiver status (${signed.length}/${rows.length} signed)`, '', 'SIGNED:',
                ...signed.map(r => `  ${r.player_name} — ${r.signer_name} (${new Date(r.signed_at).toLocaleDateString()})`),
                '', 'NOT SIGNED:', ...rows.filter(r => !r.signed).map(r => `  ${r.player_name}`), '');
        });
        try { await navigator.clipboard.writeText(lines.join('\n')); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (_) { /* ignore */ }
    };

    // Download a signed-waiver PDF (waiver pages + signature certificate) for one player.
    const downloadWaiverPdf = async (playerId, playerName) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/waiver-pdf`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session?.access_token}`, 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_id: playerId }),
            });
            if (!res.ok) return;
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `waiver-${(playerName || 'player').replace(/[^a-z0-9]+/gi, '-')}.pdf`;
            document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
        } catch (_) { /* ignore */ }
    };

    if (team === null) return null; // brief loading; avoids flashing the wrong ruleset
    // Futsal clubs get the FIFA futsal laws. Checked BEFORE the ECNL branch —
    // that one catch-alls age_group U11, which would misroute a U11 futsal team.
    const orgText = `${team.organizations?.slug || ''} ${team.organizations?.name || ''}`;
    if (/futsal/i.test(orgText) || /futsal/i.test(team.name || '')) {
        return <FutsalRules />;
    }
    // ECNL teams get native rules; pick 9v9 (U11/U12) vs 11v11 (U13+) by age.
    const leagueName = team.programs?.league_name || '';
    const isEcnl = /ecnl/i.test(leagueName) || /ecnl/i.test(team.name || '') || team.age_group === 'U11';
    if (isEcnl) {
        return formationSizeForAgeGroup(team.age_group) === 9 ? <EcnlU11Rules /> : <EcnlU18Rules />;
    }

    return (
        <div className="max-w-5xl mx-auto px-4 md:px-6 pb-24 pt-6 space-y-6">
            <div>
                <h1 className="text-3xl text-white font-display font-bold uppercase tracking-wider">Rules & Docs</h1>
                <p className="text-gray-400 text-sm mt-1">Official league documents — open in the viewer below or download a copy. Families sign the waiver from their player checklist.</p>
            </div>

            {waivers && waivers.length > 0 && (
                <div className="glass-panel p-4 md:p-6 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <h2 className="text-white font-bold text-lg">Waiver status</h2>
                            <p className="text-gray-500 text-xs uppercase tracking-widest mt-0.5">{waivers.filter(w => w.signed).length} of {waivers.length} signed · tap PDF to download for the league</p>
                        </div>
                        <button onClick={copyWaiverList} className="px-3 py-2 bg-brand-green text-brand-dark rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white">
                            {copied ? '✓ Copied' : 'Copy list for league'}
                        </button>
                    </div>
                    {Object.entries(waivers.reduce((acc, w) => { (acc[w.team_name] = acc[w.team_name] || []).push(w); return acc; }, {})).map(([tname, rows]) => (
                        <div key={tname}>
                            <p className="text-brand-gold text-xs font-bold uppercase tracking-widest mb-1">{tname} · {rows.filter(r => r.signed).length}/{rows.length} signed</p>
                            <div className="divide-y divide-white/5">
                                {rows.map(w => (
                                    <div key={w.player_id} className="flex items-center justify-between py-1.5 text-sm gap-2">
                                        <span className="text-white truncate flex-1">{w.player_name}</span>
                                        {w.signed ? (
                                            <>
                                                <span className="text-brand-green text-xs whitespace-nowrap hidden sm:inline">✓ {w.signer_name} · {new Date(w.signed_at).toLocaleDateString()}</span>
                                                <button onClick={() => downloadWaiverPdf(w.player_id, w.player_name)} className="shrink-0 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-wider text-brand-green hover:bg-white/10 flex items-center gap-1">
                                                    <Download className="w-3 h-3" /> PDF
                                                </button>
                                            </>
                                        ) : <span className="text-gray-500 text-xs whitespace-nowrap">not signed</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activity && activity.length > 0 && (
                <div className="glass-panel p-4 md:p-6 space-y-4">
                    <div>
                        <h2 className="text-white font-bold text-lg flex items-center gap-2"><Activity className="w-5 h-5 text-brand-gold" /> Parent activity</h2>
                        <p className="text-gray-500 text-xs uppercase tracking-widest mt-0.5">
                            {activity.filter(a => a.deposit_paid).length}/{activity.length} paid · {activity.filter(a => a.waiver_signed).length} signed · {activity.filter(a => a.jersey_set).length} picked a jersey
                        </p>
                    </div>
                    {Object.entries(activity.reduce((acc, a) => { (acc[a.team_name] = acc[a.team_name] || []).push(a); return acc; }, {})).map(([tname, rows]) => (
                        <div key={tname}>
                            <p className="text-brand-gold text-xs font-bold uppercase tracking-widest mb-1">{tname}</p>
                            <div className="divide-y divide-white/5">
                                {rows.map(a => {
                                    const chip = (on, label) => (
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${on ? 'bg-brand-green/15 text-brand-green' : 'bg-white/5 text-gray-500'}`}>{on ? '✓ ' : ''}{label}</span>
                                    );
                                    return (
                                        <div key={a.player_id} className="py-2 flex items-center justify-between gap-2 flex-wrap">
                                            <div className="min-w-0">
                                                <span className="text-white text-sm block truncate">{a.player_name}</span>
                                                <span className="text-gray-500 text-[11px]">
                                                    {a.deposit_clicks > 0 && `${a.deposit_clicks} Venmo tap${a.deposit_clicks > 1 ? 's' : ''} · `}
                                                    {a.waiver_opens > 0 && `${a.waiver_opens} waiver open${a.waiver_opens > 1 ? 's' : ''} · `}
                                                    {a.last_active ? `last active ${new Date(a.last_active).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'numeric', day: 'numeric' })}` : 'not in app yet'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {chip(a.deposit_paid, 'Paid')}
                                                {chip(a.waiver_signed, 'Waiver')}
                                                {chip(a.jersey_set, 'Jersey')}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {DOCS.map(doc => (
                <div key={doc.id} className="glass-panel p-4 md:p-6 space-y-4">
                    <div className="flex items-start gap-4 flex-wrap">
                        <div className="w-12 h-12 rounded-lg bg-brand-green/10 border border-brand-green/30 flex items-center justify-center shrink-0">
                            <FileText className="w-6 h-6 text-brand-green" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-white font-bold text-lg leading-tight">{doc.title}</h2>
                            <p className="text-gray-500 text-xs uppercase tracking-widest mt-0.5">{doc.subtitle}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <a
                                href={doc.path}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold uppercase tracking-wider text-gray-300 hover:bg-white/10 flex items-center gap-1.5"
                            >
                                <ExternalLink className="w-3.5 h-3.5" /> Open
                            </a>
                            <a
                                href={doc.path}
                                download
                                className="px-3 py-2 bg-brand-green text-brand-dark rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-white flex items-center gap-1.5"
                            >
                                <Download className="w-3.5 h-3.5" /> Download
                            </a>
                        </div>
                    </div>

                    {/* Inline viewer. Mobile browsers fall back to a download
                        prompt rather than rendering — that's expected. */}
                    <div className="rounded-lg overflow-hidden border border-white/10 bg-black/30 hidden md:block">
                        <iframe
                            src={doc.path}
                            title={doc.title}
                            className="w-full h-[75vh] bg-white"
                        />
                    </div>
                    <p className="text-xs text-gray-500 md:hidden">
                        On mobile, tap <span className="text-brand-green font-bold">Open</span> to view in your browser or <span className="text-brand-green font-bold">Download</span> to save it to your phone.
                    </p>
                </div>
            ))}
        </div>
    );
};

export default RulesView;
