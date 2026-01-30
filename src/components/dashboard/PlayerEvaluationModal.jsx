import React, { useState, useEffect } from 'react';
import { X, Save, TrendingUp, Award, Medal } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import confetti from 'canvas-confetti';
import { badges as mockBadges } from '../../data/badges';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

const PlayerEvaluationModal = ({ player, onClose, readOnly = false }) => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('eval'); // 'eval' or 'awards'

    // Badge Data State
    const [allBadges, setAllBadges] = useState([]);
    const [awardedBadges, setAwardedBadges] = useState({}); // { badgeId: count }

    // Mock Stats (Keep for now as fallback/demo)
    const [stats, setStats] = useState({
        Pace: 75,
        Shooting: 60,
        Passing: 65,
        Dribbling: 70,
        Defending: 40,
        Physical: 55,
    });

    // Fetch Badges & Player's Earned Badges
    useEffect(() => {
        const fetchData = async () => {
            // 1. Get Definitions - Real data only, no mock fallbacks
            const { data: badgeDefs, error: badgeError } = await supabase.from('badges').select('*');
            if (badgeError) {
                console.error("Error fetching badge definitions:", badgeError);
            }
            setAllBadges(badgeDefs || []);

            // 2. Get Earned (if valid player ID)
            if (player?.id) {
                const { data: earned, error: earnedError } = await supabase
                    .from('player_badges')
                    .select('badge_id')
                    .eq('player_id', player.id);

                if (earnedError) {
                    console.error("Error fetching earned badges:", earnedError);
                } else if (earned) {
                    const counts = {};
                    earned.forEach(row => {
                        counts[row.badge_id] = (counts[row.badge_id] || 0) + 1;
                    });
                    setAwardedBadges(counts);
                }
            }
        };
        fetchData();
    }, [player]);

    // Effect for readOnly confetti
    useEffect(() => {
        if (readOnly) {
            // "Soccer Ball Explosion" Effect
            const count = 200;
            const defaults = {
                origin: { y: 0.7 },
                zIndex: 1000,
            };

            const fire = (particleRatio, opts) => {
                confetti({
                    ...defaults,
                    ...opts,
                    particleCount: Math.floor(count * particleRatio),
                    scalar: 2,
                });
            }

            // Burst 1: "Soccer Balls"
            fire(0.25, {
                spread: 26,
                startVelocity: 55,
                shapes: ['circle'],
                colors: ['#ffffff', '#000000', '#e0e0e0']
            });

            // Burst 2: More Balls
            fire(0.2, {
                spread: 60,
                shapes: ['circle'],
                colors: ['#ffffff', '#000000']
            });

            // Burst 3: Club Colors
            fire(0.35, {
                spread: 100,
                decay: 0.91,
                scalar: 0.8,
                shapes: ['square'],
                colors: ['#ccff00', '#FFD700']
            });

            // Burst 4: Wide Energy
            fire(0.1, {
                spread: 120,
                startVelocity: 25,
                decay: 0.92,
                scalar: 1.2,
                shapes: ['circle'],
                colors: ['#ffffff']
            });

            // Burst 5: Final Pop
            fire(0.1, {
                spread: 120,
                startVelocity: 45,
                shapes: ['circle'],
                colors: ['#000000', '#ffffff']
            });
        }
    }, [readOnly]);

    const data = Object.keys(stats).map(key => ({
        subject: key,
        A: stats[key],
        fullMark: 100,
    }));

    const handleSliderChange = (key, value) => {
        if (readOnly) return;
        setStats(prev => ({ ...prev, [key]: parseInt(value) }));
    };

    const toggleBadge = async (badgeId) => {
        if (readOnly) return;

        // Optimistic UI Update
        setAwardedBadges(prev => ({ ...prev, [badgeId]: (prev[badgeId] || 0) + 1 }));

        // Confetti
        confetti({
            particleCount: 30,
            spread: 50,
            origin: { y: 0.8 },
            colors: ['#ccff00', '#FFD700'],
            zIndex: 10000
        });

        // Database Insert
        if (player?.id && user?.id) {
            try {
                await supabase.from('player_badges').insert({
                    player_id: player.id,
                    badge_id: badgeId,
                    awarded_by: user.id
                });
            } catch (err) {
                console.error("Error awarding badge:", err);
            }
        }
    };

    const handleSave = () => {
        // TODO: Save to Supabase (Evaluations)
        console.log("Saving stats for", player.name, stats, awardedBadges);
        onClose();
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-brand-dark border border-white/10 w-full max-w-4xl rounded-xl shadow-2xl relative overflow-hidden flex flex-col md:flex-row h-[90vh] md:h-auto">

                {/* Visual Section (Left) */}
                <div className="w-full md:w-1/2 bg-gradient-to-br from-gray-900 to-black p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/10">
                    <div className="text-center mb-6">
                        <h2 className="text-3xl text-white font-display uppercase font-bold tracking-wider">{player?.name || 'Player Name'}</h2>
                        <p className="text-brand-green tracking-widest uppercase text-sm font-bold">Midfielder • U10</p>
                    </div>

                    <div className="w-full h-[300px] relative">
                        {/* Recharts Radar */}
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                                <PolarGrid stroke="#333" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 'bold' }} />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                <Radar
                                    name="Player Stats"
                                    dataKey="A"
                                    stroke="#ccff00"
                                    strokeWidth={2}
                                    fill="#ccff00"
                                    fillOpacity={0.3}
                                />
                            </RadarChart>
                        </ResponsiveContainer>

                        {/* Overall Rating Overlay */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                            <span className="text-4xl font-display font-bold text-white drop-shadow-md">
                                {Math.round(Object.values(stats).reduce((a, b) => a + b, 0) / 6)}
                            </span>
                            <p className="text-[10px] text-gray-400 uppercase">OVR</p>
                        </div>
                    </div>
                </div>

                {/* Controls Section (Right) */}
                <div className="w-full md:w-1/2 bg-brand-dark relative flex flex-col h-full">
                    {/* Header / Tabs */}
                    <div className="p-6 pb-0 shrink-0">
                        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10">
                            <X className="w-6 h-6" />
                        </button>

                        <div className="flex gap-6 border-b border-white/10 mb-6">
                            <button
                                onClick={() => setActiveTab('eval')}
                                className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'eval' ? 'border-brand-green text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                <span className="flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Evaluation</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('awards')}
                                className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'awards' ? 'border-brand-green text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                <span className="flex items-center gap-2"><Award className="w-4 h-4" /> Badges</span>
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-0">
                        {activeTab === 'eval' ? (
                            <div className="space-y-6">
                                {Object.keys(stats).map((key) => (
                                    <div key={key}>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-xs text-gray-400 uppercase font-bold tracking-wider">{key}</label>
                                            <span className={`text-xs font-bold ${stats[key] > 80 ? 'text-brand-green' : 'text-white'}`}>{stats[key]}</span>
                                        </div>
                                        {!readOnly ? (
                                            <input
                                                type="range"
                                                min="0"
                                                max="99"
                                                value={stats[key]}
                                                onChange={(e) => handleSliderChange(key, e.target.value)}
                                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-green hover:accent-brand-gold transition-colors"
                                            />
                                        ) : (
                                            <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-brand-green transition-all duration-1000"
                                                    style={{ width: `${stats[key]}%` }}
                                                ></div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {!readOnly && (
                                    <div className="mt-8 pt-6 border-t border-white/10">
                                        <label className="block text-xs text-gray-400 uppercase font-bold mb-2">Coach Notes</label>
                                        <textarea
                                            className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white text-sm focus:border-brand-green outline-none resize-none h-24"
                                            placeholder="Great improvement in pace this week..."
                                        ></textarea>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-8 animate-fade-in">
                                {['Performance', 'Technical', 'Leadership & Character'].map(cat => {
                                    // Map legacy categories if name matches, or just use filtered list
                                    const categoryBadges = allBadges.filter(b => b.category === cat || (cat === 'Technical' && b.category === 'Technical & Growth'));

                                    if (categoryBadges.length === 0) return null;

                                    return (
                                        <div key={cat}>
                                            <h4 className="text-brand-gold text-xs font-bold uppercase tracking-widest mb-3 border-l-2 border-brand-gold pl-3">{cat} Badges</h4>
                                            <div className="grid grid-cols-4 gap-3">
                                                {categoryBadges.map(badge => {
                                                    const count = awardedBadges[badge.id] || 0;
                                                    return (
                                                        <div
                                                            key={badge.id}
                                                            onClick={() => toggleBadge(badge.id)}
                                                            className={`aspect-square rounded-lg border flex flex-col items-center justify-center gap-1 cursor-pointer transition-all relative overflow-hidden group ${count > 0 ? 'bg-brand-green/10 border-brand-green' : 'bg-white/5 border-white/5 hover:bg-white/10'
                                                                }`}
                                                        >
                                                            <span className="text-2xl transform group-hover:scale-110 transition-transform">{badge.icon}</span>
                                                            <span className="text-[9px] text-gray-400 text-center leading-tight px-1 font-bold">{badge.name}</span>

                                                            {count > 0 && (
                                                                <div className="absolute top-1 right-1 w-4 h-4 bg-brand-green rounded-full flex items-center justify-center text-[9px] font-bold text-black border border-black/20">
                                                                    {count}
                                                                </div>
                                                            )}
                                                            {count > 0 && <div className="absolute inset-0 bg-brand-green/5 animate-pulse rounded-lg pointer-events-none"></div>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                                {readOnly && (
                                    <div className="text-center text-gray-400 text-xs italic mt-8 p-4 border border-dashed border-white/10 rounded">
                                        Badges are waiting to be earned in the next session!
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {!readOnly && (
                        <div className="p-6 pt-4 border-t border-white/10 bg-black/20 shrink-0 flex justify-between items-center">
                            <span className="text-xs text-gray-500">
                                {activeTab === 'awards' ? 'Tap badges to award' : 'Adjust stats carefully'}
                            </span>
                            <button
                                onClick={handleSave}
                                className="btn-primary flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" /> Save {activeTab === 'awards' ? 'Badges' : 'Evaluation'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PlayerEvaluationModal;
