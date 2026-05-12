import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Target, ChevronRight, Loader2, AlertCircle, Plus, Search } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import { SKILL_BY_SLUG } from '../../data/idpSkills';

const IDPBuilderModal = lazy(() => import('./IDPBuilderModal'));

// Coach-side IDP hub. One tile per player on the user's team(s); shows
// current block, days remaining, and mastered/total in that block.
// Tap a tile → IDPBuilderModal for that player.

const IDPHub = () => {
    const { user } = useAuth();
    const toast = useToast();
    const [players, setPlayers] = useState([]);
    const [idpById, setIdpById] = useState({}); // player_id -> { idp, skills: [...] }
    const [fetchState, setFetchState] = useState('loading'); // 'loading'|'ready'|'error'
    const [fetchError, setFetchError] = useState(null);
    const [search, setSearch] = useState('');
    const [openPlayer, setOpenPlayer] = useState(null);
    const fetchRef = useRef(null);

    const fetchData = async ({ attempt = 1 } = {}) => {
        if (fetchRef.current) return fetchRef.current;
        const inflight = (async () => {
            setFetchState('loading');
            setFetchError(null);
            try {
                // RLS scopes to teams the user is staff on.
                const { data: roster, error: rosterErr } = await supabase
                    .from('players')
                    .select('id, first_name, last_name, display_name, jersey_number, position, team_id, user_id, teams:team_id(name, age_group)')
                    .order('jersey_number', { ascending: true });
                if (rosterErr) throw rosterErr;

                const ids = (roster || []).map((p) => p.id);
                if (ids.length === 0) {
                    setPlayers([]);
                    setIdpById({});
                    setFetchState('ready');
                    return true;
                }

                const { data: idps, error: idpErr } = await supabase
                    .from('player_idps')
                    .select('id, player_id, title, start_date, end_date, status, current_block, block_duration_days')
                    .in('player_id', ids)
                    .eq('status', 'active');
                if (idpErr) throw idpErr;

                const idpIds = (idps || []).map((i) => i.id);
                let progressRows = [];
                if (idpIds.length > 0) {
                    const { data, error: progErr } = await supabase
                        .from('idp_skill_progress')
                        .select('idp_id, block_number, skill_slug, status')
                        .in('idp_id', idpIds);
                    if (progErr) throw progErr;
                    progressRows = data || [];
                }

                const byPlayer = {};
                for (const idp of idps || []) {
                    const skills = progressRows.filter((r) => r.idp_id === idp.id);
                    byPlayer[idp.player_id] = { idp, skills };
                }

                setPlayers(roster || []);
                setIdpById(byPlayer);
                setFetchState('ready');
                return true;
            } catch (err) {
                console.error('[IDPHub] fetch error', attempt, err);
                if (attempt < 2) {
                    fetchRef.current = null;
                    await new Promise((r) => setTimeout(r, 700));
                    return fetchData({ attempt: attempt + 1 });
                }
                setFetchState('error');
                setFetchError(err.message || "Couldn't load IDPs.");
                return false;
            }
        })();
        fetchRef.current = inflight;
        try {
            return await inflight;
        } finally {
            fetchRef.current = null;
        }
    };

    useEffect(() => {
        fetchData();
    }, [user?.id]);

    const handleModalClose = (didChange) => {
        setOpenPlayer(null);
        if (didChange) fetchData();
    };

    const filtered = players.filter((p) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const name = `${p.first_name || ''} ${p.last_name || ''} ${p.display_name || ''}`.toLowerCase();
        return name.includes(q);
    });

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="w-10 h-10 rounded-full bg-brand-gold/20 flex items-center justify-center">
                    <Target className="w-5 h-5 text-brand-gold" />
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-display font-bold text-white uppercase tracking-wider leading-none">
                        Player Development Plans
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">Build, track, and graduate each kid through a 90-day arc.</p>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search players…"
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-3 py-2 text-sm text-white outline-none focus:border-brand-green"
                />
            </div>

            {/* Body */}
            {fetchState === 'loading' && (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-7 h-7 text-brand-green animate-spin" />
                </div>
            )}

            {fetchState === 'error' && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-red-300 text-sm mb-2">Couldn't load IDPs.</p>
                        <button
                            onClick={() => fetchData()}
                            className="px-3 py-1.5 bg-red-500/20 border border-red-500/40 rounded text-xs text-red-200 hover:bg-red-500/30"
                        >
                            Retry
                        </button>
                        {fetchError && <p className="text-xs text-gray-500 mt-2">Details: {fetchError}</p>}
                    </div>
                </div>
            )}

            {fetchState === 'ready' && filtered.length === 0 && (
                <p className="text-gray-500 text-sm py-10 text-center">
                    {search.trim() ? 'No players match that name.' : 'No players on your team yet.'}
                </p>
            )}

            {fetchState === 'ready' && filtered.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((p) => (
                        <IDPTile
                            key={p.id}
                            player={p}
                            idpBundle={idpById[p.id] || null}
                            onOpen={() => setOpenPlayer(p)}
                        />
                    ))}
                </div>
            )}

            {/* Builder Modal */}
            {openPlayer && (
                <Suspense fallback={null}>
                    <IDPBuilderModal
                        player={openPlayer}
                        existingIDP={idpById[openPlayer.id]?.idp || null}
                        existingSkills={idpById[openPlayer.id]?.skills || []}
                        onClose={(didChange) => handleModalClose(didChange)}
                        onToast={(type, msg) => toast[type]?.(msg)}
                    />
                </Suspense>
            )}
        </div>
    );
};

