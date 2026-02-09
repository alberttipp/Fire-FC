import React, { useState, useEffect } from 'react';
import { X, Save, TrendingUp, Award, Medal, Clock } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import confetti from 'canvas-confetti';
import { badges as mockBadges } from '../../data/badges';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

const PlayerEvaluationModal = ({ player, onClose, readOnly = false }) => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('eval'); // 'eval', 'awards', or 'training'
    const [saving, setSaving] = useState(false);
    const [coachNotes, setCoachNotes] = useState('');
    const [season, setSeason] = useState('Spring 2026');
    const [existingEvalId, setExistingEvalId] = useState(null);

    // Badge Data State
    const [allBadges, setAllBadges] = useState([]);
    const [awardedBadges, setAwardedBadges] = useState({}); // { badgeId: count }

    // Training Stats State
    const [trainingStats, setTrainingStats] = useState({
        weekly_minutes: 0,
        season_minutes: 0,
        yearly_minutes: 0,
        training_minutes: 0,
        drills_completed: 0,
        streak_days: 0,
    });

    // Stats - will load from DB if exists
    const [stats, setStats] = useState({
        Pace: 50,
        Shooting: 50,
        Passing: 50,
        Dribbling: 50,
        Defending: 50,
        Physical: 50,
    });

    // Fetch Badges, Evaluations & Player's Earned Badges
    useEffect(() => {
        const fetchData = async () => {
            // 1. Get Badge Definitions
            const { data: badgeDefs, error: badgeError } = await supabase.from('badges').select('*');
            if (badgeError) {
                console.error("Error fetching badge definitions:", badgeError);
            }
            setAllBadges(badgeDefs || []);

            if (player?.id) {
                // 2. Get Latest Evaluation for this player
                const { data: evalData, error: evalError } = await supabase
                    .from('evaluations')
                    .select('*')
                    .eq('player_id', player.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (evalError && evalError.code !== 'PGRST116') {
                    // PGRST116 = no rows returned, which is fine
                    console.error("Error fetching evaluation:", evalError);
                } else if (evalData) {
                    // Load existing evaluation
                    setExistingEvalId(evalData.id);
                    setStats({
                        Pace: evalData.pace || 50,
                        Shooting: evalData.shooting || 50,
                        Passing: evalData.passing || 50,
                        Dribbling: evalData.dribbling || 50,
                        Defending: evalData.defending || 50,
                        Physical: evalData.physical || 50,
                    });
                    setCoachNotes(evalData.notes || '');
                    setSeason(evalData.season || 'Spring 2026');
                }

                // 3. Get Earned Badges - query by player_user_id (auth.users UUID)
                const playerUserId = player.user_id || player.id;
                const { data: earned, error: earnedError } = await supabase
                    .from('player_badges')
                    .select('badge_id')
                    .eq('player_user_id', playerUserId);

                if (earnedError) {
                    console.error("Error fetching earned badges:", earnedError);
                }

                if (earned) {
                    const counts = {};
                    earned.forEach(row => {
                        counts[row.badge_id] = (counts[row.badge_id] || 0) + 1;
                    });
                    setAwardedBadges(counts);
                }

                // 4. Get Training Stats
                const { data: statsRow, error: statsError } = await supabase
                    .from('player_stats')
                    .select('weekly_minutes, season_minutes, yearly_minutes, training_minutes, drills_completed, streak_days')
                    .eq('player_id', player.id)
                    .single();

                if (statsError && statsError.code !== 'PGRST116') {
                    console.error('Error fetching training stats:', statsError);
                }
                if (statsRow) {
                    setTrainingStats({
                        weekly_minutes: statsRow.weekly_minutes || 0,
                        season_minutes: statsRow.season_minutes || 0,
                        yearly_minutes: statsRow.yearly_minutes || 0,
                        training_minutes: statsRow.training_minutes || 0,
                        drills_completed: statsRow.drills_completed || 0,
                        streak_days: statsRow.streak_days || 0,
                    });
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
                colors: ['#3b82f6', '#FFD700']
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
            colors: ['#3b82f6', '#FFD700'],
            zIndex: 10000
        });

        // Database Insert - use player_user_id (the auth.users UUID linked to this player)
        // RLS policy checks: players.user_id = player_badges.player_user_id
        const playerUserId = player?.user_id || player?.id;

        if (playerUserId && user?.id) {
            try {
                const { error } = await supabase.from('player_badges').insert({
                    player_user_id: playerUserId,
                    badge_id: badgeId,
                    awarded_by: user.id,
                    awarded_at: new Date().toISOString()
                });

                if (error) {
                    console.error("Error awarding badge:", error);
                    // Revert optimistic update on failure
                    setAwardedBadges(prev => {
                        const newCount = (prev[badgeId] || 1) - 1;
                        if (newCount <= 0) {
                            const { [badgeId]: removed, ...rest } = prev;
                            return rest;
                        }
                        return { ...prev, [badgeId]: newCount };
                    });
                }
            } catch (err) {
                console.error("Error awarding badge:", err);
            }
        }
    };

    const handleSave = async () => {
        if (!player?.id || !user?.id) {
            alert('Missing player or user information');
            return;
        }

        setSaving(true);
        try {
            const evaluationData = {
                player_id: player.id,
                coach_id: user.id,
                season: season,
                pace: stats.Pace,
                shooting: stats.Shooting,
                passing: stats.Passing,
                dribbling: stats.Dribbling,
                defending: stats.Defending,
                physical: stats.Physical,
                notes: coachNotes,
            };

            let error;
            if (existingEvalId) {
                // Update existing evaluation
                const { error: updateError } = await supabase
                    .from('evaluations')
                    .update(evaluationData)
                    .eq('id', existingEvalId);
                error = updateError;
            } else {
                // Insert new evaluation
                const { error: insertError } = await supabase
                    .from('evaluations')
                    .insert([evaluationData]);
                error = insertError;
            }

            if (error) throw error;

            // Confetti on success
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#3b82f6', '#FFD700', '#ffffff'],
                zIndex: 10000
            });

            alert('✓ Evaluation saved!');
            onClose();
        } catch (err) {
            console.error('Error saving evaluation:', err);
            alert('Failed to save evaluation: ' + err.message);
        } finally {
            setSaving(false);
        }
    }

    const handleSaveTraining = async () => {
        if (!player?.id) return;
        setSaving(true);
        try {
            const { error } = await supabase.rpc('adjust_player_training_stats', {
                p_player_id: player.id,
                p_weekly_minutes: trainingStats.weekly_minutes,
                p_season_minutes: trainingStats.season_minutes,
                p_yearly_minutes: trainingStats.yearly_minutes,
                p_training_minutes: trainingStats.training_minutes,
            });

            if (error) throw error;
            alert('✓ Training stats saved!');
        } catch (err) {
            console.error('Error saving training stats:', err);
            alert('Failed to save: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const adjustTrainingStat = (key, delta) => {
        setTrainingStats(prev => ({
            ...prev,
            [key]: Math.max(0, (prev[key] || 0) + delta)
        }));
    };

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
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    fill="#3b82f6"
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
                            <button
                                onClick={() => setActiveTab('training')}
                                className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'training' ? 'border-brand-green text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Training</span>
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-0">
                        {activeTab === 'training' ? (
                            <div className="space-y-5">
                                {/* Read-only summary row */}
                                <div className="grid grid-cols-3 gap-3 mb-2">
                                    <div className="text-center p-3 bg-white/5 rounded-lg">
                                        <div className="text-2xl font-bold text-brand-green">{trainingStats.streak_days}</div>
                                        <div className="text-[10px] text-gray-500 uppercase">Streak</div>
                                    </div>
                                    <div className="text-center p-3 bg-white/5 rounded-lg">
                                        <div className="text-2xl font-bold text-white">{trainingStats.drills_completed}</div>
                                        <div className="text-[10px] text-gray-500 uppercase">Drills Done</div>
                                    </div>
                                    <div className="text-center p-3 bg-white/5 rounded-lg">
                                        <div className="text-2xl font-bold text-brand-gold">{trainingStats.training_minutes}</div>
                                        <div className="text-[10px] text-gray-500 uppercase">Career Min</div>
                                    </div>
                                </div>

                                {[
                                    { key: 'weekly_minutes', label: 'This Week', color: 'text-blue-400', bgColor: 'bg-blue-500' },
                                    { key: 'season_minutes', label: 'Season Total', color: 'text-brand-green', bgColor: 'bg-brand-green' },
                                    { key: 'yearly_minutes', label: 'Year Total', color: 'text-brand-gold', bgColor: 'bg-brand-gold' },
                                    { key: 'training_minutes', label: 'Career Total', color: 'text-white', bgColor: 'bg-white' },
                                ].map(({ key, label, color, bgColor }) => (
                                    <div key={key}>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-xs text-gray-400 uppercase font-bold tracking-wider">{label}</label>
                                            <span className={`text-lg font-bold ${color}`}>
                                                {trainingStats[key] || 0} <span className="text-xs text-gray-500">min</span>
                                            </span>
                                        </div>
                                        {!readOnly ? (
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => adjustTrainingStat(key, -10)}
                                                    className="w-8 h-8 rounded bg-red-500/20 text-red-400 font-bold hover:bg-red-500/30 transition-colors"
                                                >-</button>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={trainingStats[key] || 0}
                                                    onChange={(e) => setTrainingStats(prev => ({ ...prev, [key]: Math.max(0, parseInt(e.target.value) || 0) }))}
                                                    className="flex-1 bg-black/30 border border-white/10 rounded-lg p-2 text-white text-center focus:border-brand-green outline-none"
                                                />
                                                <button
                                                    onClick={() => adjustTrainingStat(key, 10)}
                                                    className="w-8 h-8 rounded bg-green-500/20 text-green-400 font-bold hover:bg-green-500/30 transition-colors"
                                                >+</button>
                                            </div>
                                        ) : (
                                            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                                <div className={`h-full ${bgColor} transition-all duration-700`} style={{ width: `${Math.min((trainingStats[key] || 0) / 5, 100)}%` }} />
                                            </div>
                                        )}
                                        {key === 'training_minutes' && !readOnly && (
                                            <p className="text-[10px] text-yellow-400 italic mt-1">Career total should only be adjusted to correct errors</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : activeTab === 'eval' ? (
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
                                    <div className="mt-8 pt-6 border-t border-white/10 space-y-4">
                                        <div>
                                            <label className="block text-xs text-gray-400 uppercase font-bold mb-2">Season</label>
                                            <select
                                                value={season}
                                                onChange={(e) => setSeason(e.target.value)}
                                                className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white text-sm focus:border-brand-green outline-none"
                                            >
                                                <option value="Spring 2026">Spring 2026</option>
                                                <option value="Fall 2025">Fall 2025</option>
                                                <option value="Summer 2025">Summer 2025</option>
                                                <option value="Spring 2025">Spring 2025</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-400 uppercase font-bold mb-2">Coach Notes</label>
                                            <textarea
                                                value={coachNotes}
                                                onChange={(e) => setCoachNotes(e.target.value)}
                                                className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white text-sm focus:border-brand-green outline-none resize-none h-24"
                                                placeholder="Great improvement in pace this week..."
                                            ></textarea>
                                        </div>
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
                                {activeTab === 'training' ? 'Edit training minutes' : activeTab === 'awards' ? 'Tap badges to award' : 'Adjust stats carefully'}
                            </span>
                            <button
                                onClick={activeTab === 'training' ? handleSaveTraining : handleSave}
                                disabled={saving}
                                className="btn-primary flex items-center gap-2 disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" /> {saving ? 'Saving...' : `Save ${activeTab === 'training' ? 'Training' : activeTab === 'awards' ? 'Badges' : 'Evaluation'}`}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PlayerEvaluationModal;
