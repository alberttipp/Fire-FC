import React from 'react';
import { Clock, MapPin, Shirt, Download } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { getEventConfig } from './constants';
import RsvpButtons from './RsvpButtons';

const EventCard = ({ event, rsvpStatus, rsvpCounts, onRsvp, onClick, compact = false }) => {
    const config = getEventConfig(event.type);
    const eventDate = new Date(event.start_time);
    const isGame = event.type === 'game';
    const counts = rsvpCounts || { going: 0, maybe: 0, not_going: 0 };
    const totalRsvps = counts.going + counts.maybe + counts.not_going;

    const countdown = (() => {
        try {
            const now = new Date();
            if (eventDate > now) {
                return formatDistanceToNow(eventDate, { addSuffix: true });
            }
            return 'past';
        } catch { return ''; }
    })();

    const downloadIcs = (e) => {
        e.stopPropagation();
        const fmtDate = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');
        const start = fmtDate(eventDate);
        const end = fmtDate(new Date(event.end_time || event.start_time));
        const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${event.title}\nDTSTART:${start}\nDTEND:${end}\nLOCATION:${event.location_name || ''}\nDESCRIPTION:${event.type} - ${event.notes || ''}\nEND:VEVENT\nEND:VCALENDAR`;
        const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${event.title}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (compact) {
        return (
            <div
                onClick={() => onClick?.(event)}
                className={`p-3 rounded-lg border-l-3 cursor-pointer hover:bg-white/5 transition-colors ${config.border} bg-white/[0.02]`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${config.bg} ${config.text}`}>{config.label}</span>
                        <span className="text-sm text-white font-bold truncate">{event.title}</span>
                    </div>
                    <span className="text-xs text-gray-500 shrink-0 ml-2">
                        {format(eventDate, 'h:mm a')}
                    </span>
                </div>
                {totalRsvps > 0 && (
                    <div className="flex gap-2 mt-1 text-[10px]">
                        {counts.going > 0 && <span className="text-green-400">{counts.going} going</span>}
                        {counts.maybe > 0 && <span className="text-yellow-400">{counts.maybe} maybe</span>}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div
            onClick={() => onClick?.(event)}
            className={`glass-panel p-5 border-l-4 relative group cursor-pointer hover:bg-white/5 transition-colors ${config.border}`}
        >
            {isGame && <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg uppercase">Match Day</div>}

            <div className="flex flex-col md:flex-row justify-between gap-4">
                {/* Date Box */}
                <div className="flex-shrink-0 flex flex-col items-center justify-center w-14 h-14 bg-white/5 rounded-lg border border-white/10">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">{format(eventDate, 'MMM')}</span>
                    <span className="text-xl text-white font-bold">{format(eventDate, 'd')}</span>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg text-white font-bold truncate">{event.title}</h3>
                        <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${config.bg} ${config.text}`}>{config.label}</span>
                    </div>

                    <div className="flex flex-wrap gap-3 text-sm text-gray-400">
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-gray-500" /> {format(eventDate, 'h:mm a')}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gray-500" /> {event.location_name || 'TBD'}</span>
                        {event.kit_color && (
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: event.kit_color }} />
                                {event.kit_color}
                            </span>
                        )}
                    </div>

                    {/* Countdown + RSVP counts */}
                    <div className="flex items-center gap-3 mt-2">
                        {countdown && countdown !== 'past' && (
                            <span className="text-[10px] text-brand-green font-bold uppercase">{countdown}</span>
                        )}
                        {totalRsvps > 0 && (
                            <div className="flex gap-2 text-[10px]">
                                {counts.going > 0 && <span className="text-green-400 font-bold">{counts.going} going</span>}
                                {counts.maybe > 0 && <span className="text-yellow-400 font-bold">{counts.maybe} maybe</span>}
                                {counts.not_going > 0 && <span className="text-red-400 font-bold">{counts.not_going} out</span>}
                            </div>
                        )}
                    </div>
                </div>

                {/* RSVP + Actions */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                    <RsvpButtons eventId={event.id} currentStatus={rsvpStatus} onRsvp={onRsvp} />
                    <button
                        onClick={downloadIcs}
                        className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-brand-gold transition-colors font-bold uppercase tracking-wider"
                    >
                        <Download className="w-3 h-3" /> Add to Cal
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EventCard;