// One player tile. Read-only summary; tap opens the builder modal.
const IDPTile = ({ player, idpBundle, onOpen }) => {
    const name = player.display_name || `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Player';
    const jersey = player.jersey_number ?? '?';

    if (!idpBundle) {
        return (
            <button
                onClick={onOpen}
                className="text-left p-4 rounded-2xl border-2 border-dashed border-white/15 hover:border-brand-green/40 hover:bg-white/5 transition-colors group"
            >
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold font-bold text-sm">
                        #{jersey}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-white font-bold truncate">{name}</p>
                        <p className="text-xs text-gray-500 truncate">{player.position || 'Position TBD'}</p>
                    </div>
                </div>
                <div className="py-6 flex flex-col items-center justify-center gap-2 text-center text-gray-400 group-hover:text-brand-green transition-colors">
                    <Plus className="w-6 h-6" />
                    <span className="text-xs font-bold uppercase tracking-wider">Start IDP</span>
                </div>
            </button>
        );
    }

    const { idp, skills } = idpBundle;
    const blockSkills = skills.filter((s) => s.block_number === (idp.current_block || 1));
    const mastered = blockSkills.filter((s) => s.status === 'mastered').length;
    const total = blockSkills.length || 0;
    const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
    const daysLeft = computeDaysLeftInBlock(idp);

    return (
        <button
            onClick={onOpen}
            className="text-left p-4 rounded-2xl bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] border-2 border-brand-gold/40 hover:border-brand-gold/70 transition-all shadow-lg hover:shadow-brand-gold/10 group"
        >
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-brand-gold/20 border border-brand-gold/30 flex items-center justify-center text-brand-gold font-bold text-sm shrink-0">
                    #{jersey}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-white font-bold truncate">{name}</p>
                    <p className="text-xs text-gray-500 truncate">{player.position || 'Position TBD'}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-brand-gold transition-colors" />
            </div>

            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-widest text-brand-green font-bold">
                    Block {idp.current_block || 1} of 3
                </span>
                {daysLeft !== null && (
                    <span className="text-[10px] uppercase tracking-widest text-gray-500">
                        {daysLeft >= 0 ? `${daysLeft}d left` : 'overdue'}
                    </span>
                )}
            </div>

            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-3">
                <div
                    className="h-full bg-gradient-to-r from-brand-green to-brand-gold rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                />
            </div>

            <p className="text-xs text-gray-400 mb-2">
                {mastered} of {total} skills mastered
            </p>

            <div className="flex flex-wrap gap-1.5">
                {blockSkills.slice(0, 4).map((s) => {
                    const meta = SKILL_BY_SLUG[s.skill_slug];
                    if (!meta) return null;
                    return (
                        <span
                            key={s.skill_slug}
                            className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${
                                s.status === 'mastered'
                                    ? 'bg-brand-green/15 border-brand-green/30 text-brand-green'
                                    : 'bg-white/5 border-white/10 text-gray-300'
                            }`}
                        >
                            {meta.icon} {meta.name}
                        </span>
                    );
                })}
                {blockSkills.length === 0 && (
                    <span className="text-[10px] text-gray-500 italic">No skills picked yet</span>
                )}
            </div>
        </button>
    );
};

function computeDaysLeftInBlock(idp) {
    try {
        const startDate = idp.start_date ? new Date(idp.start_date) : null;
        if (!startDate || isNaN(startDate.getTime())) return null;
        const blockLen = idp.block_duration_days || 30;
        const blockIndex = (idp.current_block || 1) - 1;
        const blockEnd = new Date(startDate);
        blockEnd.setDate(blockEnd.getDate() + (blockIndex + 1) * blockLen);
        const now = new Date();
        const ms = blockEnd.getTime() - now.getTime();
        return Math.ceil(ms / (1000 * 60 * 60 * 24));
    } catch {
        return null;
    }
}

export default IDPHub;
