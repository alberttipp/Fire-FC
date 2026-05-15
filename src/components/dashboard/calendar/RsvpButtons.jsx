import React from 'react';
import { CheckCircle, XCircle, Plane } from 'lucide-react';

// 3-button RSVP cluster: Going / Out / Vacation. "Maybe" was retired
// per the summer-team plan — fuzzy answers make the coach's headcount
// useless. Legacy 'maybe' rows in event_rsvps just won't highlight any
// button.
const RsvpButtons = ({ eventId, currentStatus, onRsvp, size = 'md' }) => {
    const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

    const buttons = [
        { status: 'going',     Icon: CheckCircle, activeClass: 'bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]', title: 'Going' },
        { status: 'not_going', Icon: XCircle,     activeClass: 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]',   title: 'Out' },
        { status: 'vacation',  Icon: Plane,       activeClass: 'bg-sky-500 text-white shadow-[0_0_10px_rgba(56,189,248,0.4)]',  title: 'Vacation' },
    ];

    return (
        <div className="flex items-center gap-1 p-1 bg-white/5 rounded-full border border-white/10" onClick={e => e.stopPropagation()}>
            {buttons.map(({ status, Icon, activeClass, title }) => (
                <button
                    key={status}
                    onClick={() => onRsvp(eventId, status)}
                    className={`p-1.5 rounded-full transition-all ${currentStatus === status ? activeClass : 'text-gray-500 hover:text-white'}`}
                    title={title}
                    aria-label={title}
                >
                    <Icon className={iconSize} />
                </button>
            ))}
        </div>
    );
};

export default RsvpButtons;
