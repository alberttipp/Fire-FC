import React from 'react';
import { ShieldCheck, AlertTriangle, ExternalLink } from 'lucide-react';

// Official futsal rules, rendered natively for futsal clubs (org slug/name
// contains "futsal"). Sourced from the FIFA Futsal Laws of the Game with the
// youth modifications common to US youth futsal leagues (US Youth Futsal /
// United Futsal). Items that legitimately vary by league (half length, clock,
// roster size) are flagged "confirm with your league" rather than stated fixed.
const QUICK = [
    ['Format', '5v5 (4 field players + 1 goalkeeper)'],
    ['Substitutions', 'Unlimited "flying" subs — no stoppage needed; enter/exit through your bench\'s sub zone'],
    ['Ball', 'Low-bounce futsal ball — size 4 (size 3 for U9 and younger in most leagues)'],
    ['Court', 'Hard surface, roughly basketball-court sized; touchlines and goal lines mark out of bounds'],
    ['Goals', '3 m × 2 m (≈ 9.8 ft × 6.6 ft)'],
    ['Game length', 'FIFA standard is two 20-minute halves. Youth leagues commonly play shorter halves on a running clock — confirm your league.'],
    ['Timeouts', '1 per team per half (FIFA standard; not all youth leagues use them)'],
    ['Kick-ins', 'Replace throw-ins — ball ON the line, opponents 5 m back, 4 seconds to play; no goal directly from a kick-in'],
    ['Offside', 'None — there is no offside in futsal'],
    ['4-second rule', 'All restarts (kick-ins, corners, free kicks, goal clearances) and keeper possession in your own half: play within 4 seconds'],
    ['Slide tackles', 'Not allowed when challenging an opponent — direct free kick (and most youth leagues ban sliding entirely)'],
    ['Accumulated fouls', 'Direct-kick fouls count per half; from a team\'s 6th foul the opponent takes a free kick with NO WALL from the 10 m spot (or closer, from the foul)'],
    ['Penalty spots', '6 m (penalty kick) and 10 m (second spot for accumulated fouls)'],
    ['Goal clearance', 'When the ball crosses the goal line off the attack, the keeper THROWS it back into play — no goal kicks'],
    ['Equipment', 'Shin guards required; flat-soled indoor shoes (no cleats)'],
];

const SECTIONS = [
    {
        h: 'Why futsal rules are different on purpose',
        body: 'Futsal is the FIFA-recognized form of small-sided indoor soccer. Every rule difference — low-bounce ball, kick-ins, the 4-second limit, no offside — exists to maximize touches, speed of thought, and 1v1 skill. Players get the ball constantly; there is nowhere to hide and no time to wait.',
    },
    {
        h: 'Flying substitutions',
        body: 'Subs are unlimited and happen on the fly, like hockey: the player coming off must exit through your team\'s substitution zone before the new player steps on. Substituting badly (entering early, wrong zone) is a caution. Keepers can be substituted the same way during a stoppage.',
    },
    {
        h: 'The 4-second rule',
        body: 'On every restart — kick-ins, corners, free kicks, goal clearances — the referee can count four seconds (visibly, with their hand). Take longer and the ball goes to the other team. The same count applies to a goalkeeper controlling the ball in their own half. It keeps the game moving and punishes slow decisions.',
    },
    {
        h: 'Goalkeeper rules (the big ones)',
        body: 'After the keeper releases the ball, they cannot touch it again in their own half until an opponent has played it (one "involvement" per possession). Goal clearances are thrown, not kicked. A deliberate pass back with the feet can be picked up only if the keeper is in the opponent\'s half — in practice youth keepers should play with their feet and release quickly. Keepers have 4 seconds with the ball in their own half.',
    },
    {
        h: 'Accumulated fouls — the honesty system',
        body: 'Every direct-free-kick foul a team commits is counted, per half. Starting with that team\'s SIXTH foul of the half, the other team gets a direct free kick with no wall allowed — from the second penalty spot at 10 m, or from the spot of the foul if it was closer to goal. Foul counts reset at halftime. This rule is why good futsal teams defend with their feet positioned well instead of grabbing and bumping.',
    },
    {
        h: 'Kick-ins and corners',
        body: 'When the ball leaves over a touchline, play restarts with a kick-in: ball stationary ON the line, 4 seconds, defenders 5 m away. You cannot score directly from a kick-in (it must touch another player first). Corners are kicked from the corner arc with the same 4-second count.',
    },
    {
        h: 'Fouls, cards & the 2-minute power play',
        body: 'Yellow and red cards work like outdoor soccer, with one addition: when a player is sent off, their team plays a man down for two full minutes (or until they concede a goal), after which a substitute may enter. The sent-off player is done for the match. Sliding challenges against an opponent are direct-kick fouls — and most youth leagues simply prohibit slide tackling outright.',
    },
    {
        h: 'Sportsmanship & the bench',
        body: 'Coaches and substitutes stay in their bench area; one coach may stand to instruct. Dissent toward referees is carded in futsal just like outdoor. Families: the court is small and voices carry — cheer effort, leave the coaching to the coaches and the calls to the referee.',
    },
];

const SOURCES = [
    ['FIFA Futsal Laws of the Game (official)', 'https://www.theifab.com/laws-of-the-game-documents/?language=en&year=latest&type=futsal'],
    ['US Youth Futsal — Laws of the Game', 'https://www.usyouthfutsal.com/laws-of-the-game/'],
    ['US Soccer — Futsal overview', 'https://www.ussoccer.com/futsal'],
];

export default function FutsalRules() {
    return (
        <div className="max-w-5xl mx-auto px-4 md:px-6 pb-24 pt-6 space-y-6">
            <div>
                <h1 className="text-3xl text-white font-display font-bold uppercase tracking-wider">Official Futsal Rules</h1>
                <p className="text-gray-400 text-sm mt-1">FIFA futsal laws, youth edition · the essentials for coaches &amp; families.</p>
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

            {/* League-variable callout */}
            <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-brand-gold shrink-0" />
                <div className="text-sm text-gray-300">
                    <span className="font-bold text-brand-gold">Confirm with your league:</span> a few things vary by competition and age group —
                    <span className="text-white"> half length &amp; clock</span> (stopped vs. running),
                    <span className="text-white"> timeouts</span>,
                    <span className="text-white"> ball size for the youngest ages</span>, and
                    <span className="text-white"> roster limits</span>. Everything else above is the FIFA standard.
                </div>
            </div>

            {SECTIONS.map((s) => (
                <div key={s.h} className="glass-panel p-4 md:p-5">
                    <h2 className="text-white font-bold text-base mb-1">{s.h}</h2>
                    <p className="text-sm text-gray-300 leading-relaxed">{s.body}</p>
                </div>
            ))}

            {/* Sources */}
            <div className="glass-panel p-4 md:p-5">
                <h2 className="text-white font-bold text-base mb-2">Official sources</h2>
                <div className="space-y-1.5">
                    {SOURCES.map(([label, url]) => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-sm text-brand-green hover:text-white transition-colors">
                            <ExternalLink className="w-3.5 h-3.5 shrink-0" /> {label}
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
}
