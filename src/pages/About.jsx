import React from 'react';
import { Link } from 'react-router-dom';
import {
    Flame,
    Target,
    BarChart3,
    NotebookPen,
    Users,
    Trophy,
    ArrowRight,
    Mail,
    CheckCircle2,
    Smartphone,
} from 'lucide-react';

const Feature = ({ icon: Icon, title, body }) => (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 hover:border-brand-gold/40 transition-colors">
        <div className="w-11 h-11 rounded-xl bg-brand-gold/15 flex items-center justify-center mb-3">
            <Icon className="w-5 h-5 text-brand-gold" />
        </div>
        <h3 className="text-white font-display font-bold uppercase tracking-wider text-sm mb-1.5">
            {title}
        </h3>
        <p className="text-gray-400 text-sm leading-relaxed">{body}</p>
    </div>
);

const Step = ({ n, title, body }) => (
    <div className="flex gap-3">
        <span className="shrink-0 w-7 h-7 rounded-full bg-brand-gold/20 text-brand-gold text-sm font-bold flex items-center justify-center">
            {n}
        </span>
        <div>
            <p className="text-white font-semibold text-sm">{title}</p>
            <p className="text-gray-400 text-xs leading-relaxed mt-0.5">{body}</p>
        </div>
    </div>
);

