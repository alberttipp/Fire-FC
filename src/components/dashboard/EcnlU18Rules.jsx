import React from 'react';
import { ShieldCheck, AlertTriangle, ExternalLink, GraduationCap } from 'lucide-react';

// U18/U19 ECNL Girls rules, rendered natively. This is the full 11v11 game under
// the IFAB Laws of the Game plus ECNL Competition Rules (roster, discipline,
// game-day procedures). Items that legitimately differ between ECNL regular-season
// league play and ECNL National Events / Playoffs / showcases (substitutions,
// roster counts) are flagged "confirm" rather than stated as fixed.
const QUICK = [
    ['Format', '11v11 (10 field players + 1 goalkeeper)'],
    ['Ball', 'Size 5'],
    ['Field', 'Full size (~110–120 yds long × 70–80 yds wide)'],
    ['Goals', 'Full size — 8 ft × 24 ft'],
    ['Game length', 'Two 45-minute halves (90 min) + up to 15-min halftime'],
    ['Offside', 'Yes — full-field offside applies'],
    ['Heading', 'Allowed — no age restriction at U18/U19'],
    ['Goalkeeper', 'Punting allowed; 6-second rule; no back-pass handling'],
    ['Substitutions', 'League play commonly allows re-entry; ECNL Playoffs / National Events / some showcases use limited, no-re-entry subs — confirm per match.'],
    ['Game-day roster', 'Set by ECNL Competition Rules (commonly up to ~18–20 dressed) — confirm current season.'],
    ['Player passes', 'Digital game-day roster in TGS; players must be ECNL-registered.'],
];

const SECTIONS = [
    {
        h: 'The full game',
        body: 'At U18/U19 this is the complete 11v11 game: full-size field and goals, a size-5 ball, offside enforced everywhere, heading allowed, and two 45-minute halves. Everything runs under the IFAB Laws of the Game, with ECNL Competition Rules layered on top for rosters, discipline, and game-day procedures.',
    },
    {
        h: 'Substitutions — depends on the competition',
        body: 'ECNL regular-season league matches generally allow substitutions with re-entry (a player can come off and go back on). ECNL National Events, the ECNL Playoffs, and some showcases switch to FIFA-style limited substitutions with NO re-entry. Always confirm which set of rules applies to a given match. A player removed for a suspected concussion can be substituted without it counting against any limit, and cannot return until cleared.',
    },
    {
        h: 'Roster & game day',
        body: 'All players must be registered with ECNL and appear on the digital game-day roster in TotalGlobalSports (TGS). Game-day dressed-roster and club-roster limits are set by the current-season ECNL Competition Rules — confirm the exact numbers there. Coaches must hold valid credentials and be listed; a limited number of carded staff are allowed in the technical area.',
    },
    {
        h: 'Discipline — cards & suspensions',
        body: 'Yellow-card accumulation over the season triggers automatic one-game suspensions at set thresholds; a second yellow in a match is a send-off. A straight red carries a minimum one-game suspension, with longer bans for serious foul play or violent conduct — and can apply to coaches as well as players. Suspensions carry over between league and playoff play per ECNL rules.',
    },
    {
        h: 'Uniforms & match logistics',
        body: 'Home team wears light, away wears dark; on a color clash the home team changes (including socks and goalkeepers). Home team provides at least two match balls. Shin guards are mandatory. Teams check in with match officials with player passes / the digital roster before kickoff.',
    },
];

const SOURCES = [
    ['ECNL — official site & rules', 'https://www.theecnl.com/'],
    ['ECNL Competition Rules (verify current season)', 'https://texasclubsoccer.com/wp-content/uploads/2024/09/2024-2025-ECNL-COMPETITION-RULES.pdf'],
    ['IFAB — Laws of the Game', 'https://www.theifab.com/laws-of-the-game-documents/'],
    ['US Youth Soccer — rules & resources', 'https://www.usyouthsoccer.org/'],
];

export default function EcnlU18Rules() {
    return (
        <div className="max-w-5xl mx-auto px-4 md:px-6 pb-24 pt-6 space-y-6">
            <div>
                <h1 className="text-3xl text-white font-display font-bold uppercase tracking-wider">U18/U19 ECNL Rules</h1>
                <p className="text-gray-400 text-sm mt-1">Girls 11v11 · ECNL — the essentials for coaches &amp; families.</p>
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

            {/* Competition-variable callout */}
            <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-brand-gold shrink-0" />
                <div className="text-sm text-gray-300">
                    <span className="font-bold text-brand-gold">Confirm per competition:</span> the biggest variables are the
                    <span className="text-white"> substitution rules</span> (re-entry in league play vs. limited/no-re-entry at Playoffs &amp; National Events) and the exact
                    <span className="text-white"> roster limits</span>. Check the current-season ECNL Competition Rules for the definitive numbers.
                </div>
            </div>

            {/* Recruiting context — meaningful at this age */}
            <div className="rounded-xl border border-brand-green/25 bg-brand-green/5 p-4 flex gap-3">
                <GraduationCap className="w-5 h-5 text-brand-green shrink-0" />
                <div className="text-sm text-gray-300">
                    <span className="font-bold text-brand-green">College recruiting:</span> ECNL U18/U19 is a primary recruiting stage — league games, showcases, and Playoffs are routinely scouted by college coaches. Keeping the TGS schedule and roster current matters for player exposure.
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
                <p className="text-[11px] text-gray-500 mt-3">Note: ECNL Competition Rules are updated each season and can differ between league play and National Events / Playoffs. This is a plain-language summary — the current-season ECNL rulebook is the authority.</p>
            </div>
        </div>
    );
}
