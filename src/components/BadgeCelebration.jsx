import React, { useEffect, useState } from 'react';

const BadgeCelebration = ({ badge, onClose }) => {
    const [phase, setPhase] = useState('envelope'); // envelope -> opening -> reveal -> collect
    const [particles, setParticles] = useState([]);

    useEffect(() => {
        // Create sparkle particles
        const newParticles = Array.from({ length: 20 }, (_, i) => ({
            id: i,
            x: 50 + (Math.random() - 0.5) * 40,
            y: 50 + (Math.random() - 0.5) * 40,
            delay: Math.random() * 0.5,
            size: 8 + Math.random() * 16,
        }));
        setParticles(newParticles);

        // Phase 1: Envelope appears and pulses (1.5s)
        const timer1 = setTimeout(() => {
            setPhase('opening');
        }, 1500);

        // Phase 2: Envelope opens (after 2s)
        const timer2 = setTimeout(() => {
            setPhase('reveal');
        }, 2500);

        // Phase 3: Badge revealed (after 3.5s)
        const timer3 = setTimeout(() => {
            setPhase('collect');
        }, 6000);

        // Close (after 7.5s)
        const timer4 = setTimeout(() => {
            onClose();
        }, 7500);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
            clearTimeout(timer4);
        };
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-auto" onClick={onClose}>
            {/* Dark overlay with gradient */}
            <div className={`absolute inset-0 bg-gradient-to-b from-black/90 via-black/85 to-black/90 backdrop-blur-sm transition-opacity duration-500 ${
                phase === 'collect' ? 'opacity-0' : 'opacity-100'
            }`} />

            {/* Glowing aura behind envelope */}
            {(phase === 'envelope' || phase === 'opening') && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-80 h-80 bg-brand-gold/20 rounded-full blur-[80px] animate-glow-pulse" />
                </div>
            )}

            {/* Envelope Container */}
            {(phase === 'envelope' || phase === 'opening' || phase === 'reveal') && phase !== 'collect' && (
                <div className={`relative z-10 transition-all duration-1000 ${
                    phase === 'envelope' ? 'scale-100 animate-envelope-pulse' :
                    phase === 'opening' ? 'scale-110' :
                    'scale-90 opacity-0'
                }`}>
                    {/* Envelope */}
                    <div className={`relative w-80 h-56 transition-transform duration-700 ${
                        phase === 'opening' || phase === 'reveal' ? 'envelope-opened' : ''
                    }`}>
                        {/* Envelope back */}
                        <div className="absolute inset-0 bg-gradient-to-b from-[#c4a35a] to-[#a08040] rounded-lg shadow-2xl border-2 border-[#d4b36a]" />

                        {/* Envelope flap (top) */}
                        <div className={`absolute top-0 left-0 right-0 origin-top transition-transform duration-700 ${
                            phase === 'opening' || phase === 'reveal' ? 'flap-open' : ''
                        }`}>
                            <svg viewBox="0 0 320 140" className="w-full">
                                <defs>
                                    <linearGradient id="flapGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stopColor="#d4c08a" />
                                        <stop offset="100%" stopColor="#b89850" />
                                    </linearGradient>
                                </defs>
                                <path
                                    d="M 0 0 L 160 100 L 320 0 L 320 8 L 0 8 Z"
                                    fill="url(#flapGradient)"
                                    stroke="#a08040"
                                    strokeWidth="2"
                                />
                                {/* Seal */}
                                <circle cx="160" cy="60" r="25" fill="#c41e3a" stroke="#8b0000" strokeWidth="2" />
                                <text x="160" y="67" textAnchor="middle" fill="#ffd700" fontSize="20" fontWeight="bold">FC</text>
                            </svg>
                        </div>

                        {/* Fire FC Logo watermark */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                            <img src="/branding/logo.png" alt="" className="w-24 h-24 object-contain" />
                        </div>

                        {/* Sparkle particles */}
                        {phase === 'opening' && particles.map(p => (
                            <div
                                key={p.id}
                                className="absolute rounded-full bg-yellow-300 animate-sparkle"
                                style={{
                                    left: `${p.x}%`,
                                    top: `${p.y}%`,
                                    width: p.size,
                                    height: p.size,
                                    animationDelay: `${p.delay}s`,
                                    boxShadow: '0 0 10px #ffd700, 0 0 20px #ffd700',
                                }}
                            />
                        ))}
                    </div>

                    {/* Text below envelope */}
                    <div className={`text-center mt-6 transition-opacity duration-500 ${
                        phase === 'envelope' ? 'opacity-100' : 'opacity-0'
                    }`}>
                        <p className="text-brand-gold text-lg font-bold uppercase tracking-widest animate-pulse">
                            You received a badge!
                        </p>
                        <p className="text-gray-400 text-sm mt-1">Tap to open</p>
                    </div>
                </div>
            )}

            {/* Badge Reveal */}
            {phase === 'reveal' && (
                <div className="absolute inset-0 flex items-center justify-center z-20">
                    <div className="text-center animate-badge-reveal">
                        {/* Glowing background */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-96 h-96 bg-brand-gold/30 rounded-full blur-[100px] animate-pulse" />
                        </div>

                        {/* Badge icon */}
                        <div className="relative">
                            <div className="text-[180px] filter drop-shadow-[0_0_60px_rgba(255,215,0,0.9)] animate-badge-bounce">
                                {badge?.icon || '🏆'}
                            </div>

                            {/* Sparkles around badge */}
                            <div className="absolute -top-8 -left-8 text-4xl animate-spin-slow">✨</div>
                            <div className="absolute -top-4 -right-4 text-3xl animate-ping">⭐</div>
                            <div className="absolute -bottom-4 left-2 text-4xl animate-bounce">🔥</div>
                            <div className="absolute top-1/2 -right-8 text-3xl animate-pulse">💫</div>
                        </div>

                        {/* Text */}
                        <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-brand-gold via-yellow-400 to-orange-500 mt-6">
                            NEW BADGE!
                        </h1>
                        <h2 className="text-3xl md:text-4xl font-bold text-white mt-3 font-display uppercase">
                            {badge?.name || 'Achievement Unlocked'}
                        </h2>
                        <p className="text-gray-300 mt-3 text-lg max-w-md mx-auto">
                            {badge?.description || 'You earned a new badge!'}
                        </p>
                    </div>
                </div>
            )}

            {/* Badge flying to trophy case */}
            {phase === 'collect' && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-8xl animate-collect-badge">
                        {badge?.icon || '🏆'}
                    </div>
                </div>
            )}

            {/* CSS Animations */}
            <style>{`
                @keyframes envelope-pulse {
                    0%, 100% {
                        transform: scale(1);
                        filter: drop-shadow(0 0 20px rgba(212, 175, 55, 0.5));
                    }
                    50% {
                        transform: scale(1.02);
                        filter: drop-shadow(0 0 40px rgba(212, 175, 55, 0.8));
                    }
                }

                @keyframes glow-pulse {
                    0%, 100% {
                        opacity: 0.3;
                        transform: scale(1);
                    }
                    50% {
                        opacity: 0.6;
                        transform: scale(1.1);
                    }
                }

                @keyframes sparkle {
                    0% {
                        transform: scale(0) rotate(0deg);
                        opacity: 0;
                    }
                    50% {
                        transform: scale(1) rotate(180deg);
                        opacity: 1;
                    }
                    100% {
                        transform: scale(0) rotate(360deg);
                        opacity: 0;
                    }
                }

                @keyframes badge-reveal {
                    0% {
                        transform: scale(0) translateY(50px);
                        opacity: 0;
                    }
                    60% {
                        transform: scale(1.1) translateY(-10px);
                    }
                    100% {
                        transform: scale(1) translateY(0);
                        opacity: 1;
                    }
                }

                @keyframes badge-bounce {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    25% { transform: translateY(-15px) rotate(-3deg); }
                    75% { transform: translateY(-15px) rotate(3deg); }
                }

                @keyframes collect-badge {
                    0% {
                        transform: scale(1) translate(0, 0);
                        opacity: 1;
                    }
                    100% {
                        transform: scale(0.15) translate(calc(50vw - 80px), calc(-50vh + 80px));
                        opacity: 0;
                    }
                }

                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .animate-envelope-pulse {
                    animation: envelope-pulse 1.5s ease-in-out infinite;
                }

                .animate-glow-pulse {
                    animation: glow-pulse 2s ease-in-out infinite;
                }

                .animate-sparkle {
                    animation: sparkle 0.8s ease-out forwards;
                }

                .animate-badge-reveal {
                    animation: badge-reveal 0.8s ease-out forwards;
                }

                .animate-badge-bounce {
                    animation: badge-bounce 1.5s ease-in-out infinite;
                }

                .animate-collect-badge {
                    animation: collect-badge 1.5s ease-in-out forwards;
                }

                .animate-spin-slow {
                    animation: spin-slow 4s linear infinite;
                }

                .flap-open {
                    transform: rotateX(-180deg);
                }

                .envelope-opened {
                    transform: translateY(-30px);
                }
            `}</style>
        </div>
    );
};

export default BadgeCelebration;
