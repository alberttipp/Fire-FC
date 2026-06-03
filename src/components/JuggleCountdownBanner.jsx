import React, { useState, useEffect } from 'react';

// Live countdown to the Juggle-Off kickoff: 7:00 PM Central (CDT = UTC-5)
// tonight, 2026-06-03. TARGET is a fixed absolute instant, so every device
// shows the same remaining time no matter the viewer's own timezone.
// (June is Central DAYLIGHT time, so the offset is -05:00, not -06:00.)
const TARGET = new Date('2026-06-03T19:00:00-05:00').getTime();

const pad = (n) => String(n).padStart(2, '0');

const JuggleCountdownBanner = () => {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    const remaining = TARGET - now;
    if (remaining <= 0) return null; // auto-hide once 7 PM passes

    const totalSec = Math.floor(remaining / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;

    return (
        <div
            className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-brand-gold to-yellow-400 text-brand-dark text-center py-1.5 px-3 shadow-lg"
            style={{ paddingTop: 'calc(0.375rem + env(safe-area-inset-top))' }}
        >
            <span className="font-display font-bold uppercase tracking-wider text-xs sm:text-sm whitespace-nowrap">
                ⚽ Juggle-Off in {h}:{pad(m)}:{pad(s)} — kicks off 7:00 PM tonight!
            </span>
        </div>
    );
};

export default JuggleCountdownBanner;
