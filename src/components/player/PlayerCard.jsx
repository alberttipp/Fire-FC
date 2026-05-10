import React, { useState } from 'react';
import { Shield, Star, TrendingUp, RotateCw, ChevronRight } from 'lucide-react';

const PlayerCard = ({ player, onClick, showBack = false }) => {
    const [isFlipped, setIsFlipped] = useState(showBack);

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

    const handleCardClick = () => {
        // Just flip — no auto-open. The back has a "View Full Profile" button
        // that fires onClick when the user actually wants the detail modal.
        setIsFlipped((f) => !f);
    };

    const handleOpenProfile = (e) => {
        e.stopPropagation();
        if (onClick) onClick();
    };

    return (
        <div
            onClick={handleCardClick}
            // w-full lets the card shrink on narrow phones (iPhone SE ≈ 343px
            // available after page padding); max-w-80 keeps the original
            // 320px size on anything wider so the layout looks identical.
            className="relative w-full max-w-80 h-[480px] mx-auto group font-sans select-none cursor-pointer"
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
                    <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-t-[2rem] rounded-br-[4rem] rounded-bl-[2rem] border-2 border-brand-gold/40 overflow-hidden">
                        {/* Pattern overlay */}
                        <div className="absolute inset-0 opacity-10 pointer-events-none">
                            <div className="w-full h-full" style={{
                                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(212, 175, 55, 0.15) 10px, rgba(212, 175, 55, 0.15) 20px)'
                            }}></div>
                        </div>

                        {/* Inner frame */}
                        <div className="absolute top-2 bottom-2 left-2 right-2 border-[1.5px] border-brand-gold/20 rounded-t-[1.8rem] rounded-br-[3.8rem] rounded-bl-[1.8rem] pointer-events-none"></div>

                        {/* Content */}
                        <div className="relative w-full h-full flex flex-col p-6">
                            {/* Header — name + number + position */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="min-w-0">
                                    <p className="text-[10px] uppercase tracking-widest text-brand-gold font-bold mb-1">Player Card</p>
                                    <h3 className="text-2xl text-white font-display font-black uppercase truncate leading-tight">{name}</h3>
                                    <p className="text-brand-green text-xs uppercase tracking-wider mt-1">{position} · #{number}</p>
                                </div>
                                <div className="flex flex-col items-center shrink-0 ml-3">
                                    <span className="text-4xl font-black text-brand-gold leading-none">{rating}</span>
                                    <span className="text-[10px] uppercase tracking-widest text-gray-400 mt-1">Overall</span>
                                </div>
                            </div>

                            <div className="h-[1px] bg-brand-gold/30 mb-4"></div>

                            {/* Strengths — top 3 stats */}
                            <div className="mb-4">
                                <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2 flex items-center gap-1.5">
                                    <TrendingUp className="w-3 h-3 text-brand-green" />
                                    Strengths
                                </p>
                                {[
                                    { label: 'Pace', val: pace },
                                    { label: 'Dribbling', val: dribbling },
                                    { label: 'Shooting', val: shooting },
                                    { label: 'Passing', val: passing },
                                    { label: 'Defending', val: defending },
                                    { label: 'Physical', val: physical },
                                ]
                                    .sort((a, b) => b.val - a.val)
                                    .slice(0, 3)
                                    .map((s) => (
                                        <div key={s.label} className="flex items-center justify-between text-sm py-1">
                                            <span className="text-gray-300 uppercase tracking-wider text-xs">{s.label}</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                    <div className="h-full bg-brand-gold rounded-full" style={{ width: `${Math.min(100, s.val)}%` }} />
                                                </div>
                                                <span className="text-brand-gold font-bold text-sm w-7 text-right">{s.val}</span>
                                            </div>
                                        </div>
                                    ))}
                            </div>

                            {/* Logo + club name */}
                            <div className="flex items-center gap-3 mb-auto">
                                <div className="w-10 h-10 flex items-center justify-center filter drop-shadow">
                                    <img src="/branding/logo.png" alt="RFC" className="w-full h-full object-contain" />
                                </div>
                                <div>
                                    <p className="text-white text-sm font-display font-bold uppercase tracking-wider leading-none">Rockford Fire</p>
                                    <p className="text-gray-500 text-[10px] uppercase tracking-wider">Football Club</p>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-2 mt-auto">
                                {onClick && (
                                    <button
                                        onClick={handleOpenProfile}
                                        className="flex-1 bg-brand-green text-brand-dark font-bold uppercase tracking-wider text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 hover:bg-white transition-colors"
                                    >
                                        Full Profile <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIsFlipped(false); }}
                                    className="bg-white/5 border border-white/10 text-gray-300 font-bold uppercase tracking-wider text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 hover:bg-white/10 transition-colors"
                                >
                                    <RotateCw className="w-3.5 h-3.5" /> Flip
                                </button>
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
