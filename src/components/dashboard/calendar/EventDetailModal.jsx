import React, { useState, useEffect, lazy, Suspense } from 'react';
import { X, MapPin, Shirt, ClipboardList, Play, Video, ImageIcon, Pencil, Trash2, Users } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../../supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../Toast';
import { getEventConfig } from './constants';
import RsvpSummary from './RsvpSummary';
import { isStaff } from '../../../constants/roles';
const EventCoverDesigner = lazy(() => import('../../event-cover/EventCoverDesigner'));
const CreateEventModal   = lazy(() => import('../CreateEventModal'));
const LineupBuilder      = lazy(() => import('../../coach-hq/lineup/LineupBuilder'));

const getYouTubeEmbedUrl = (url) => {
    if (!url) return null;
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('youtu.be')) return `https://www.youtube.com/embed/${urlObj.pathname.slice(1)}`;
        if (urlObj.hostname.includes('youtube.com')) {
            const videoId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop();
            return `https://www.youtube.com/embed/${videoId}`;
        }
    } catch (e) {}
    return url;
};

const EventDetailModal = ({ event: initialEvent, onClose, onStartSession, onEventChanged }) => {
    const { profile } = useAuth();
    const toast = useToast();
    const [event, setEvent] = useState(initialEvent);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingCover, setEditingCover] = useState(false);
    const [editingEvent, setEditingEvent] = useState(false);
    const [showLineup, setShowLineup] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const isGame = event?.type === 'game';
    const config = getEventConfig(event.type);
    const isCoach = isStaff(profile?.role);

    useEffect(() => {
        const fetch = async () => {
            const { data } = await supabase
                .from('practice_sessions')
                .select('*')
                .eq('event_id', event.id)
                .order('created_at', { ascending: false });
            setSessions(data || []);
            setLoading(false);
        };
        fetch();
    }, [event.id]);

    const parseDrills = (session) => {
        let drillsData = session.drills;
        if (typeof drillsData === 'string') {
            try { drillsData = JSON.parse(drillsData); } catch { drillsData = null; }
        }
        if (drillsData && Array.isArray(drillsData.drills)) return drillsData.drills;
        if (Array.isArray(drillsData)) return drillsData;
        return [];
    };

    const handleStartSession = (session) => {
        const drills = parseDrills(session);
        if (drills.length === 0) {
            toast.warning('This session has no drills yet — open it to add some.');
            return;
        }
        onStartSession({ ...session, drills });
    };

    const handleCoverSaved = async (publicUrl, choice) => {
        const { error } = await supabase
            .from('events')
            .update({ cover_image_url: publicUrl, cover_template: choice })
            .eq('id', event.id);
        if (error) {
            toast.error(`Cover saved but couldn't update event: ${error.message}`);
            return;
        }
        const updated = { ...event, cover_image_url: publicUrl, cover_template: choice };
        setEvent(updated);
        setEditingCover(false);
        onEventChanged?.(updated);
    };

    const handleDelete = async () => {
        if (!isCoach) return;
        const confirmed = window.confirm(`Delete "${event.title}"? This removes the event for everyone on the team and can't be undone.`);
        if (!confirmed) return;
        setDeleting(true);
        const { error } = await supabase.from('events').delete().eq('id', event.id);
        setDeleting(false);
        if (error) {
            toast.error(`Couldn't delete: ${error.message}`);
            return;
        }
        toast.success('Event deleted.');
        onEventChanged?.(null); // signal removal
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-end md:items-center justify-center md:p-4 z-50" onClick={onClose}>
            <div className="bg-brand-dark border border-white/10 rounded-t-2xl md:rounded-xl w-full md:max-w-2xl h-[90vh] md:h-auto md:max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Cover hero — only when set. object-contain so the FULL image
                    is visible (no cropping); container hugs the 1200:630 ratio. */}
                {event.cover_image_url && (
                    <div className="relative bg-black overflow-hidden">
                        <img src={event.cover_image_url} alt="" className="w-full h-auto block" />
                        {isCoach && (
                            <button
                                onClick={() => setEditingCover(true)}
                                className="absolute top-2 right-2 px-2.5 py-1.5 rounded-lg bg-black/60 backdrop-blur text-white text-[10px] font-bold uppercase tracking-wider hover:bg-black/80 flex items-center gap-1.5"
                                title="Edit cover image"
                            >
                                <ImageIcon className="w-3 h-3" /> Edit cover
                            </button>
                        )}
                    </div>
                )}
                {/* Staff action bar (Edit / Delete / Add cover / Lineup) — top of modal regardless of whether a cover exists. */}
                {isCoach && (
                    <div className="bg-black/30 px-4 py-2 flex items-center justify-end gap-1 border-b border-white/5">
                        {isGame && (
                            <button
                                onClick={() => setShowLineup(true)}
                                className="text-xs text-brand-green hover:text-white flex items-center gap-1.5 px-2 py-1 rounded hover:bg-brand-green/10"
                            >
                                <Users className="w-3.5 h-3.5" /> Lineup
                            </button>
                        )}
                        {!event.cover_image_url && (
                            <button
                                onClick={() => setEditingCover(true)}
                                className="text-xs text-brand-gold hover:text-white flex items-center gap-1.5 px-2 py-1 rounded hover:bg-brand-gold/10"
                            >
                                <ImageIcon className="w-3.5 h-3.5" /> Add cover
                            </button>
                        )}
                        <button
                            onClick={() => setEditingEvent(true)}
                            className="text-xs text-gray-300 hover:text-white flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5"
                        >
                            <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5 px-2 py-1 rounded hover:bg-red-500/10 disabled:opacity-50"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> {deleting ? 'Deleting…' : 'Delete'}
                        </button>
                    </div>
                )}
                {/* Parent-facing lineup button — game events only, non-staff */}
                {!isCoach && isGame && (
                    <div className="bg-black/30 px-4 py-2 flex items-center justify-end gap-1 border-b border-white/5">
                        <button
                            onClick={() => setShowLineup(true)}
                            className="text-xs text-brand-green hover:text-white flex items-center gap-1.5 px-2 py-1 rounded hover:bg-brand-green/10"
                        >
                            <Users className="w-3.5 h-3.5" /> View Lineup
                        </button>
                    </div>
                )}

                {/* Header */}
                <div className={`p-4 border-b border-white/10 flex items-center justify-between ${config.bg}`}>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-xl text-white font-bold">{event.title}</h3>
                            <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${config.bg} ${config.text}`}>{config.label}</span>
                        </div>
                        <p className="text-sm text-gray-400">
                            {format(new Date(event.start_time), 'EEEE, MMMM d, yyyy')} at {format(new Date(event.start_time), 'h:mm a')}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 overflow-y-auto max-h-[65vh] space-y-4">
                    <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {event.location_name || 'TBD'}</span>
                        {event.kit_color && (
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: event.kit_color }} />
                                Kit: {event.kit_color}
                            </span>
                        )}
                    </div>

                    {event.notes && (
                        <div className="p-3 bg-white/5 rounded-lg text-gray-300 text-sm">{event.notes}</div>
                    )}

                    {/* Live Score (games) */}
                    {event.type === 'game' && event.game_status && event.game_status !== 'scheduled' && (
                        <div className="flex items-center justify-center gap-6 py-4 bg-white/5 rounded-xl">
                            <div className="text-center">
                                <p className="text-xs text-gray-400 uppercase font-bold">Fire FC</p>
                                <p className="text-3xl font-mono font-bold text-white">{event.home_score || 0}</p>
                            </div>
                            <span className="text-xl text-gray-600">—</span>
                            <div className="text-center">
                                <p className="text-xs text-gray-400 uppercase font-bold">{event.opponent_name || 'Away'}</p>
                                <p className="text-3xl font-mono font-bold text-white">{event.away_score || 0}</p>
                            </div>
                            <span className={`ml-2 px-2 py-1 rounded-full text-xs font-bold uppercase ${
                                event.game_status === 'live' ? 'bg-green-500/20 text-green-400' :
                                event.game_status === 'halftime' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-red-500/20 text-red-400'
                            }`}>{event.game_status === 'finished' ? 'Final' : event.game_status}</span>
                        </div>
                    )}

                    {/* YouTube Embed */}
                    {event.video_url && (
                        <div className="border-t border-white/10 pt-4">
                            <h4 className="text-white font-bold flex items-center gap-2 mb-3">
                                <Video className="w-5 h-5 text-red-500" /> Game Stream
                            </h4>
                            <div className="aspect-video rounded-lg overflow-hidden bg-black">
                                <iframe src={getYouTubeEmbedUrl(event.video_url)} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="Stream" />
                            </div>
                        </div>
                    )}

                    {/* Attendance — visible to everyone (Byga-style). */}
                    <RsvpSummary eventId={event.id} teamId={event.team_id} />

                    {/* Practice Sessions */}
                    <div className="border-t border-white/10 pt-4">
                        <h4 className="text-white font-bold flex items-center gap-2 mb-3">
                            <ClipboardList className="w-5 h-5 text-brand-green" /> Practice Plans
                        </h4>
                        {loading ? (
                            <div className="text-gray-500 text-sm">Loading sessions...</div>
                        ) : sessions.length === 0 ? (
                            <div className="text-gray-500 text-sm p-4 border border-dashed border-white/10 rounded-lg text-center">
                                No practice plans attached to this event.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {sessions.map(session => {
                                    const drills = parseDrills(session);
                                    return (
                                        <div key={session.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <h5 className="text-white font-bold">{session.name}</h5>
                                                <span className="text-xs text-gray-400">{session.total_duration} min</span>
                                            </div>
                                            {drills.length > 0 && (
                                                <div className="space-y-1 mt-2">
                                                    {drills.map((drill, idx) => (
                                                        <div key={idx} className="flex items-center justify-between text-sm py-1 border-b border-white/5 last:border-0">
                                                            <span className="text-gray-300">{idx + 1}. {drill.name || drill.title}</span>
                                                            <span className="text-gray-500">{drill.duration}m</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {/* "Run Session" hidden for now — surface only on the
                                                training day in a future change. */}
                                            {false && (
                                                <button
                                                    onClick={() => handleStartSession(session)}
                                                    className="mt-3 w-full py-2 bg-brand-green/20 text-brand-green rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-brand-green/30 transition-colors"
                                                >
                                                    <Play className="w-4 h-4" /> Run Session
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Edit-cover modal (staff only) */}
            {editingCover && (
                <Suspense fallback={null}>
                    <EventCoverDesigner
                        modal
                        event={{
                            id: event.id,
                            team_id: event.team_id,
                            type: event.type,
                            title: event.title,
                            start_time: event.start_time,
                            location_name: event.location_name,
                            opponent_name: event.opponent_name,
                            kit_color: event.kit_color,
                            team_name: 'ROCKFORD FIRE',
                        }}
                        initial={event.cover_template || undefined}
                        onSaved={handleCoverSaved}
                        onCancel={() => setEditingCover(false)}
                    />
                </Suspense>
            )}

            {/* Edit-event modal (staff only) — reuses CreateEventModal in edit mode */}
            {editingEvent && (
                <Suspense fallback={null}>
                    <CreateEventModal
                        existingEvent={event}
                        onClose={() => setEditingEvent(false)}
                        onEventCreated={(updated) => {
                            setEvent(updated);
                            setEditingEvent(false);
                            onEventChanged?.(updated);
                        }}
                    />
                </Suspense>
            )}

            {/* Lineup builder — game events only. Staff can edit; everyone else views. */}
            {showLineup && (
                <Suspense fallback={null}>
                    <LineupBuilder event={event} onClose={() => setShowLineup(false)} />
                </Suspense>
            )}
        </div>
    );
};

export default EventDetailModal;
