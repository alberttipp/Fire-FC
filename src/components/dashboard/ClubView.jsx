import React from 'react';
import { Users, Trophy, Calendar } from 'lucide-react';

const ClubView = () => {
    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 border-l-4 border-brand-gold">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-400 text-sm uppercase tracking-wider">Total Players</p>
                            <h3 className="text-4xl text-white font-display font-bold">128</h3>
                        </div>
                        <Users className="text-brand-gold w-8 h-8 opacity-50" />
                    </div>
                </div>

                <div className="glass-panel p-6 border-l-4 border-brand-green">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-400 text-sm uppercase tracking-wider">Active Teams</p>
                            <h3 className="text-4xl text-white font-display font-bold">8</h3>
                        </div>
                        <Trophy className="text-brand-green w-8 h-8 opacity-50" />
                    </div>
                </div>

                <div className="glass-panel p-6 border-l-4 border-blue-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-400 text-sm uppercase tracking-wider">Events This Week</p>
                            <h3 className="text-4xl text-white font-display font-bold">12</h3>
                        </div>
                        <Calendar className="text-blue-500 w-8 h-8 opacity-50" />
                    </div>
                </div>
            </div>

            {/* Club Summary Section (Placeholder) */}
            <div className="glass-panel p-6">
                <h3 className="text-xl text-brand-green font-display uppercase font-bold mb-4 border-b border-white/10 pb-2">Club Performance</h3>
                <div className="h-48 flex items-center justify-center text-gray-500">
                    [Chart Placeholder: Weekly Training Minutes per Team]
                </div>
            </div>
        </div>
    );
};

export default ClubView;
