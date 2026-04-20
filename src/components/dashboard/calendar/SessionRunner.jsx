import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, SkipForward, RotateCcw, Volume2, VolumeX } from 'lucide-react';

const SessionRunner = ({ session, onClose }) => {
    const [isRunning, setIsRunning] = useState(false);
    const [currentDrillIndex, setCurrentDrillIndex] = useState(0);
    const [timeRemaining, setTimeRemaining] = useState((session.drills[0]?.duration || 1) * 60);
    const [alarmsEnabled, setAlarmsEnabled] = useState(true);
    const timerRef = useRef(null);

    const playAlarm = () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.value = 0.3;
            osc.start();
            setTimeout(() => { osc.stop(); ctx.close(); }, 500);
        } catch (e) {}
    };

    useEffect(() => {
        if (isRunning && timeRemaining > 0) {
            timerRef.current = setInterval(() => {
                setTimeRemaining(prev => {
                    if (prev <= 1) {
                        if (alarmsEnabled) playAlarm();
                        if (currentDrillIndex < session.drills.length - 1) {
                            setCurrentDrillIndex(i => i + 1);
                            return session.drills[currentDrillIndex + 1].duration * 60;
                        } else {
                            setIsRunning(false);
                            if (alarmsEnabled) setTimeout(() => playAlarm(), 300);
                            return 0;
                        }
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timerRef.current);
    }, [isRunning, timeRemaining, currentDrillIndex, alarmsEnabled]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-brand-dark via-gray-900 to-black flex flex-col items-center justify-center z-50">
            <button onClick={() => { onClose(); }} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white">
                <X className="w-8 h-8" />
            </button>

            <div className="absolute top-4 left-4">
                <h2 className="text-white font-bold text-xl">{session.name}</h2>
                <p className="text-gray-400 text-sm">Drill {currentDrillIndex + 1} of {session.drills.length}</p>
            </div>

            <button onClick={() => setAlarmsEnabled(!alarmsEnabled)} className="absolute top-4 right-16 p-2 text-gray-400 hover:text-white">
                {alarmsEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </button>

            <div className="text-center mb-8">
                <h3 className="text-4xl md:text-6xl text-white font-bold mb-2">
                    {session.drills[currentDrillIndex]?.name || session.drills[currentDrillIndex]?.title}
                </h3>
                {session.drills[currentDrillIndex]?.custom && <span className="text-brand-gold text-sm">[Custom Drill]</span>}
            </div>

            <div className={`text-9xl md:text-[12rem] font-mono font-bold mb-12 ${timeRemaining <= 10 ? 'text-red-500 animate-pulse' : 'text-brand-green'}`}>
                {formatTime(timeRemaining)}
            </div>

            <div className="flex gap-6">
                <button
                    onClick={() => { setCurrentDrillIndex(0); setTimeRemaining(session.drills[0].duration * 60); setIsRunning(false); }}
                    className="p-4 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
                >
                    <RotateCcw className="w-8 h-8" />
                </button>
                <button onClick={() => setIsRunning(!isRunning)} className="p-8 bg-brand-green rounded-full text-brand-dark hover:bg-brand-green/90 transition-colors">
                    {isRunning ? <Pause className="w-16 h-16" /> : <Play className="w-16 h-16" />}
                </button>
                <button
                    onClick={() => {
                        if (currentDrillIndex < session.drills.length - 1) {
                            setCurrentDrillIndex(i => i + 1);
                            setTimeRemaining(session.drills[currentDrillIndex + 1].duration * 60);
                            setIsRunning(false);
                        }
                    }}
                    disabled={currentDrillIndex >= session.drills.length - 1}
                    className="p-4 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors disabled:opacity-30"
                >
                    <SkipForward className="w-8 h-8" />
                </button>
            </div>

            <div className="absolute bottom-20 left-8 right-8">
                <div className="flex gap-2">
                    {session.drills.map((_, idx) => (
                        <div key={idx} className={`h-2 flex-1 rounded-full transition-colors ${idx < currentDrillIndex ? 'bg-brand-green' : idx === currentDrillIndex ? 'bg-brand-gold' : 'bg-white/20'}`} />
                    ))}
                </div>
            </div>

            <div className="absolute bottom-4 left-8 right-8">
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {session.drills.slice(currentDrillIndex + 1, currentDrillIndex + 4).map((drill, idx) => (
                        <div key={idx} className="flex-shrink-0 px-3 py-1 bg-white/10 rounded text-xs text-gray-400">
                            {drill.name || drill.title} ({drill.duration}m)
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SessionRunner;
