import React, { useState, useEffect } from 'react';
import { X, Mic, StopCircle, Save, Star, ChevronLeft, Volume2, Wand2 } from 'lucide-react';

const ScoutCard = ({ player, onClose }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [notes, setNotes] = useState([
        { id: 1, text: "Good first touch under pressure.", author: "Coach Mike", time: "10:15 AM", type: "manual" }
    ]);
    const [transcript, setTranscript] = useState("");
    const [processing, setProcessing] = useState(false);

    // Mock Rating State
    const [rating, setRating] = useState({
        technical: 3,
        tactical: 3,
        physical: 3,
        mental: 3
    });

    // Mock AI Simulation
    useEffect(() => {
        let interval;
        if (isRecording) {
            const mockPhrases = [
                "Player shows excellent speed...",
                " struggling with the left foot...",
                " good vision on that pass...",
                " needs to track back more..."
            ];
            let i = 0;
            interval = setInterval(() => {
                setTranscript(prev => prev + mockPhrases[i % mockPhrases.length]);
                i++;
            }, 2000);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    const handleToggleRecord = () => {
        if (isRecording) {
            // Stop Recording
            setIsRecording(false);
            setProcessing(true);

            // Simulate AI Processing
            setTimeout(() => {
                setNotes(prev => [...prev, {
                    id: Date.now(),
                    text: transcript || "Great defensive positioning in 1v1 situations.", // Fallback if short
                    author: "AI Assistant",
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    type: "voice"
                }]);
                setTranscript("");
                setProcessing(false);
            }, 1500);
        } else {
            // Start Recording
            setIsRecording(true);
            setTranscript("");
        }
    };

    return (
        <div className="flex flex-col h-full relative">
            {/* Header / Nav (Mobile only back button) */}
            <div className="md:hidden p-4 border-b border-white/10 flex items-center gap-2">
                <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <span className="text-white font-bold uppercase">Back to List</span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">

                {/* Player Header */}
                <div className="flex items-start justify-between mb-8">
                    <div className="flex gap-4">
                        <div className="w-20 h-20 bg-gray-800 rounded-lg flex items-center justify-center border-2 border-white/10 overflow-hidden relative">
                            {/* Placeholder silhouette */}
                            <UsersIcon className="w-12 h-12 text-gray-600" />
                            <div className="absolute top-1 right-1 bg-brand-gold text-brand-dark text-xs font-bold px-1 rounded">{player.rating}</div>
                        </div>
                        <div>
                            <h2 className="text-3xl text-white font-display uppercase font-bold tracking-wider leading-none">{player.name}</h2>
                            <div className="flex items-center gap-3 mt-2 text-sm">
                                <span className="bg-white/10 px-2 py-0.5 rounded text-white font-bold">{player.position}</span>
                                <span className="text-gray-400">#{player.number}</span>
                                <span className="text-gray-400">Age: 9</span>
                            </div>
                        </div>
                    </div>
                    {/* Overall Grade */}
                    <div className="text-center">
                        <div className="text-4xl font-bold text-brand-green">B+</div>
                        <div className="text-xs text-gray-500 uppercase tracking-widest">Projected</div>
                    </div>
                </div>

                {/* Quick Rating Grid */}
                <div className="mb-8 p-4 bg-black/20 rounded-xl border border-white/5">
                    <h4 className="text-gray-400 text-xs uppercase font-bold mb-4 tracking-wider">Quick Grade</h4>
                    <div className="grid grid-cols-2 gap-4">
                        {Object.keys(rating).map(cat => (
                            <div key={cat} className="flex items-center justify-between">
                                <span className="text-sm text-gray-300 capitalize">{cat}</span>
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button
                                            key={star}
                                            onClick={() => setRating(prev => ({ ...prev, [cat]: star }))}
                                            className={`w-2 h-6 rounded-sm transition-colors ${rating[cat] >= star ? 'bg-brand-green' : 'bg-gray-800'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Notes Feed */}
                <div className="space-y-4 mb-20">
                    <h4 className="text-gray-400 text-xs uppercase font-bold mb-2 tracking-wider flex items-center gap-2">
                        Scouting Report <span className="bg-brand-gold text-brand-dark px-1.5 rounded-full text-[10px]">{notes.length}</span>
                    </h4>

                    {notes.map(note => (
                        <div key={note.id} className={`p-4 rounded-xl border ${note.type === 'voice' ? 'bg-brand-green/5 border-brand-green/20' : 'bg-white/5 border-white/10'}`}>
                            <div className="flex justify-between items-center mb-2">
                                <span className={`text-xs font-bold uppercase ${note.type === 'voice' ? 'text-brand-green' : 'text-brand-gold'}`}>
                                    {note.type === 'voice' && <Mic className="w-3 h-3 inline mr-1" />}
                                    {note.author}
                                </span>
                                <span className="text-[10px] text-gray-500">{note.time}</span>
                            </div>
                            <p className="text-sm text-gray-200 leading-relaxed">{note.text}</p>
                        </div>
                    ))}

                    {/* Live Transcript */}
                    {isRecording && (
                        <div className="p-4 rounded-xl border border-brand-gold/30 bg-brand-gold/5 animate-pulse">
                            <div className="flex items-center gap-2 mb-2 text-brand-gold text-xs font-bold uppercase">
                                <div className="w-2 h-2 bg-brand-red rounded-full animate-ping"></div>
                                Listening...
                            </div>
                            <p className="text-sm text-white/80 italic">"{transcript}"</p>
                        </div>
                    )}

                    {processing && (
                        <div className="p-4 rounded-xl border border-white/10 bg-black/40 flex items-center justify-center gap-3 text-sm text-gray-300">
                            <Wand2 className="w-4 h-4 animate-spin text-brand-green" /> AI Cleaning & Summarizing...
                        </div>
                    )}
                </div>

            </div>

            {/* Voice Control Footer */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-brand-dark/95 backdrop-blur border-t border-white/10 flex items-center gap-4">
                <button
                    onClick={handleToggleRecord}
                    className={`flex-1 py-4 rounded-xl font-bold uppercase tracking-wider flex items-center justify-center gap-3 transition-all ${isRecording ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-brand-green hover:bg-blue-400 text-white shadow-[0_0_20px_rgba(59,130,246,0.2)]'}`}
                >
                    {isRecording ? (
                        <> <StopCircle className="w-6 h-6 fill-current" /> Stop & Process </>
                    ) : (
                        <> <Mic className="w-6 h-6" /> Voice Note </>
                    )}
                </button>

                <button className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 text-white transition-colors">
                    <Save className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
};

// Simple Placeholder Icon
const UsersIcon = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
    </svg>
);

export default ScoutCard;
