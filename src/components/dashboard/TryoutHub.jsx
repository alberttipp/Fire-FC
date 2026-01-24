import React, { useState } from 'react';
import { Users, Filter, Mic, Search, ChevronRight, UserPlus } from 'lucide-react';
import ScoutCard from './ScoutCard';

const TryoutHub = () => {
    const [selectedGroup, setSelectedGroup] = useState('U10 Boys');
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Mock Trialists
    const trialists = [
        { id: 101, name: "Lucas Silva", number: "T-04", position: "CAM", rating: 78 },
        { id: 102, name: "Oscar Martinez", number: "T-12", position: "LW", rating: 82 },
        { id: 103, name: "Ethan Cole", number: "T-09", position: "CB", rating: 75 },
        { id: 104, name: "Noah Davies", number: "T-22", position: "CDM", rating: 68 },
        { id: 105, name: "Sam Wilson", number: "T-15", position: "ST", rating: 85 },
    ];

    const handlePlayerClick = (player) => {
        setSelectedPlayer(player);
    }

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col md:flex-row gap-6 animate-fade-in relative">

            {/* Left Sidebar: Groups & List */}
            <div className={`w-full md:w-1/3 flex flex-col glass-panel overflow-hidden ${selectedPlayer ? 'hidden md:flex' : 'flex'}`}>
                {/* Header */}
                <div className="p-6 border-b border-white/10 bg-brand-dark/50">
                    <h2 className="text-2xl text-white font-display uppercase font-bold tracking-wider mb-4">Tryout Center</h2>

                    {/* Group Selector */}
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                        {['U10 Boys', 'U12 Boys', 'U14 Girls'].map(group => (
                            <button
                                key={group}
                                onClick={() => setSelectedGroup(group)}
                                className={`px-3 py-1.5 rounded text-xs font-bold uppercase whitespace-nowrap transition-colors ${selectedGroup === group ? 'bg-brand-gold text-brand-dark' : 'bg-white/10 text-gray-400 hover:text-white'}`}
                            >
                                {group}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative mt-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search trialists..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-brand-green outline-none"
                        />
                    </div>
                </div>

                {/* Player List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                    {trialists
                        .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map(player => (
                            <div
                                key={player.id}
                                onClick={() => handlePlayerClick(player)}
                                className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all hover:bg-white/5 ${selectedPlayer?.id === player.id ? 'bg-brand-green/10 border-brand-green' : 'bg-transparent border-transparent'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center font-display font-bold text-gray-500 border border-white/10">
                                        {player.number}
                                    </div>
                                    <div>
                                        <h4 className={`font-bold ${selectedPlayer?.id === player.id ? 'text-brand-green' : 'text-white'}`}>{player.name}</h4>
                                        <p className="text-xs text-gray-500 uppercase font-bold">{player.position}</p>
                                    </div>
                                </div>
                                <ChevronRight className={`w-4 h-4 ${selectedPlayer?.id === player.id ? 'text-brand-green' : 'text-gray-600'}`} />
                            </div>
                        ))}
                    <button className="w-full py-3 my-2 border border-dashed border-white/20 rounded-lg text-gray-400 text-sm hover:text-brand-green hover:border-brand-green transition-colors flex items-center justify-center gap-2">
                        <UserPlus className="w-4 h-4" /> Add Walk-in Trialist
                    </button>
                </div>
            </div>

            {/* Right Panel: Scout Card & Voice Tools */}
            <div className={`w-full md:w-2/3 glass-panel relative overflow-hidden flex flex-col ${!selectedPlayer && 'hidden md:flex'}`}>
                {selectedPlayer ? (
                    <ScoutCard player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-50">
                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                            <Mic className="w-8 h-8 text-white/30" />
                        </div>
                        <h3 className="text-xl text-white font-display uppercase font-bold mb-2">Ready to Scout</h3>
                        <p className="text-gray-400 max-w-sm">Select a player from the list to view their profile, record voice notes, and grade their performance.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TryoutHub;
