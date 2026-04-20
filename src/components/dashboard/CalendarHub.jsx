import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Grid3X3, List, CalendarDays } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import useCalendarEvents from '../../hooks/useCalendarEvents';
import CreateEventModal from './CreateEventModal';
import UpcomingWeek from './UpcomingWeek';
import MonthGrid from './calendar/MonthGrid';
import AgendaList from './calendar/AgendaList';
import EventDetailModal from './calendar/EventDetailModal';
import SessionRunner from './calendar/SessionRunner';

const CalendarHub = () => {
    const { user, profile } = useAuth();
    const [viewMode, setViewMode] = useState('month'); // 'month' | 'week' | 'list'
    const [viewDate, setViewDate] = useState(new Date());
    const [showCreateModal, setShowCreateModal] = useState(null);
    const [createDefaultDate, setCreateDefaultDate] = useState(null);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [runningSession, setRunningSession] = useState(null);

    const openCreateModalForDate = (date) => {
        setCreateDefaultDate(date);
        setShowCreateModal('practice');
    };

    // Compute date range for data fetching
    const dateRange = useMemo(() => {
        if (viewMode === 'week') return null; // UpcomingWeek manages its own fetch
        const monthStart = startOfMonth(viewDate);
        const monthEnd = endOfMonth(viewDate);
        return {
            start: startOfWeek(monthStart),
            end: endOfWeek(monthEnd),
        };
    }, [viewDate, viewMode]);

    const { events, rsvps, rsvpCounts, loading, handleRsvp } = useCalendarEvents({
        user,
        profile,
        dateRange,
    });

    const isCoach = profile?.role === 'coach' || profile?.role === 'manager';

    const navLabel = viewMode === 'week'
        ? 'This Week'
        : format(viewDate, 'MMMM yyyy');

    const handlePrev = () => setViewDate(prev => subMonths(prev, 1));
    const handleNext = () => setViewDate(prev => addMonths(prev, 1));

    const handleStartSession = (session) => {
        setRunningSession(session);
        setSelectedEvent(null);
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-3xl text-white font-display uppercase font-bold flex items-center gap-3">
                        <CalendarIcon className="w-8 h-8 text-brand-gold" /> Calendar
                    </h2>
                    <p className="text-gray-400 text-sm">Manage your team schedule and availability.</p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* View Mode Toggle */}
                    <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10">
                        <button
                            onClick={() => setViewMode('month')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase flex items-center gap-1 transition-all ${viewMode === 'month' ? 'bg-brand-green text-brand-dark' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Grid3X3 className="w-3 h-3" /> Month
                        </button>
                        <button
                            onClick={() => setViewMode('week')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase flex items-center gap-1 transition-all ${viewMode === 'week' ? 'bg-brand-green text-brand-dark' : 'text-gray-400 hover:text-white'}`}
                        >
                            <CalendarDays className="w-3 h-3" /> Week
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase flex items-center gap-1 transition-all ${viewMode === 'list' ? 'bg-brand-green text-brand-dark' : 'text-gray-400 hover:text-white'}`}
                        >
                            <List className="w-3 h-3" /> List
                        </button>
                    </div>

                    {/* Month Navigation (hidden in week mode) */}
                    {viewMode !== 'week' && (
                        <div className="flex items-center bg-white/5 rounded-lg px-1 border border-white/10">
                            <button onClick={handlePrev} className="p-2 text-gray-400 hover:text-white">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="w-36 text-center text-white font-bold uppercase text-sm">{navLabel}</span>
                            <button onClick={handleNext} className="p-2 text-gray-400 hover:text-white">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}

                    {/* Create buttons (coach/manager) */}
                    {isCoach && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowCreateModal('practice')}
                                className="bg-brand-green text-brand-dark px-3 py-2 rounded-lg font-bold uppercase text-xs flex items-center gap-1.5 hover:bg-white transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" /> Practice
                            </button>
                            <button
                                onClick={() => setShowCreateModal('game')}
                                className="bg-white/5 border border-white/10 text-gray-300 px-3 py-2 rounded-lg font-bold uppercase text-xs flex items-center gap-1.5 hover:bg-white/10 transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" /> Game
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Loading */}
            {loading && viewMode !== 'week' && (
                <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
                </div>
            )}

            {/* Views */}
            {!loading && viewMode === 'month' && (
                <MonthGrid
                    viewDate={viewDate}
                    events={events}
                    rsvps={rsvps}
                    rsvpCounts={rsvpCounts}
                    onEventClick={setSelectedEvent}
                    onRsvp={handleRsvp}
                    onAddEvent={isCoach ? openCreateModalForDate : undefined}
                />
            )}

            {viewMode === 'week' && <UpcomingWeek />}

            {!loading && viewMode === 'list' && (
                <AgendaList
                    viewDate={viewDate}
                    events={events}
                    rsvps={rsvps}
                    rsvpCounts={rsvpCounts}
                    onEventClick={setSelectedEvent}
                    onRsvp={handleRsvp}
                />
            )}

            {/* Modals */}
            {showCreateModal && (
                <CreateEventModal
                    defaultType={showCreateModal}
                    defaultDate={createDefaultDate}
                    onClose={() => { setShowCreateModal(null); setCreateDefaultDate(null); }}
                    onEventCreated={() => { setShowCreateModal(null); setCreateDefaultDate(null); }}
                />
            )}

            {selectedEvent && (
                <EventDetailModal
                    event={selectedEvent}
                    onClose={() => setSelectedEvent(null)}
                    onStartSession={handleStartSession}
                />
            )}

            {runningSession && (
                <SessionRunner
                    session={runningSession}
                    onClose={() => setRunningSession(null)}
                />
            )}
        </div>
    );
};

export default CalendarHub;
