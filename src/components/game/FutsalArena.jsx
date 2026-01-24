import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Timer, Zap, Target, X, Play } from 'lucide-react';
import { triggerMessiMode } from '../../utils/messiMode';

const FutsalArena = ({ onClose }) => {
    const [gameState, setGameState] = useState('start'); // start, playing, goal, gameover
    const [score, setScore] = useState({ us: 0, them: 0 });
    const [timeLeft, setTimeLeft] = useState(60);
    const [energy, setEnergy] = useState(0);
    const [ballPos, setBallPos] = useState({ x: 50, y: 50 }); // Percentage
    const [possession, setPossession] = useState('us'); // us, them

    // Mock Players
    const myTeam = [
        { id: 'p1', name: 'Bo', x: 50, y: 80, role: 'ST' },
        { id: 'p2', name: 'Leo', x: 25, y: 60, role: 'LW' },
        { id: 'p3', name: 'CR7', x: 75, y: 60, role: 'RW' },
    ];

    const enemyTeam = [
        { id: 'e1', name: 'GK', x: 50, y: 10, role: 'GK' },
        { id: 'e2', name: 'CB', x: 35, y: 30, role: 'DEF' },
        { id: 'e3', name: 'CB', x: 65, y: 30, role: 'DEF' },
    ];

    useEffect(() => {
        let interval;
        if (gameState === 'playing') {
            interval = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        setGameState('gameover');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [gameState]);

    const handleAction = (type, target) => {
        if (gameState !== 'playing') return;

        if (type === 'pass') {
            setBallPos({ x: target.x, y: target.y });
            setEnergy(prev => Math.min(prev + 20, 100));
            // Trigger move
        } else if (type === 'shoot') {
            // Simple logic: If energy > 50, higher chance
            const success = Math.random() > 0.4 || energy === 100;
            setBallPos({ x: 50, y: 5 }); // Goal pos

            if (success) {
                setTimeout(() => {
                    setScore(prev => ({ ...prev, us: prev.us + 1 }));
                    setGameState('goal');
                    triggerMessiMode();
                    setTimeout(() => {
                        setGameState('playing');
                        setBallPos({ x: 50, y: 50 });
                        setEnergy(0);
                    }, 3000);
                }, 500);
            } else {
                // Save
                setTimeout(() => {
                    setBallPos({ x: 50, y: 20 }); // Blocked
                    setPossession('them');
                    setTimeout(() => {
                        setPossession('us'); // Auto recover for demo
                        setBallPos({ x: 50, y: 80 });
                    }, 2000);
                }, 500);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-lg flex items-center justify-center p-4">
            <div className="w-full max-w-4xl h-[80vh] bg-brand-dark/50 rounded-3xl border-2 border-brand-green/30 relative overflow-hidden flex flex-col shadow-[0_0_100px_rgba(204,255,0,0.1)] animate-scale-up">

                {/* HUD */}
                <div className="absolute top-0 left-0 right-0 z-20 p-6 flex justify-between items-start pointer-events-none">
                    <div className="glass-panel px-6 py-3 rounded-full flex gap-8">
                        <div className="flex flex-col items-center">
                            <span className="text-brand-green font-black text-2xl leading-none">{score.us}</span>
                            <span className="text-xs text-gray-500 font-bold">FIRE FC</span>
                        </div>
                        <div className="text-white font-mono text-xl opacity-50">:</div>
                        <div className="flex flex-col items-center">
                            <span className="text-red-500 font-black text-2xl leading-none">{score.them}</span>
                            <span className="text-xs text-gray-500 font-bold">TIGERS</span>
                        </div>
                    </div>

                    <div className="glass-panel px-4 py-2 rounded-full flex items-center gap-2">
                        <Timer className={`w-5 h-5 ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-white'}`} />
                        <span className="text-xl font-mono font-bold text-white">{timeLeft}s</span>
                    </div>

                    <button onClick={onClose} className="bg-white/10 hover:bg-red-500 pointer-events-auto p-2 rounded-full transition-colors">
                        <X className="w-6 h-6 text-white" />
                    </button>
                </div>

                {/* Energy Bar */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 w-64 h-2 bg-gray-800 rounded-full overflow-hidden border border-white/10">
                    <div
                        className={`h-full transition-all duration-300 ${energy === 100 ? 'bg-brand-gold animate-pulse' : 'bg-brand-green'}`}
                        style={{ width: `${energy}%` }}
                    ></div>
                </div>
                {energy === 100 && (
                    <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                        <span className="text-brand-gold font-black text-sm uppercase tracking-widest animate-bounce drop-shadow-[0_0_10px_rgba(212,175,55,0.8)]">
                            Messi Mode Ready!
                        </span>
                    </div>
                )}

                {/* Game Board */}
                <div className="flex-1 relative bg-[#0a200a] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-900/20 to-black overflow-hidden perspective-1000">

                    {/* Pitch Lines */}
                    <div className="absolute inset-4 border-2 border-white/10 rounded-xl opacity-50 box-shadow-[0_0_20px_rgba(255,255,255,0.1)]"></div>
                    <div className="absolute top-1/2 left-4 right-4 h-px bg-white/10"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-white/10 rounded-full"></div>
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-48 h-24 border-2 border-white/10 border-t-0 rounded-b-xl"></div>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-48 h-24 border-2 border-white/10 border-b-0 rounded-t-xl"></div>

                    {/* START SCREEN */}
                    {gameState === 'start' && (
                        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/60 backdrop-blur-sm">
                            <button
                                onClick={() => setGameState('playing')}
                                className="group relative px-8 py-4 bg-brand-green overflow-hidden rounded-xl animate-bounce-in"
                            >
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                                <span className="relative flex items-center gap-3 text-brand-dark font-black text-2xl uppercase tracking-wider">
                                    <Play className="w-8 h-8 fill-current" /> Kick Off
                                </span>
                            </button>
                        </div>
                    )}

                    {/* GOAL OVERLAY */}
                    {gameState === 'goal' && (
                        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                            <h1 className="text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-brand-gold to-yellow-600 italic uppercase transform -rotate-12 animate-zoom-in drop-shadow-[0_0_50px_rgba(212,175,55,0.5)]">
                                GOAL!
                            </h1>
                        </div>
                    )}

                    {/* GAME OVER */}
                    {gameState === 'gameover' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/80 backdrop-blur-sm">
                            <h2 className="text-4xl text-white font-bold uppercase mb-4">Full Time</h2>
                            <div className="text-6xl font-black text-brand-green mb-8">{score.us} - {score.them}</div>
                            <button
                                onClick={() => {
                                    setGameState('playing');
                                    setTimeLeft(60);
                                    setScore({ us: 0, them: 0 });
                                    setEnergy(0);
                                }}
                                className="px-8 py-3 bg-brand-gold text-brand-dark font-bold uppercase rounded hover:bg-white transition-colors"
                            >
                                Play Again
                            </button>
                        </div>
                    )}

                    {/* PLAYERS & BALL */}
                    <div className="absolute inset-0 transform-gpu preserve-3d">

                        {/* Ball */}
                        <div
                            className="absolute w-4 h-4 bg-white rounded-full shadow-[0_0_15px_white] z-10 transition-all duration-300 ease-out"
                            style={{
                                left: `${ballPos.x}%`,
                                top: `${ballPos.y}%`,
                                transform: 'translate(-50%, -50%)'
                            }}
                        ></div>

                        {/* My Team */}
                        {myTeam.map(p => (
                            <button
                                key={p.id}
                                onClick={() => handleAction('pass', p)}
                                className={`absolute w-12 h-12 -translate-x-1/2 -translate-y-1/2 transition-all duration-500 flex flex-col items-center group ${gameState === 'playing' ? 'cursor-pointer hover:scale-110' : ''}`}
                                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                            >
                                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-xs bg-brand-dark ${possession === 'us' ? 'border-brand-green text-brand-green shadow-[0_0_15px_#ccff00]' : 'border-gray-500 text-gray-500'}`}>
                                    {p.name.charAt(0)}
                                </div>
                                <div className="mt-1 opacity-0 group-hover:opacity-100 bg-black/50 px-2 py-0.5 rounded text-[10px] text-white uppercase font-bold transition-opacity whitespace-nowrap">
                                    Click to Pass
                                </div>
                                {/* Selection Ring (if ball carrier) */}
                                {Math.abs(ballPos.x - p.x) < 5 && Math.abs(ballPos.y - p.y) < 5 && (
                                    <div className="absolute -inset-2 border-2 border-dashed border-brand-green/50 rounded-full animate-spin-slow pointer-events-none"></div>
                                )}
                            </button>
                        ))}

                        {/* Enemy Team */}
                        {enemyTeam.map(p => (
                            <div
                                key={p.id}
                                className="absolute w-12 h-12 -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-in-out flex flex-col items-center pointer-events-none"
                                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                            >
                                <div className="w-10 h-10 rounded-full border-2 border-red-500 bg-red-900/50 flex items-center justify-center font-bold text-xs text-red-200">
                                    {p.name}
                                </div>
                            </div>
                        ))}

                        {/* Shoot Button (Top Goal Area) */}
                        {possession === 'us' && (
                            <button
                                onClick={() => handleAction('shoot')}
                                className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-20 z-0 group"
                            >
                                <div className="w-full h-full bg-gradient-to-b from-brand-gold/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-center pt-2">
                                    <span className="text-brand-gold font-bold uppercase text-xs tracking-widest animate-pulse"><Target className="w-4 h-4 inline" /> Shoot</span>
                                </div>
                            </button>
                        )}

                    </div>
                </div>

                {/* Instructions Footer */}
                <div className="bg-black/80 px-6 py-4 flex justify-between items-center text-xs text-gray-400 font-mono border-t border-white/5">
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full border border-brand-green bg-brand-dark flex items-center justify-center text-[8px] text-brand-green font-bold">L</span> Click Teammate to Pass</span>
                        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full border border-brand-gold bg-brand-dark flex items-center justify-center text-[8px] text-brand-gold font-bold">R</span> Click Goal Area to Shoot</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Zap className="w-3 h-3 text-brand-gold" /> Build Energy for Sure Goal
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FutsalArena;
