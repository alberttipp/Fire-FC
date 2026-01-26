import React, { useEffect, useState } from 'react';

const BadgeCelebration = ({ badge, onClose }) => {
    const [phase, setPhase] = useState('shake'); // shake -> rain -> popup -> collect
    const [particles, setParticles] = useState([]);

    useEffect(() => {
        // Create particles for badge rain
        const newParticles = Array.from({ length: 30 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            delay: Math.random() * 1,
            duration: 2 + Math.random() * 2,
            rotation: Math.random() * 360,
            icon: ['🏆', '⭐', '🔥', '⚽', '🎯', '💪'][Math.floor(Math.random() * 6)]
        }));
        setParticles(newParticles);

        // Phase 1: Screen shake (500ms)
        document.body.style.animation = 'shake 0.5s ease-in-out';

        // Phase 2: Badge rain (after 500ms)
        const timer1 = setTimeout(() => {
            setPhase('rain');
            document.body.style.animation = '';
        }, 500);

        // Phase 3: Big popup (after 2.5s)
        const timer2 = setTimeout(() => {
            setPhase('popup');
        }, 2500);

        // Phase 4: Collect to trophy case (after 5s)
        const timer3 = setTimeout(() => {
            setPhase('collect');
        }, 5000);

        // Close (after 6.5s)
        const timer4 = setTimeout(() => {
            onClose();
        }, 6500);

        return () => {
            document.body.style.animation = '';
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
            clearTimeout(timer4);
        };
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[200] pointer-events-none">
            {/* Dark overlay */}
            <div className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-500 ${
                phase === 'collect' ? 'opacity-0' : 'opacity-100'
            }`} />

            {/* Raining badges/particles */}
            {(phase === 'rain' || phase === 'popup') && (
                <div className="absolute inset-0 overflow-hidden">
                    {particles.map(particle => (
                        <div
                            key={particle.id}
                            className="absolute text-4xl animate-fall"
                            style={{
                                left: `${particle.x}%`,
                                animationDelay: `${particle.delay}s`,
                                animationDuration: `${particle.duration}s`,
                            }}
                        >
                            {particle.icon}
                        </div>
                    ))}
                </div>
            )}

            {/* Giant badge popup */}
            {phase === 'popup' && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center animate-badge-popup">
                        {/* Glowing background */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-96 h-96 bg-brand-gold/30 rounded-full blur-[100px] animate-pulse" />
                        </div>

                        {/* Badge icon */}
                        <div className="relative">
                            <div className="text-[200px] filter drop-shadow-[0_0_50px_rgba(255,215,0,0.8)] animate-bounce-slow">
                                {badge?.icon || '🏆'}
                            </div>

                            {/* Sparkles around badge */}
                            <div className="absolute -top-10 -left-10 text-4xl animate-spin-slow">✨</div>
                            <div className="absolute -top-5 -right-5 text-3xl animate-ping">⭐</div>
                            <div className="absolute -bottom-5 left-0 text-4xl animate-bounce">🔥</div>
                            <div className="absolute top-1/2 -right-10 text-3xl animate-pulse">💫</div>
                        </div>

                        {/* Text */}
                        <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-brand-gold via-yellow-400 to-orange-500 mt-4 animate-pulse">
                            NEW BADGE!
                        </h1>
                        <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">
                            {badge?.name || 'Achievement Unlocked'}
                        </h2>
                        <p className="text-gray-400 mt-2 text-lg max-w-md mx-auto">
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
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
                    20%, 40%, 60%, 80% { transform: translateX(10px); }
                }

                @keyframes fall {
                    0% {
                        transform: translateY(-100px) rotate(0deg);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(110vh) rotate(720deg);
                        opacity: 0;
                    }
                }

                @keyframes badge-popup {
                    0% {
                        transform: scale(0) rotate(-180deg);
                        opacity: 0;
                    }
                    50% {
                        transform: scale(1.2) rotate(10deg);
                    }
                    100% {
                        transform: scale(1) rotate(0deg);
                        opacity: 1;
                    }
                }

                @keyframes collect-badge {
                    0% {
                        transform: scale(1) translate(0, 0);
                        opacity: 1;
                    }
                    100% {
                        transform: scale(0.2) translate(calc(50vw - 50px), calc(-50vh + 50px));
                        opacity: 0;
                    }
                }

                @keyframes bounce-slow {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-20px); }
                }

                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .animate-fall {
                    animation: fall linear forwards;
                }

                .animate-badge-popup {
                    animation: badge-popup 0.8s ease-out forwards;
                }

                .animate-collect-badge {
                    animation: collect-badge 1.5s ease-in-out forwards;
                }

                .animate-bounce-slow {
                    animation: bounce-slow 1s ease-in-out infinite;
                }

                .animate-spin-slow {
                    animation: spin-slow 3s linear infinite;
                }
            `}</style>
        </div>
    );
};

export default BadgeCelebration;
