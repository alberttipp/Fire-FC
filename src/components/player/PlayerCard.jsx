import React from 'react';
import { Shield } from 'lucide-react';

const PlayerCard = ({ player, onClick }) => {
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

    return (
        <div
            onClick={onClick}
            className={`relative w-80 h-[480px] group perspective-1000 font-sans select-none ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
        >
            {/* Messi Mode Badge Overlay */}
            {messiMode && (
                <div className="absolute -top-8 -right-8 z-50 w-28 h-28 animate-bounce-slow drop-shadow-[0_0_25px_rgba(255,105,180,0.9)] filter hover:scale-110 transition-transform">
                    <img src="/branding/messi_mode_new.png" alt="Messi Mode" className="w-full h-full object-contain" />
                </div>
            )}

            {/* Card Container */}
            <div className="relative w-full h-full duration-500 transform style-preserve-3d group-hover:rotate-y-3 group-hover:scale-105 transition-all">

                {/* Main Card Shape - FC 26 Style (More Angular Top, Curved Bottom) */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#f2e5c2] via-[#d4af37] to-[#a3832d] p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-t-[2rem] rounded-br-[4rem] rounded-bl-[2rem] border-2 border-[#fffacd]">
                    {/* Texture Overlay */}
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay rounded-t-[2rem] rounded-br-[4rem] rounded-bl-[2rem]"></div>

                    {/* Inner Gold Frame */}
                    <div className="absolute top-2 bottom-2 left-2 right-2 border-[1.5px] border-[#8a681c]/40 rounded-t-[1.8rem] rounded-br-[3.8rem] rounded-bl-[1.8rem]"></div>

                    {/* Content Area */}
                    <div className="relative w-full h-full flex flex-col overflow-visible">

                        {/* Top: Stats & Info (Left) + Image (Right) */}
                        <div className="h-[65%] w-full relative z-10 flex">

                            {/* Left Column Info */}
                            <div className="w-[30%] pt-10 pl-6 flex flex-col items-center z-20">
                                <span className="text-5xl font-black text-[#3e3418] leading-none tracking-tighter drop-shadow-sm">{rating}</span>
                                <span className="text-xl font-bold text-[#3e3418] uppercase leading-none mb-3">{position}</span>

                                <div className="w-full h-[1px] bg-[#8a681c]/40 mb-3"></div>

                                {/* Nation (USA) */}
                                <div className="w-8 h-6 relative shadow-md mb-2 overflow-hidden rounded border border-[#8a681c]/30" title="USA">
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
                            {/* Number Background */}
                            <div className="absolute -top-10 right-8 text-[#fffacd] font-display font-black text-6xl opacity-30 select-none z-0">
                                {number}
                            </div>

                            <h2 className="text-3xl text-[#3e3418] font-display uppercase font-black text-center tracking-normal py-1 border-t border-b border-[#8a681c]/10 bg-gradient-to-r from-transparent via-[#8a681c]/5 to-transparent">
                                {name}
                            </h2>
                        </div>

                        {/* Stats Grid */}
                        <div className="w-full px-6 pt-3 grid grid-cols-2 gap-x-1 gap-y-0 text-[#3e3418] z-20 font-display">
                            {[
                                { label: 'PAC', val: pace },
                                { label: 'DRI', val: dribbling },
                                { label: 'SHO', val: shooting },
                                { label: 'DEF', val: defending },
                                { label: 'PAS', val: passing },
                                { label: 'PHY', val: physical }
                            ].map((stat, i) => (
                                <div key={i} className="flex items-center justify-start gap-4 hover:scale-105 transition-transform origin-left">
                                    <span className="font-black text-xl w-8 text-right">{stat.val}</span>
                                    <span className="text-sm uppercase font-bold tracking-widest opacity-80">{stat.label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Bottom Chemistry/Decoration */}
                        <div className="absolute bottom-6 w-full flex justify-center opacity-60">
                            <div className="w-6 h-6 border-2 border-[#3e3418] rounded-full flex items-center justify-center bg-[#8a681c]/10">
                                <Shield className="w-3 h-3 text-[#3e3418] fill-current" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlayerCard;