const About = () => {
    return (
        <div className="min-h-screen bg-brand-dark text-white">
            {/* Top nav strip */}
            <nav className="sticky top-0 z-30 bg-brand-dark/85 backdrop-blur-md border-b border-white/5">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
                    <Link to="/about" className="flex items-center gap-2 group">
                        <img
                            src="/branding/logo.png"
                            alt="Fire FC"
                            className="w-8 h-8 rounded"
                        />
                        <span className="font-display font-bold uppercase tracking-wider text-sm group-hover:text-brand-gold transition-colors">
                            Fire FC
                        </span>
                    </Link>
                    <Link
                        to="/login"
                        className="inline-flex items-center gap-1.5 bg-brand-gold text-black px-3.5 py-1.5 rounded-lg font-bold uppercase tracking-wider text-[11px] hover:bg-brand-gold/90 transition-colors"
                    >
                        Open App <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </nav>

            {/* Hero */}
            <header className="relative overflow-hidden">
                <div
                    className="absolute inset-0 opacity-30 pointer-events-none"
                    style={{
                        background:
                            'radial-gradient(60% 60% at 50% 0%, rgba(212,175,55,0.25) 0%, rgba(10,10,10,0) 70%)',
                    }}
                />
                <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 pb-10 sm:pt-20 sm:pb-14 text-center relative">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-gold/10 border border-brand-gold/30 mb-5">
                        <Flame className="w-3.5 h-3.5 text-brand-gold" />
                        <span className="text-brand-gold text-[11px] font-bold uppercase tracking-widest">
                            Rockford Fire FC
                        </span>
                    </div>
                    <h1 className="font-display font-bold uppercase tracking-tight text-4xl sm:text-6xl leading-[1.05] mb-4">
                        Real player development.
                        <br />
                        <span className="text-brand-gold">Built for our team.</span>
                    </h1>
                    <p className="text-gray-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                        Fire FC is the app we built to track training, growth, and game-day prep for our players — automatically. Less paperwork for coaches. More confidence for families. Real progress kids can see.
                    </p>
                    <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
                        <Link
                            to="/login"
                            className="inline-flex items-center justify-center gap-2 bg-brand-gold text-black px-6 py-3 rounded-xl font-bold uppercase tracking-wider text-sm hover:bg-brand-gold/90 transition-colors"
                        >
                            Open the App <ArrowRight className="w-4 h-4" />
                        </Link>
                        <a
                            href="#how-to-log-in"
                            className="inline-flex items-center justify-center gap-2 border border-white/15 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-wider text-sm hover:bg-white/5 transition-colors"
                        >
                            How to Log In
                        </a>
                    </div>
                </div>
            </header>

            {/* Why */}
            <section className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-12 border-t border-white/5">
                <p className="text-gray-300 text-base sm:text-lg leading-relaxed text-center max-w-3xl mx-auto">
                    Most youth-soccer apps are glorified scheduling tools. Fire FC tracks <span className="text-brand-gold font-semibold">what actually makes a player better</span> — minutes trained, ball touches, skill progression, evaluation history — and shows it to parents and kids in a way that motivates them to keep working between practices.
                </p>
            </section>

            {/* Feature grid */}
            <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
                <h2 className="font-display font-bold uppercase tracking-wider text-xs text-brand-gold text-center mb-6">
                    What's inside
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Feature
                        icon={BarChart3}
                        title="Training Tracking"
                        body="Every drill, every minute, every estimated ball touch — logged automatically when a player completes homework or attends a practice. Weekly, season, and career stats."
                    />
                    <Feature
                        icon={Target}
                        title="90-Day IDP"
                        body="Each player gets an Individual Development Plan with 20 named skill moves. Mastered moves unlock badges. Structured growth, not random drills."
                    />
                    <Feature
                        icon={Trophy}
                        title="Evaluations + Radar"
                        body="Six-skill radar chart with baseline overlay. See exactly where a player started and how far they've come — visually, over time."
                    />
                    <Feature
                        icon={NotebookPen}
                        title="Coach Notes"
                        body="A timestamped journal per player. The full story of a kid's growth in the club — no more lost paper notes, no more 'how was their season?' guessing."
                    />
                    <Feature
                        icon={Users}
                        title="Parent Dashboard"
                        body="Parents see their kid's training streak, weekly touches, upcoming events, homework assignments, and the same evaluations the coach sees. One source of truth."
                    />
                    <Feature
                        icon={Smartphone}
                        title="Kid-Friendly Locker Room"
                        body="Players log in via a tap-to-open access link or a 4-digit PIN. No email or password needed. Their own dashboard shows their stats, badges, and homework for the week."
                    />
                </div>
            </section>

            {/* How to log in */}
            <section
                id="how-to-log-in"
                className="bg-white/[0.02] border-y border-white/5"
            >
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
                    <h2 className="font-display font-bold uppercase tracking-wider text-2xl sm:text-3xl text-center mb-2">
                        How to <span className="text-brand-gold">log in</span>
                    </h2>
                    <p className="text-gray-400 text-sm text-center mb-10 max-w-xl mx-auto">
                        Three paths in — pick the one that fits you.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {/* Coach */}
                        <div className="bg-brand-dark border border-white/10 rounded-2xl p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
                                    <Trophy className="w-4 h-4 text-blue-400" />
                                </div>
                                <h3 className="font-display font-bold uppercase tracking-wider text-sm">
                                    Coach
                                </h3>
                            </div>
                            <div className="space-y-3">
                                <Step
                                    n="1"
                                    title="Open the app"
                                    body="firefcapp.com on any phone"
                                />
                                <Step
                                    n="2"
                                    title="Sign in"
                                    body="Email + password (or sign up if your first time)"
                                />
                                <Step
                                    n="3"
                                    title="Coach Dashboard opens"
                                    body="Roster, practices, IDP, evaluations, everything"
                                />
                            </div>
                        </div>

                        {/* Parent */}
                        <div className="bg-brand-dark border border-brand-gold/30 rounded-2xl p-5 relative">
                            <div className="absolute -top-2 left-5 px-2 py-0.5 bg-brand-gold text-black rounded text-[10px] font-bold uppercase tracking-wider">
                                Most parents
                            </div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-9 h-9 rounded-lg bg-brand-gold/15 flex items-center justify-center">
                                    <Users className="w-4 h-4 text-brand-gold" />
                                </div>
                                <h3 className="font-display font-bold uppercase tracking-wider text-sm">
                                    Parent / Family
                                </h3>
                            </div>
                            <div className="space-y-3">
                                <Step
                                    n="1"
                                    title="Open firefcapp.com"
                                    body="Sign up as a Family account (email + password)"
                                />
                                <Step
                                    n="2"
                                    title="Link to your player"
                                    body="Enter the 6-character code Coach Albert sent you"
                                />
                                <Step
                                    n="3"
                                    title="Add to your home screen"
                                    body="iPhone: Share → Add to Home Screen. Android: ⋮ menu → Install app"
                                />
                            </div>
                        </div>

                        {/* Player */}
                        <div className="bg-brand-dark border border-white/10 rounded-2xl p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                                    <Flame className="w-4 h-4 text-emerald-400" />
                                </div>
                                <h3 className="font-display font-bold uppercase tracking-wider text-sm">
                                    Player (kid)
                                </h3>
                            </div>
                            <div className="space-y-3">
                                <Step
                                    n="1"
                                    title="Get a link from your parent"
                                    body="They generate it in their dashboard and text it to you"
                                />
                                <Step
                                    n="2"
                                    title="Tap the link"
                                    body="Opens your Locker Room — no password needed"
                                />
                                <Step
                                    n="3"
                                    title="Or use a PIN"
                                    body="Pick Player tab on login → team code → name → 4-digit PIN"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* For other coaches */}
            <section className="max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
                <div className="bg-gradient-to-br from-brand-gold/10 to-transparent border border-brand-gold/30 rounded-2xl p-6 sm:p-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-gold/15 border border-brand-gold/40 mb-4">
                        <Trophy className="w-3.5 h-3.5 text-brand-gold" />
                        <span className="text-brand-gold text-[11px] font-bold uppercase tracking-widest">
                            For Coaches & Clubs
                        </span>
                    </div>
                    <h2 className="font-display font-bold uppercase tracking-tight text-2xl sm:text-4xl mb-4 leading-tight">
                        Running your own team?
                    </h2>
                    <p className="text-gray-300 text-base sm:text-lg leading-relaxed mb-6 max-w-2xl">
                        I built Fire FC because nothing on the market actually tracks <em>development</em> — they all track schedules. If you coach a youth team and want to see what real player-development tracking looks like, I'd love to show you.
                    </p>
                    <ul className="space-y-2 mb-7 text-gray-300 text-sm">
                        <li className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-brand-gold mt-0.5 shrink-0" />
                            <span>Live demo in 15 minutes, on a real team</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-brand-gold mt-0.5 shrink-0" />
                            <span>Works for U6 through U18, boys / girls / coed</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-brand-gold mt-0.5 shrink-0" />
                            <span>Multi-team / multi-club support — one kid can play on multiple teams</span>
                        </li>
                    </ul>
                    <a
                        href="mailto:alberttipp@gmail.com?subject=Fire%20FC%20demo%20-%20%5Byour%20club%20name%5D&body=Hi%20Albert%2C%20I%20coach%20%5Bteam%20name%5D%20and%20I%27d%20like%20a%20demo%20of%20Fire%20FC.%20Best%20time%20to%20chat%3A%20"
                        className="inline-flex items-center gap-2 bg-brand-gold text-black px-5 py-3 rounded-xl font-bold uppercase tracking-wider text-sm hover:bg-brand-gold/90 transition-colors"
                    >
                        <Mail className="w-4 h-4" />
                        Email me for a demo
                    </a>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/5">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                        <img
                            src="/branding/logo.png"
                            alt=""
                            className="w-6 h-6 rounded opacity-80"
                        />
                        <span>Fire FC · Rockford, IL</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link to="/login" className="hover:text-white transition-colors">
                            Sign in
                        </Link>
                        <a
                            href="mailto:alberttipp@gmail.com"
                            className="hover:text-white transition-colors"
                        >
                            Contact
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default About;
