import React from 'react';
import { ShieldCheck, AlertTriangle, ExternalLink } from 'lucide-react';

// U11 Pre-ECNL (ECNL Regional League) rules, rendered natively. Sourced from US
// Soccer / US Youth Soccer Player Development Initiatives (9v9 playing laws), the
// ECNL Competition Rules (roster/discipline), and Regional League game-day
// procedures. Two items legitimately vary by conference (half length, subs) and
// are flagged "confirm with your league" rather than stated as fixed.
const QUICK = [
    ['Format', '9v9 (8 field players + 1 goalkeeper)'],
    ['Ball', 'Size 4'],
    ['Field', '70–80 yds long × 45–55 yds wide'],
    ['Goals', 'No larger than 7 ft × 21 ft'],
    ['Game length', 'Two halves + 10-min halftime. 30-min halves is the national standard; many ECNL Regional Leagues play 35s — confirm your conference.'],
    ['Heading', 'NOT allowed at U11 — deliberate header = indirect free kick to the other team. (Legal at U12.)'],
    ['Offside', 'Yes — full-field offside applies at 9v9.'],
    ['Build-out line', 'Does NOT apply at U11 (it is a 7v7 / U9–U10 rule).'],
    ['Goalkeeper punting', 'Allowed at U11.'],
    ['Substitutions', 'Regional League U11 is typically unlimited with re-entry — confirm your conference.'],
    ['Game-day roster', 'Max 18 players dressed per game'],
    ['Club roster', 'Max 30 players rostered'],
];

const SECTIONS = [
    {
        h: 'The "real soccer" jump from U10',
        body: 'At U11 several familiar "little-kid" rules stop: offside is now enforced everywhere, there is no build-out line, and the keeper may punt. The ball moves up the field faster than at 7v7. The one big safety exception that remains: no heading.',
    },
    {
        h: 'No heading (safety rule)',
        body: 'Deliberate heading is not allowed in U11 games. The penalty is an indirect free kick to the opponent from the spot (taken on the goal-area line if it happened inside the goal area). Heading becomes legal at U12.',
    },
    {
        h: 'Substitutions',
        body: 'The base national ECNL rule is stricter (limited subs, no re-entry in the same half), but ECNL Regional Leagues commonly grant unlimited substitutions with re-entry at U11. Subs happen at stoppages (throw-ins, goal kicks, goals, halftime, injuries) with referee approval; players enter at midfield. A player pulled for a suspected head injury can be temporarily replaced without it counting against limits.',
    },
    {
        h: 'Roster & game day',
        body: 'Up to 30 players on the club roster, max 18 dressed per match. All players must be registered in the league system and appear on the digital game-day roster. Coaches must carry a valid US Club Soccer card; max 3 carded coaches in the technical area.',
    },
    {
        h: 'Conduct & uniforms',
        body: 'Home team wears light, away wears dark; on a color clash the home team changes. Home team provides at least two game balls. Shin guards required. Red cards carry a suspension into the next game at that level (players and coaches).',
    },
];

const SOURCES = [
    ['US Soccer 9v9 Player Development Initiative', 'https://cdn2.sportngin.com/attachments/document/0138/4139/Player_Dvelopment_Initiative_FINAL_9v9.pdf'],
    ['US Youth Soccer — Player Development Initiatives', 'https://www.usyouthsoccer.org/wp-content/uploads/sites/160/2023/09/Player-Development-Initiatives-2017.pdf'],
    ['ECNL 2024-25 Competition Rules', 'https://texasclubsoccer.com/wp-content/uploads/2024/09/2024-2025-ECNL-COMPETITION-RULES.pdf'],
    ['US Club Soccer — Head Injuries / heading policy', 'https://usclubsoccer.org/headinjuries/'],
];

export default function EcnlU11Rules() {
    return (
        <div className="max-w-5xl mx-auto px-4 md:px-6 pb-24 pt-6 space-y-6">
            <div>
                <h1 className="text-3xl text-white font-display font-bold uppercase tracking-wider">U11 Pre-ECNL Rules</h1>
                <p className="text-gray-400 text-sm mt-1">Boys 9v9 · the essentials for coaches &amp; families.</p>
            </div>

            {/* Quick reference */}
            <div className="glass-panel p-4 md:p-6">
                <div className="flex items-center gap-2 text-brand-green text-sm font-display uppercase tracking-wider mb-3">
                    <ShieldCheck className="w-4 h-4" /> Quick reference
                </div>
                <div className="divide-y divide-white/5">
                    {QUICK.map(([k, v]) => (
                        <div key={k} className="grid grid-cols-3 gap-3 py-2">
                            <div className="text-xs uppercase tracking-wider text-gray-400 font-bold col-span-1">{k}</div>
                            <div className="text-sm text-gray-200 col-span-2">{v}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Conference-variable callout */}
            <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-brand-gold shrink-0" />
                <div className="text-sm text-gray-300">
                    <span className="font-bold text-brand-gold">Confirm with your Regional League:</span> two things vary by conference and aren't fixed nationally —
                    <span className="text-white"> half length</span> (30-min national standard, but many leagues play 35s) and the exact
                    <span className="text-white"> substitution policy</span>. Everything else above is a national standard.
                </div>
            </div>

            {SECTIONS.map((s) => (
                <div key={s.h} className="glass-panel p-4 md:p-5">
                    <h2 className="text-white font-bold text-base mb-1">{s.h}</h2>
                    <p className="text-sm text-gray-300 leading-relaxed">{s.body}</p>
                </div>
            ))}

            <div className="glass-panel p-4 md:p-5">
                <div className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-2">Official sources</div>
                <ul className="space-y-1.5">
                    {SOURCES.map(([label, url]) => (
                        <li key={url}>
                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-green hover:text-white inline-flex items-center gap-1.5">
                                <ExternalLink className="w-3.5 h-3.5 shrink-0" /> {label}
                            </a>
                        </li>
                    ))}
                </ul>
                <p className="text-[11px] text-gray-500 mt-3">Note: there is no standalone "Pre-ECNL" rulebook — these combine US Soccer's 9v9 playing laws with ECNL Competition Rules and your Regional League's game-day procedures.</p>
            </div>
        </div>
    );
}
