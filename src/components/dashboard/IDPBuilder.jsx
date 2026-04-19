import React, { useState, useEffect } from 'react';
import { Target, CheckCircle, Circle, Clock, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

const FOCUS_AREAS = ['Pace', 'Shooting', 'Passing', 'Dribbling', 'Defending', 'Physical'];

const IDPBuilder = ({ player, readOnly = false }) => {
    const { user } = useAuth();
    const [activeIDP, setActiveIDP] = useState(null);
    const [milestones, setMilestones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [expanded, setExpanded] = useState(true);

    // Create form state
    const [title, setTitle] = useState('');
    const [focusAreas, setFocusAreas] = useState([]);
    const [targets, setTargets] = useState({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (player?.id) fetchIDP();
    }, [player?.id]);

    const fetchIDP = async () => {
        setLoading(true);
        // Fetch active IDP
        const { data: idps, error } = await supabase
            .from('player_idps')
            .select('*')
            .eq('player_id', player.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) console.error('Error fetching IDP:', error);

        if (idps && idps.length > 0) {
            setActiveIDP(idps[0]);
            // Fetch milestones
            const { data: ms } = await supabase
                .from('idp_milestones')
                .select('*')
                .eq('idp_id', idps[0].id)
                .order('target_date', { ascending: true });
            setMilestones(ms || []);
        }
        setLoading(false);
    };

    const handleCreate = async () => {
        if (!title.trim() || focusAreas.length === 0 || !player?.id || !user?.id) return;
        setSaving(true);

        // Get baseline from latest evaluation
        const { data: evalData } = await supabase
            .from('evaluations')
            .select('pace, shooting, passing, dribbling, defending, physical')
            .eq('player_id', player.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        const baseline = evalData || { pace: 50, shooting: 50, passing: 50, dribbling: 50, defending: 50, physical: 50 };
        const targetSnapshot = {};
        focusAreas.forEach(area => {
            const key = area.toLowerCase();
            targetSnapshot[key] = targets[area] || Math.min((baseline[key] || 50) + 10, 99);
        });

        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 90);

        const { data: idp, error } = await supabase
            .from('player_idps')
            .insert([{
                player_id: player.id,
                coach_id: user.id,
                title: title.trim(),
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0],
                focus_areas: focusAreas.map(a => a.toLowerCase()),
                baseline_snapshot: baseline,
                target_snapshot: targetSnapshot,
            }])
            .select()
            .single();

        if (error) {
            console.error('Error creating IDP:', error);
            alert('Failed to create IDP');
            setSaving(false);
            return;
        }

        // Auto-generate 30/60/90 milestones
        const milestoneDates = [30, 60, 90];
        const milestoneInserts = milestoneDates.map((days, i) => {
            const date = new Date(startDate);
            date.setDate(date.getDate() + days);
            return {
                idp_id: idp.id,
                title: `${days}-Day Check-in: ${focusAreas.join(', ')} review`,
                target_date: date.toISOString().split('T')[0],
                status: 'pending',
            };
        });

        await supabase.from('idp_milestones').insert(milestoneInserts);

        setShowCreate(false);
        setTitle('');
        setFocusAreas([]);
        setTargets({});
        setSaving(false);
        fetchIDP();
    };

    const toggleMilestone = async (milestone) => {
        if (readOnly) return;
        const newStatus = milestone.status === 'completed' ? 'pending' : 'completed';
        await supabase
            .from('idp_milestones')
            .update({
                status: newStatus,
                completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
            })
            .eq('id', milestone.id);
        fetchIDP();
    };

    const toggleFocus = (area) => {
        setFocusAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]);
    };

    const daysRemaining = activeIDP ? Math.max(0, Math.ceil((new Date(activeIDP.end_date) - new Date()) / (1000 * 60 * 60 * 24))) : 0;
    const completedCount = milestones.filter(m => m.status === 'completed').length;
    const progress = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;

    if (loading) {
        return (
            <div className="text-center py-6 text-gray-500">
                <div className="w-5 h-5 border-2 border-brand-green border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading IDP...
            </div>
        );
    }

    if (!activeIDP && !showCreate) {
        return (
            <div className="text-center py-6">
                <Target className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                <p className="text-sm text-gray-400 mb-3">No active development plan</p>
                {!readOnly && (
                    <button
                        onClick={() => setShowCreate(true)}
                        className="px-4 py-2 bg-brand-green text-brand-dark rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-brand-green/90 transition-colors"
                    >
                        <Plus className="w-3 h-3 inline mr-1" /> Create 90-Day IDP
                    </button>
                )}
            </div>
        );
    }

    if (showCreate) {
        return (
            <div className="space-y-4 animate-fade-in">
                <h4 className="text-xs text-gray-400 uppercase font-bold tracking-wider">New 90-Day Development Plan</h4>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Plan title (e.g., Weak Foot Development)"
                    className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white text-sm focus:border-brand-green outline-none"
                    autoFocus
                />
                <div>
                    <label className="block text-[10px] text-gray-500 uppercase font-bold mb-2">Focus Areas</label>
                    <div className="flex flex-wrap gap-2">
                        {FOCUS_AREAS.map(area => (
                            <button
                                key={area}
                                onClick={() => toggleFocus(area)}
                                className={`text-xs px-3 py-1.5 rounded-full font-bold transition-colors ${
                                    focusAreas.includes(area)
                                        ? 'bg-brand-green text-brand-dark'
                                        : 'bg-white/10 text-gray-400 hover:bg-white/20'
                                }`}
                            >
                                {area}
                            </button>
                        ))}
                    </div>
                </div>
                {focusAreas.length > 0 && (
                    <div>
                        <label className="block text-[10px] text-gray-500 uppercase font-bold mb-2">Target Ratings (90-day goal)</label>
                        <div className="space-y-2">
                            {focusAreas.map(area => (
                                <div key={area} className="flex items-center gap-3">
                                    <span className="text-xs text-gray-400 w-20">{area}</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="99"
                                        value={targets[area] || ''}
                                        onChange={(e) => setTargets(prev => ({ ...prev, [area]: parseInt(e.target.value) || 0 }))}
                                        placeholder="Target"
                                        className="flex-1 bg-black/30 border border-white/10 rounded p-2 text-white text-sm text-center focus:border-brand-green outline-none"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <div className="flex gap-2 justify-end pt-2">
                    <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-xs text-gray-400 hover:text-white">Cancel</button>
                    <button
                        onClick={handleCreate}
                        disabled={!title.trim() || focusAreas.length === 0 || saving}
                        className="px-4 py-2 bg-brand-green text-brand-dark rounded-lg text-xs font-bold uppercase hover:bg-brand-green/90 disabled:opacity-50"
                    >
                        {saving ? 'Creating...' : 'Create Plan'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3 animate-fade-in">
            {/* IDP Header */}
            <div
                className="p-4 rounded-lg bg-gradient-to-r from-blue-500/10 to-brand-green/10 border border-blue-500/20 cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-brand-green" />
                        <h4 className="text-sm font-bold text-white">{activeIDP.title}</h4>
                    </div>
                    {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
                <div className="flex items-center gap-4 text-[10px] text-gray-400 uppercase tracking-wider">
                    <span>{daysRemaining} days left</span>
                    <span>{completedCount}/{milestones.length} milestones</span>
                    <span>{progress}% complete</span>
                </div>
                <div className="w-full h-1.5 bg-gray-800 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-brand-green rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
            </div>

            {expanded && (
                <>
                    {/* Focus Areas */}
                    <div className="flex flex-wrap gap-1.5">
                        {(activeIDP.focus_areas || []).map(area => (
                            <span key={area} className="text-[10px] px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 font-bold uppercase">
                                {area}
                            </span>
                        ))}
                    </div>

                    {/* Milestones */}
                    <div className="space-y-2">
                        {milestones.map(ms => (
                            <div
                                key={ms.id}
                                onClick={() => toggleMilestone(ms)}
                                className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                                    readOnly ? '' : 'cursor-pointer hover:bg-white/5'
                                } ${ms.status === 'completed' ? 'bg-brand-green/5 border-brand-green/20' : 'bg-white/5 border-white/5'}`}
                            >
                                {ms.status === 'completed' ? (
                                    <CheckCircle className="w-5 h-5 text-brand-green shrink-0 mt-0.5" />
                                ) : (
                                    <Circle className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${ms.status === 'completed' ? 'text-gray-400 line-through' : 'text-white'}`}>
                                        {ms.title}
                                    </p>
                                    {ms.target_date && (
                                        <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(ms.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default IDPBuilder;
