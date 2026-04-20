import React from 'react';
import { isSameMonth, format } from 'date-fns';
import EventCard from './EventCard';

const AgendaList = ({ viewDate, events, rsvps, rsvpCounts, onEventClick, onRsvp }) => {
    // Filter events to the selected month
    const monthEvents = events.filter(e => isSameMonth(new Date(e.start_time), viewDate));

    // Group by date
    const grouped = {};
    monthEvents.forEach(event => {
        const key = format(new Date(event.start_time), 'yyyy-MM-dd');
        if (!grouped[key]) grouped[key] = { label: format(new Date(event.start_time), 'EEEE, MMMM d'), events: [] };
        grouped[key].events.push(event);
    });

    const dateGroups = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

    if (dateGroups.length === 0) {
        return (
            <div className="p-12 text-center border border-dashed border-white/10 rounded-xl">
                <p className="text-gray-500">No events in {format(viewDate, 'MMMM yyyy')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {dateGroups.map(([dateKey, group]) => (
                <div key={dateKey}>
                    <h3 className="text-sm text-gray-400 font-bold uppercase tracking-wider mb-3 border-b border-white/5 pb-2">
                        {group.label}
                    </h3>
                    <div className="space-y-3">
                        {group.events.map(event => (
                            <EventCard
                                key={event.id}
                                event={event}
                                rsvpStatus={rsvps[event.id]}
                                rsvpCounts={rsvpCounts[event.id]}
                                onRsvp={onRsvp}
                                onClick={onEventClick}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default AgendaList;
