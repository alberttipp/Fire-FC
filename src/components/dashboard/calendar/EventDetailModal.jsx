import React, { useState, useEffect } from 'react';
import { X, MapPin, Shirt, ClipboardList, Play, Video } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../../supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { getEventConfig } from './constants';
import RsvpSummary from './RsvpSummary';

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

const EventDetailModal = ({ event, onClose, onStartSession }) => {
    const { profile } = useAuth();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const config = getEventConfig(event.type);
    const isCoach = profile?.role === 'coach' || profile?.role === 'manager';

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
        if (drills.length === 0) { alert('No drills in this session'); return; }
        onStartSession({ ...session, drills });
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-end md:items-center justify-center md:p-4 z-50" onClick={onClose}>
            <div className="bg-brand-dark border border-white/10 rounded-t-2xl md:rounded-xl w-full md:max-w-2xl h-[90vh] md:h-auto md:max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
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

                    {/* RSVP Summary (coach view) */}
                    {isCoach && <RsvpSummary eventId={event.id} />}

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
        </div>
    );
};

export default EventDetailModal;
