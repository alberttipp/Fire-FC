import React, { useEffect, useMemo, useState } from 'react';
import { Search, UserPlus, X, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useToast } from '../Toast';
import { getPlayerAvatarPath } from '../../utils/playerAvatar';

// Picker used when a player already exists in the club but isn't on this
// team. Calls search_org_players() then add_player_to_team() — both
// SECURITY DEFINER, so RLS doesn't get in the way for staff/directors.
const AddExistingPlayerModal = ({ teamId, teamName, onClose, onAdded }) => {
    const toast = useToast();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [adding, setAdding] = useState(null); // player_id being added
    const [jerseyByPlayer, setJerseyByPlayer] = useState({});

    // Debounce search input — keeps the search RPC quiet while typing.
    const debouncedQuery = useDebounced(query, 200);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!teamId) return;
            setSearching(true);
            const { data, error } = await supabase.rpc('search_org_players', {
                p_team_id: teamId,
                p_query: (debouncedQuery || '').trim(),
            });
            if (cancelled) return;
            if (error) {
                console.error('[AddExistingPlayerModal] search failed', error);
                setResults([]);
            } else {
                setResults(data || []);
            }
            setSearching(false);
        };
        run();
        return () => { cancelled = true; };
    }, [teamId, debouncedQuery]);

    const handleAdd = async (player) => {
        const jerseyRaw = jerseyByPlayer[player.id];
        const jerseyNum = jerseyRaw ? parseInt(jerseyRaw, 10) : null;
        if (jerseyRaw && (isNaN(jerseyNum) || jerseyNum < 1 || jerseyNum > 99)) {
            toast.error('Jersey must be 1–99 (or leave blank).');
            return;
        }
        setAdding(player.id);
        try {
            const { error } = await supabase.rpc('add_player_to_team', {
                p_player_id: player.id,
                p_team_id: teamId,
                p_jersey_number: jerseyNum,
                p_position: null,
            });
            if (error) throw error;
            toast.success(`${player.first_name} ${player.last_name} added to ${teamName || 'team'}.`);
            if (onAdded) onAdded(player);
            // Drop from local results so the same kid can't be added twice
            // before the modal closes.
            setResults(prev => prev.filter(r => r.id !== player.id));
        } catch (err) {
            console.error('[AddExistingPlayerModal] add failed', err);
            toast.error(err.message || 'Could not add player.');
        } finally {
            setAdding(null);
        }
    };

    const empty = !searching && results.length === 0;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end md:items-center justify-center md:p-4 animate-fade-in">
            <div className="bg-brand-dark border border-white/10 rounded-t-2xl md:rounded-2xl w-full md:max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="p-6 md:p-8">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 bg-brand-gold/15 rounded-xl">
                            <UserPlus className="w-6 h-6 text-brand-gold" />
                        </div>
                        <div>
                            <h2 className="text-xl font-display font-bold text-white uppercase tracking-wider">
                                Add Existing Player
                            </h2>
                            <p className="text-gray-400 text-xs">
                                Pull a player from another team in your club into <span className="text-white font-bold">{teamName || 'this team'}</span>.
                            </p>
                        </div>
                    </div>

                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search by name…"
                            className="w-full bg-black/50 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                            autoFocus
                        />
                    </div>

                    {empty && (
                        <p className="text-center text-gray-500 text-sm py-8">
                            No matching players in your club aren't already on this team.
                        </p>
                    )}

                    {searching && (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
                        </div>
                    )}

                    <div className="space-y-2">
                        {results.map(p => {
                            const onOtherTeams = (p.current_teams || []).length > 0;
                            const avatarSrc = getPlayerAvatarPath({
                                avatarUrl: p.avatar_url || null,
                                firstName: p.first_name || '',
                                lastName: p.last_name || '',
                                displayName: `${p.first_name || ''} ${p.last_name || ''}`.trim()
                            });
                            return (
                                <div
                                    key={p.id}
                                    className="flex flex-col gap-2 p-3 bg-white/[0.04] rounded-lg border border-white/5 hover:border-brand-gold/40 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-800 border border-white/10">
                                            <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-white font-bold truncate">{p.first_name} {p.last_name}</div>
                                            <div className="text-[11px] text-gray-400 truncate">
                                                {onOtherTeams
                                                    ? <>Also on: <span className="text-brand-gold">{p.current_teams.join(', ')}</span></>
                                                    : <span className="text-gray-500">No active team</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            placeholder="#"
                                            min="1" max="99"
                                            value={jerseyByPlayer[p.id] ?? ''}
                                            onChange={(e) => setJerseyByPlayer(prev => ({ ...prev, [p.id]: e.target.value }))}
                                            className="w-20 bg-black/40 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:border-brand-green outline-none"
                                        />
                                        <button
                                            onClick={() => handleAdd(p)}
                                            disabled={adding === p.id}
                                            className="flex-1 bg-brand-green/10 text-brand-green border border-brand-green/30 hover:bg-brand-green/20 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {adding === p.id
                                                ? <><Loader2 className="w-3 h-3 animate-spin" /> Adding…</>
                                                : <><UserPlus className="w-3 h-3" /> Add to {teamName ? teamName.split(' ')[0] : 'team'}</>}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

function useDebounced(value, delayMs) {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), delayMs);
        return () => clearTimeout(t);
    }, [value, delayMs]);
    return v;
}

export default AddExistingPlayerModal;
