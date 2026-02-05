import React, { useState } from 'react';
import { Shield, Star, TrendingUp } from 'lucide-react';

const PlayerCard = ({ player, onClick, showBack = false }) => {
    const [isFlipped, setIsFlipped] = useState(false);

    // Default values if no player provided
    const {
        name = "Alex Morgan",
        position = "ST",
        number = "13",
        rating = 88,
        pace = 92,
        shooting = 89,
        passing = 82,
        dribbling = 90,
        defending = 45,
        physical = 78,
        messiMode = false,
        image = "https://images.unsplash.com/photo-1511886929837-354d827aae26?q=80&w=1000&auto=format&fit=crop"
    } = player || {};

    const handleClick = () => {
        if (onClick) {
            // Flip animation then call onClick
            setIsFlipped(true);
            setTimeout(() => {
                onClick();
                // Reset flip after modal opens
                setTimeout(() => setIsFlipped(false), 300);
            }, 600);
        }
    };

    return (
        <div
            onClick={handleClick}
            className={`relative w-80 h-[480px] group font-sans select-none ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
            style={{ perspective: '1000px' }}
        >
            {/* Messi Mode Badge Overlay */}
            {messiMode && (
                <div className="absolute -top-8 -right-8 z-50 w-28 h-28 animate-bounce-slow drop-shadow-[0_0_25px_rgba(255,105,180,0.9)] filter hover:scale-110 transition-transform">
                    <img src="/branding/messi_mode_new.png" alt="Messi Mode" className="w-full h-full object-contain" />
                </div>
            )}

            {/* Card Container with 3D flip */}
            <div
                className={`relative w-full h-full transition-transform duration-700 ${isFlipped ? 'card-flipped' : ''}`}
                style={{ transformStyle: 'preserve-3d' }}
            >
                {/* FRONT OF CARD */}
                <div
                    className="absolute inset-0 w-full h-full"
                    style={{ backfaceVisibility: 'hidden' }}
                >
                    {/* Main Card Shape - Dark Premium Style */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] rounded-t-[2rem] rounded-br-[4rem] rounded-bl-[2rem] border-2 border-brand-gold/40 transition-all duration-300 group-hover:shadow-[0_25px_60px_rgba(59,130,246,0.2)]">
                        {/* Texture Overlay */}
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30 mix-blend-overlay rounded-t-[2rem] rounded-br-[4rem] rounded-bl-[2rem]"></div>

                        {/* Inner Frame */}
                        <div className="absolute top-2 bottom-2 left-2 right-2 border-[1.5px] border-brand-gold/20 rounded-t-[1.8rem] rounded-br-[3.8rem] rounded-bl-[1.8rem]"></div>

                        {/* Content Area */}
                        <div className="relative w-full h-full flex flex-col overflow-visible">

                            {/* Top: Stats & Info (Left) + Image (Right) */}
                            <div className="h-[65%] w-full relative z-10 flex">

                                {/* Left Column Info */}
                                <div className="w-[30%] pt-10 pl-6 flex flex-col items-center z-20">
                                    <span className="text-5xl font-black text-brand-gold leading-none tracking-tighter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{rating}</span>
                                    <span className="text-xl font-bold text-white uppercase leading-none mb-3">{position}</span>

                                    <div className="w-full h-[1px] bg-brand-gold/30 mb-3"></div>

                                    {/* Nation (USA) */}
                                    <div className="w-8 h-6 relative shadow-md mb-2 overflow-hidden rounded border border-brand-gold/30" title="USA">
                                        <div className="absolute inset-0 bg-white">
                                            <div className="h-[2px] w-full bg-red-600 top-2 absolute"></div>
                                            <div className="h-[2px] w-full bg-red-600 bottom-1 absolute"></div>
                                            <div className="w-4 h-3 bg-blue-700 top-0 left-0 absolute"></div>
                                        </div>
                                    </div>

                                    {/* Club Logo */}
                                    <div className="w-12 h-12 flex items-center justify-center filter drop-shadow hover:scale-110 transition-transform">
                                        <img src="/branding/logo.png" alt="RFC" className="w-full h-full object-contain" />
                                    </div>
                                </div>

                                {/* Player Image */}
                                <div className="w-[70%] h-full relative z-10">
                                    <img
                                        src={image}
                                        alt={name}
                                        className="absolute right-[-10px] top-6 w-[220px] h-[260px] object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.4)] transition-transform group-hover:scale-105"
                                    />
                                </div>
                            </div>

                            {/* Name Bar */}
                            <div className="relative w-full z-20 -mt-2">
                                {/* Number Background - only show if valid number */}
                                {number && number !== '??' && (
                                    <div className="absolute -top-10 right-8 text-brand-gold font-display font-black text-6xl opacity-20 select-none z-0">
                                        {number}
                                    </div>
                                )}

                                <h2 className="text-3xl text-white font-display uppercase font-black text-center tracking-normal py-1 border-t border-b border-brand-gold/20 bg-gradient-to-r from-transparent via-brand-gold/5 to-transparent">
                                    {name}
                                </h2>
                            </div>

                            {/* Stats Grid */}
                            <div className="w-full px-6 pt-3 grid grid-cols-2 gap-x-1 gap-y-0 z-20 font-display">
                                {[
                                    { label: 'PAC', val: pace },
                                    { label: 'DRI', val: dribbling },
                                    { label: 'SHO', val: shooting },
                                    { label: 'DEF', val: defending },
                                    { label: 'PAS', val: passing },
                                    { label: 'PHY', val: physical }
                                ].map((stat, i) => (
                                    <div key={i} className="flex items-center justify-start gap-4 hover:scale-105 transition-transform origin-left">
                                        <span className="font-black text-xl w-8 text-right text-brand-gold">{stat.val}</span>
                                        <span className="text-sm uppercase font-bold tracking-widest text-gray-300">{stat.label}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Bottom Chemistry/Decoration */}
                            <div className="absolute bottom-6 w-full flex justify-center opacity-60">
                                <div className="w-6 h-6 border-2 border-brand-gold/50 rounded-full flex items-center justify-center bg-brand-gold/10">
                                    <Shield className="w-3 h-3 text-brand-gold fill-current" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* BACK OF CARD */}
                <div
                    className="absolute inset-0 w-full h-full"
                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-t-[2rem] rounded-br-[4rem] rounded-bl-[2rem] border-2 border-[#e94560]/30">
                        {/* Pattern overlay */}
                        <div className="absolute inset-0 opacity-10">
                            <div className="w-full h-full" style={{
                                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(233, 69, 96, 0.1) 10px, rgba(233, 69, 96, 0.1) 20px)'
                            }}></div>
                        </div>

                        {/* Content */}
                        <div className="relative w-full h-full flex flex-col items-center justify-center p-6">
                            {/* Logo */}
                            <div className="w-32 h-32 mb-4 filter drop-shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                                <img src="/branding/logo.png" alt="RFC" className="w-full h-full object-contain" />
                            </div>

                            <h3 className="text-2xl font-display font-bold text-white uppercase tracking-widest mb-2">
                                Rockford Fire
                            </h3>
                            <p className="text-brand-green text-sm uppercase tracking-wider mb-6">Football Club</p>

                            {/* Stats summary */}
                            <div className="w-full max-w-[200px] space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-400 flex items-center gap-2">
                                        <Star className="w-4 h-4 text-brand-gold" /> Overall
                                    </span>
                                    <span className="text-white font-bold">{rating}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-400 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-brand-green" /> Position
                                    </span>
                                    <span className="text-white font-bold">{position}</span>
                                </div>
                            </div>

                            {/* Tap hint */}
                            <div className="absolute bottom-8 text-center">
                                <p className="text-gray-500 text-xs uppercase tracking-widest animate-pulse">
                                    Opening Report Card...
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* CSS for card flip */}
            <style>{`
                .card-flipped {
                    transform: rotateY(180deg);
                }
            `}</style>
        </div>
    );
};

export default PlayerCard;
