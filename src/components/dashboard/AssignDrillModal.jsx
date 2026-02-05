import React, { useState, useMemo, useEffect } from 'react';
import { X, Sparkles, User, Users, Check, Search, Filter } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

const AssignDrillModal = ({ onClose }) => {
    const { user, profile } = useAuth();
    const [step, setStep] = useState(1); // 1: Select Drill, 2: Select Assignees
    const [drills, setDrills] = useState([]);
    const [selectedDrills, setSelectedDrills] = useState([]); // Array of drill IDs
    const [customDurations, setCustomDurations] = useState({}); // { drillId: minutes }
    const [assigneeType, setAssigneeType] = useState('team'); // 'team' or 'individual'
    const [teams, setTeams] = useState([]); // Real teams from database
    const [selectedTeamId, setSelectedTeamId] = useState(null);
    const [teamPlayers, setTeamPlayers] = useState([]); // Players on selected team
    const [selectedPlayerIds, setSelectedPlayerIds] = useState([]); // For individual selection
    const [timeframe, setTimeframe] = useState(7); // Default 1 week
    const [generating, setGenerating] = useState(false);
    const [loadingPlayers, setLoadingPlayers] = useState(false);

    // Fetch Drills and Teams on Mount
    useEffect(() => {
        const fetchDrills = async () => {
            const { data, error } = await supabase
                .from('drills')
                .select('*');

            if (error) {
                console.error("Error fetching drills:", error.message);
                setDrills([]);
            } else {
                setDrills(data || []);
            }
        };

        const fetchTeams = async () => {
            const { data, error } = await supabase
                .from('teams')
                .select('id, name, age_group')
                .order('age_group', { ascending: true });

            if (error) {
                console.error("Error fetching teams:", error.message);
                setTeams([]);
            } else {
                setTeams(data || []);
                // Select first team by default if available
                if (data && data.length > 0) {
                    setSelectedTeamId(data[0].id);
                }
            }
        };

        fetchDrills();
        fetchTeams();
    }, []);

    // Fetch players when team is selected
    useEffect(() => {
        const fetchPlayersForTeam = async () => {
            if (!selectedTeamId) {
                setTeamPlayers([]);
                return;
            }
            setLoadingPlayers(true);
            const { data, error } = await supabase
                .from('players')
                .select('id, first_name, last_name, jersey_number')
                .eq('team_id', selectedTeamId)
                .order('last_name', { ascending: true });

            if (error) {
                console.error("Error fetching players:", error.message);
                setTeamPlayers([]);
            } else {
                setTeamPlayers(data || []);
            }
            setLoadingPlayers(false);
        };

        fetchPlayersForTeam();
    }, [selectedTeamId]);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [skillFilter, setSkillFilter] = useState('All');
    const [playerFilter, setPlayerFilter] = useState('All');

    // Extract unique filter options (handle both column naming conventions)
    const skills = ['All', ...new Set(drills.map(d => d.skill || d.category).filter(Boolean))];
    const playerTypes = ['All', ...new Set(drills.map(d => d.players || d.group_size).filter(Boolean))];

    // Filter Logic
    const filteredDrills = useMemo(() => {
        return drills.filter(drill => {
            const drillName = drill.name || drill.title || '';
            const drillSkill = drill.skill || drill.category || '';
            const drillPlayers = drill.players || drill.group_size || '';
            const matchesSearch = drillName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesSkill = skillFilter === 'All' || drillSkill === skillFilter;
            const matchesPlayers = playerFilter === 'All' || drillPlayers === playerFilter;
            return matchesSearch && matchesSkill && matchesPlayers;
        });
    }, [drills, searchTerm, skillFilter, playerFilter]);

    const toggleDrill = (id) => {
        if (selectedDrills.includes(id)) {
            setSelectedDrills(selectedDrills.filter(d => d !== id));
            const newDurations = { ...customDurations };
            delete newDurations[id];
            setCustomDurations(newDurations);
        } else {
            setSelectedDrills([...selectedDrills, id]);
            // Initialize with default duration
            const drill = drills.find(d => d.id === id);
            setCustomDurations(prev => ({ ...prev, [id]: drill.duration_minutes || drill.duration }));
        }
    };

    const handleDurationChange = (e, id) => {
        e.stopPropagation(); // Prevent toggling selection
        const val = parseInt(e.target.value) || 0;
        setCustomDurations(prev => ({ ...prev, [id]: val }));
    };

    const handleAutoGenerate = () => {
        setGenerating(true);
        setTimeout(() => {
            // Filter to solo drills only
            const soloDrills = drills.filter(d => {
                const groupSize = (d.players || d.group_size || '').toLowerCase();
                return groupSize === 'solo' || groupSize === 'individual' || groupSize === '1';
            });

            // Use solo drills if available, otherwise fall back to all drills
            const availableDrills = soloDrills.length > 0 ? soloDrills : drills;

            if (availableDrills.length > 0) {
                // Shuffle drills for variety
                const shuffled = [...availableDrills].sort(() => 0.5 - Math.random());

                // Keep adding drills until we reach ~100 minutes
                const TARGET_MINUTES = 100;
                const selected = [];
                let totalMinutes = 0;

                for (const drill of shuffled) {
                    const drillDuration = drill.duration_minutes || drill.duration || 10;
                    if (totalMinutes + drillDuration <= TARGET_MINUTES + 15) { // Allow slight overflow
                        selected.push(drill);
                        totalMinutes += drillDuration;
                    }
                    // Stop when we've reached target (allow going slightly over)
                    if (totalMinutes >= TARGET_MINUTES) break;
                }

                // If we haven't reached 100 mins, loop through again with remaining drills
                if (totalMinutes < TARGET_MINUTES && shuffled.length > 0) {
                    let idx = 0;
                    while (totalMinutes < TARGET_MINUTES && idx < shuffled.length * 2) {
                        const drill = shuffled[idx % shuffled.length];
                        // Only add if not already in selected (avoid duplicates in first pass)
                        if (!selected.find(s => s.id === drill.id) || idx >= shuffled.length) {
                            const drillDuration = drill.duration_minutes || drill.duration || 10;
                            selected.push({ ...drill, _duplicateIndex: idx }); // Mark as potential duplicate
                            totalMinutes += drillDuration;
                        }
                        idx++;
                    }
                }

                const ids = selected.map(d => d.id);
                setSelectedDrills(ids);

                const newDurations = {};
                selected.forEach(d => {
                    newDurations[d.id] = d.duration_minutes || d.duration || 10;
                });
                setCustomDurations(newDurations);
            }
            setGenerating(false);
        }, 1500);
    }

    const handleAssign = async () => {
        try {
            // 1. Identify Players
            let targetPlayerIds = [];

            if (assigneeType === 'team') {
                // Assign to all players on the selected team
                if (!selectedTeamId) {
                    alert("Please select a team first.");
                    return;
                }
                // Use already-fetched teamPlayers
                targetPlayerIds = teamPlayers.map(p => p.id);
            } else {
                // Use the individually selected players
                targetPlayerIds = selectedPlayerIds;
            }

            if (targetPlayerIds.length === 0) {
                alert("No players selected. Please select at least one player to assign drills to.");
                return;
            }

            // 2. Create Assignment Rows
            const dueDate = new Date(Date.now() + timeframe * 24 * 60 * 60 * 1000);
            const assignments = [];

            targetPlayerIds.forEach(playerId => {
                selectedDrills.forEach(drillId => {
                    assignments.push({
                        drill_id: drillId,
                        player_id: playerId,
                        team_id: selectedTeamId,
                        status: 'pending',
                        due_date: dueDate.toISOString()
                    });
                });
            });

            // 3. Insert to Supabase
            const { data, error } = await supabase
                .from('assignments')
                .insert(assignments)
                .select();

            if (error) {
                console.error('Insert error details:', error);
                throw error;
            }

            alert(`Successfully assigned ${selectedDrills.length} drills to ${targetPlayerIds.length} players!`);
            onClose();

        } catch (error) {
            console.error("Assignment Error:", error);
            alert("Failed to assign drills. See console.");
        }
    }

    const getTotalDuration = () => {
        return selectedDrills.reduce((acc, id) => acc + (customDurations[id] || 0), 0);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-brand-dark border border-white/10 w-full max-w-4xl rounded-xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-gradient-to-r from-brand-dark to-gray-900 p-6 border-b border-white/10 flex justify-between items-center shrink-0">
                    <h2 className="text-xl text-white font-display uppercase font-bold tracking-wider">
                        Assign <span className="text-brand-green">Training</span>
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                <p className="text-gray-400 text-sm uppercase tracking-widest">Step 1: Select Drills</p>
                                <button
                                    onClick={handleAutoGenerate}
                                    className="flex items-center gap-2 text-xs font-bold uppercase text-brand-gold bg-brand-gold/10 px-3 py-1.5 rounded border border-brand-gold/20 hover:bg-brand-gold/20 transition-colors w-fit"
                                >
                                    <Sparkles className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
                                    {generating ? 'AI Generating...' : 'Auto-Generate Week'}
                                </button>
                            </div>

                            {/* Filters & Search */}
                            <div className="flex flex-col md:flex-row gap-4 bg-white/5 p-4 rounded-lg border border-white/10">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input
                                        type="text"
                                        placeholder="Search drills..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-black/30 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white text-sm focus:border-brand-green outline-none"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <select
                                        value={skillFilter}
                                        onChange={(e) => setSkillFilter(e.target.value)}
                                        className="bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:border-brand-green outline-none"
                                    >
                                        {skills.map(s => <option key={s} value={s}>{s} Skills</option>)}
                                    </select>
                                    <select
                                        value={playerFilter}
                                        onChange={(e) => setPlayerFilter(e.target.value)}
                                        className="bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:border-brand-green outline-none"
                                    >
                                        {playerTypes.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Drills Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {filteredDrills.map(drill => {
                                    const isSelected = selectedDrills.includes(drill.id);
                                    return (
                                        <div
                                            key={drill.id}
                                            onClick={() => toggleDrill(drill.id)}
                                            className={`p-4 rounded-lg border cursor-pointer transition-all relative group ${isSelected ? 'bg-brand-green/10 border-brand-green ring-1 ring-brand-green' : 'bg-white/5 border-white/5 hover:border-white/20'}`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${isSelected ? 'bg-brand-green text-brand-dark' : 'bg-gray-700 text-gray-300'}`}>
                                                    {drill.skill || drill.category || 'General'} - {drill.players || drill.group_size || 'Any'}
                                                </span>
                                                {isSelected && <Check className="w-4 h-4 text-brand-green" />}
                                            </div>
                                            <h4 className="text-white font-bold font-display uppercase text-sm">{drill.name || drill.title}</h4>

                                            {/* Duration Control */}
                                            <div className="mt-3 flex items-center justify-between">
                                                <span className="text-xs text-gray-400">Duration (min):</span>
                                                {isSelected ? (
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="60"
                                                        value={customDurations[drill.id] || drill.duration_minutes || drill.duration || 10}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onChange={(e) => handleDurationChange(e, drill.id)}
                                                        className="w-16 bg-black/50 border border-brand-green rounded px-2 py-1 text-white text-sm text-center font-bold outline-none"
                                                    />
                                                ) : (
                                                    <span className="text-xs text-gray-400 font-bold">{drill.duration_minutes || drill.duration || 10}</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <p className="text-gray-400 text-sm uppercase tracking-widest">Step 2: Assign To</p>

                            {/* Assignee Type Selector */}
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setAssigneeType('team')}
                                    className={`flex-1 p-4 rounded-lg border flex flex-col items-center justify-center gap-2 transition-colors ${assigneeType === 'team' ? 'bg-brand-green text-brand-dark border-brand-green font-bold' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'}`}
                                >
                                    <Users className="w-6 h-6" />
                                    <span className="uppercase font-display tracking-wider">Whole Team</span>
                                </button>
                                <button
                                    onClick={() => setAssigneeType('individual')}
                                    className={`flex-1 p-4 rounded-lg border flex flex-col items-center justify-center gap-2 transition-colors ${assigneeType === 'individual' ? 'bg-brand-green text-brand-dark border-brand-green font-bold' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'}`}
                                >
                                    <User className="w-6 h-6" />
                                    <span className="uppercase font-display tracking-wider">Individual Players</span>
                                </button>
                            </div>

                            {assigneeType === 'team' ? (
                                <div>
                                    <label className="block text-gray-400 text-xs uppercase font-bold mb-2">Select Team</label>
                                    {teams.length === 0 ? (
                                        <div className="text-gray-500 text-sm p-3 border border-dashed border-white/10 rounded">
                                            No teams found. Create a team first.
                                        </div>
                                    ) : (
                                        <select
                                            value={selectedTeamId || ''}
                                            onChange={(e) => setSelectedTeamId(e.target.value)}
                                            className="w-full bg-black/30 border border-white/10 rounded p-3 text-white focus:border-brand-green outline-none"
                                        >
                                            {teams.map(team => (
                                                <option key={team.id} value={team.id}>
                                                    {team.age_group || team.name}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    {teamPlayers.length > 0 && (
                                        <p className="text-xs text-gray-500 mt-2">
                                            {teamPlayers.length} player{teamPlayers.length !== 1 ? 's' : ''} on this team
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-gray-400 text-xs uppercase font-bold mb-2">Select Team First</label>
                                    <select
                                        value={selectedTeamId || ''}
                                        onChange={(e) => {
                                            setSelectedTeamId(e.target.value);
                                            setSelectedPlayerIds([]); // Reset selection when team changes
                                        }}
                                        className="w-full bg-black/30 border border-white/10 rounded p-3 text-white focus:border-brand-green outline-none mb-4"
                                    >
                                        {teams.map(team => (
                                            <option key={team.id} value={team.id}>
                                                {team.age_group || team.name}
                                            </option>
                                        ))}
                                    </select>

                                    <label className="block text-gray-400 text-xs uppercase font-bold mb-2">Select Players</label>
                                    {loadingPlayers ? (
                                        <div className="text-gray-500 text-sm p-4 text-center">Loading players...</div>
                                    ) : teamPlayers.length === 0 ? (
                                        <div className="text-center py-4 text-gray-500 border border-dashed border-white/10 rounded bg-white/5">
                                            <p>No players on this team yet.</p>
                                        </div>
                                    ) : (
                                        <div className="max-h-48 overflow-y-auto space-y-2 p-2 bg-white/5 rounded border border-white/10">
                                            {teamPlayers.map(player => {
                                                const isSelected = selectedPlayerIds.includes(player.id);
                                                return (
                                                    <label
                                                        key={player.id}
                                                        className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${isSelected ? 'bg-brand-green/20 border border-brand-green/50' : 'hover:bg-white/10 border border-transparent'}`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => {
                                                                if (isSelected) {
                                                                    setSelectedPlayerIds(prev => prev.filter(id => id !== player.id));
                                                                } else {
                                                                    setSelectedPlayerIds(prev => [...prev, player.id]);
                                                                }
                                                            }}
                                                            className="w-4 h-4 accent-brand-green"
                                                        />
                                                        <span className="text-white text-sm">
                                                            {player.first_name} {player.last_name}
                                                        </span>
                                                        {player.jersey_number && (
                                                            <span className="text-xs text-gray-500">#{player.jersey_number}</span>
                                                        )}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {selectedPlayerIds.length > 0 && (
                                        <p className="text-xs text-brand-green mt-2">
                                            {selectedPlayerIds.length} player{selectedPlayerIds.length !== 1 ? 's' : ''} selected
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="bg-white/5 p-4 rounded border border-white/10 space-y-4">
                                <div>
                                    <label className="block text-gray-400 text-xs uppercase font-bold mb-2">Completion Timeframe</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { label: '24 Hours', days: 1 },
                                            { label: '3 Days', days: 3 },
                                            { label: '5 Days', days: 5 },
                                            { label: '1 Week', days: 7 },
                                        ].map(opt => (
                                            <button
                                                key={opt.days}
                                                onClick={() => setTimeframe(opt.days)}
                                                className={`py-2 px-1 rounded text-xs font-bold uppercase border transition-all ${timeframe === opt.days
                                                    ? 'bg-brand-gold text-brand-dark border-brand-gold'
                                                    : 'bg-black/30 text-gray-400 border-white/10 hover:border-white/30'
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-white font-bold font-display uppercase mb-2">Summary</h4>
                                    <div className="flex justify-between text-sm text-gray-400">
                                        <span>Drills Selected:</span>
                                        <span className="text-white">{selectedDrills.length}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-gray-400">
                                        <span>Total Duration:</span>
                                        <span className="text-white">
                                            {getTotalDuration()} Mins
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm text-gray-400">
                                        <span>Due Date:</span>
                                        <span className="text-brand-gold">
                                            {new Date(Date.now() + timeframe * 24 * 60 * 60 * 1000).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-6 border-t border-white/10 bg-black/20 flex justify-between">
                    {step === 2 ? (
                        <button
                            onClick={() => setStep(1)}
                            className="px-6 py-2 text-gray-400 hover:text-white uppercase font-bold text-sm tracking-wider"
                        >
                            Back
                        </button>
                    ) : (
                        <div></div> // Spacer
                    )}

                    {step === 1 ? (
                        <button
                            onClick={() => setStep(2)}
                            disabled={selectedDrills.length === 0}
                            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next Step
                        </button>
                    ) : (
                        <button
                            onClick={handleAssign}
                            className="btn-primary"
                        >
                            Confirm Assignment
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AssignDrillModal;
