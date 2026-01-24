import React from 'react';
import { Crown, Trophy, Medal } from 'lucide-react';

const Leaderboard = () => {
    // Mock Data
    const players = [
        { rank: 1, name: "Leo M.", xp: 450, team: "U10 Boys", change: 0 },
        { rank: 2, name: "Cristiano R.", xp: 420, team: "U10 Boys", change: 1 },
        { rank: 3, name: "Neymar J.", xp: 390, team: "U10 Boys", change: -1 },
        { rank: 4, name: "Bo Tipp", xp: 350, team: "U10 Boys", change: 2, isUser: true }, // Current User
        { rank: 5, name: "Kylian M.", xp: 310, team: "U10 Boys", change: 0 },
    ];

    const getRankIcon = (rank) => {
        switch (rank) {
            case 1: return <Crown className="w-5 h-5 text-brand-gold fill-brand-gold animate-bounce" />;
            case 2: return <Medal className="w-5 h-5 text-gray-300" />;
            case 3: return <Medal className="w-5 h-5 text-amber-700" />;
            default: return <span className="font-display font-bold text-gray-400 w-5 text-center">{rank}</span>;
        }
    };

    return (
        <div className="glass-panel p-6 animate-fade-in-up delay-100">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl text-white font-display uppercase font-bold flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-brand-gold" /> Leaderboard
                </h3>
                <span className="text-xs text-brand-green border border-brand-green/30 px-2 py-1 rounded bg-brand-green/5 uppercase tracking-wider">
                    Weekly
                </span>
            </div>

            <div className="space-y-4">
                {/* Table Header */}
                <div className="grid grid-cols-12 text-xs text-gray-500 uppercase font-bold tracking-widest px-4">
                    <div className="col-span-2 text-center">Rank</div>
                    <div className="col-span-7">Player</div>
                    <div className="col-span-3 text-right">XP</div>
                </div>

                {players.map((player) => (
                    <div
                        key={player.rank}
                        className={`grid grid-cols-12 items-center p-3 rounded-lg border transition-all ${player.isUser ? 'bg-brand-green/10 border-brand-green/50 shadow-[0_0_15px_rgba(204,255,0,0.1)] scale-105 z-10' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                    >
                        <div className="col-span-2 flex justify-center">
                            {getRankIcon(player.rank)}
                        </div>
                        <div className="col-span-7 flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${player.isUser ? 'bg-brand-green text-brand-dark' : 'bg-gray-700 text-gray-300'}`}>
                                {player.name.charAt(0)}
                            </div>
                            <div>
                                <h4 className={`font-bold leading-none ${player.isUser ? 'text-brand-green' : 'text-white'}`}>{player.name}</h4>
                                <p className="text-[10px] text-gray-500 uppercase">{player.team}</p>
                            </div>
                        </div>
                        <div className="col-span-3 text-right font-display font-bold text-white">
                            {player.xp}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 text-center">
                <p className="text-xs text-gray-400">
                    You are <span className="text-brand-gold font-bold">40 XP</span> away from Top 3!
                </p>
                <button className="mt-3 text-xs text-brand-green hover:underline uppercase tracking-widest">
                    View Full Rankings
                </button>
            </div>
        </div>
    );
};

export default Leaderboard;
