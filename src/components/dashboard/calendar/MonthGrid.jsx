import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, format } from 'date-fns';
import { getEventConfig } from './constants';
import EventCard from './EventCard';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MonthGrid = ({ viewDate, events, rsvps, rsvpCounts, onEventClick, onRsvp, onAddEvent }) => {
    const [selectedDay, setSelectedDay] = useState(null);

    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

    const getEventsForDay = (day) => events.filter(e => isSameDay(new Date(e.start_time), day));

    const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

    return (
        <div className="space-y-4">
            {/* Grid */}
            <div className="glass-panel p-4">
                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                    {WEEKDAYS.map(day => (
                        <div key={day} className="text-center text-[10px] text-gray-500 font-bold uppercase tracking-wider py-1">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 gap-1">
                    {days.map((day, i) => {
                        const dayEvents = getEventsForDay(day);
                        const inMonth = isSameMonth(day, viewDate);
                        const today = isToday(day);
                        const selected = selectedDay && isSameDay(day, selectedDay);

                        return (
                            <div
                                key={i}
                                onClick={() => setSelectedDay(selected ? null : day)}
                                className={`min-h-[56px] md:min-h-[80px] rounded-lg p-1.5 cursor-pointer transition-all border ${
                                    selected ? 'border-brand-green bg-brand-green/10' :
                                    today ? 'border-brand-green/30 bg-brand-green/5' :
                                    'border-transparent hover:bg-white/5'
                                } ${!inMonth ? 'opacity-30' : ''}`}
                            >
                                <span className={`text-xs font-bold block ${
                                    today ? 'text-brand-green' :
                                    selected ? 'text-white' :
                                    'text-gray-400'
                                }`}>
                                    {format(day, 'd')}
                                </span>

                                {/* Event dots */}
                                <div className="flex gap-0.5 mt-1 flex-wrap">
                                    {dayEvents.slice(0, 3).map((evt, j) => {
                                        const config = getEventConfig(evt.type);
                                        return (
                                            <div key={j} className={`w-2 h-2 rounded-full ${config.dot}`} title={evt.title} />
                                        );
                                    })}
                                    {dayEvents.length > 3 && (
                                        <span className="text-[8px] text-gray-500 font-bold">+{dayEvents.length - 3}</span>
                                    )}
                                </div>

                                {/* Event preview text (desktop only) */}
                                <div className="hidden md:block mt-1">
                                    {dayEvents.slice(0, 2).map((evt, j) => {
                                        const config = getEventConfig(evt.type);
                                        return (
                                            <div key={j} className={`text-[9px] truncate ${config.text} leading-tight`}>
                                                {format(new Date(evt.start_time), 'h:mm')} {evt.title}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Selected day events */}
            {selectedDay && (
                <div className="space-y-3 animate-fade-in">
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        {format(selectedDay, 'EEEE, MMMM d')}
                        <span className="text-xs text-gray-500 font-normal">({selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? 's' : ''})</span>
                    </h3>
                    {selectedDayEvents.length === 0 ? (
                        <div className="p-8 text-center border border-dashed border-white/10 rounded-xl flex flex-col items-center gap-3">
                            <p className="text-gray-500 text-sm">No events on this day</p>
                            {onAddEvent && (
                                <button
                                    onClick={() => onAddEvent(selectedDay)}
                                    className="inline-flex items-center gap-1.5 bg-brand-green text-brand-dark px-4 py-2 rounded-lg font-bold uppercase text-xs hover:bg-white transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add Event
                                </button>
                            )}
                        </div>
                    ) : (
                        selectedDayEvents.map(event => (
                            <EventCard
                                key={event.id}
                                event={event}
                                rsvpStatus={rsvps[event.id]}
                                rsvpCounts={rsvpCounts[event.id]}
                                onRsvp={onRsvp}
                                onClick={onEventClick}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default MonthGrid;
