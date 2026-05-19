import React, { useEffect, useState, lazy, Suspense } from 'react';
import { X, Loader2, Target, ChevronRight } from 'lucide-react';
import { supabase } from '../../supabaseClient';
const IDPBuilderModal = lazy(() => import('../dashboard/IDPBuilderModal'));

// Per-player IDP block progress. Lists active IDPs with mastery count;
// tapping a row opens the existing IDPBuilderModal for edit.
const IDPProgressDrilldown = ({ teamId, onClose }) => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null); // { player, existingIDP, existingSkills }
    const [opening, setOpening] = useState(false);

    const load = async () => {
        setLoading(true);
        const { data: roster } = await supabase
            .from('player_teams')
            .select('player_id, players!inner(id,first_name,last_name,jersey_number)')
            .eq('team_id', teamId).eq('status', 'active');
        const ids = (roster || []).map(r => r.player_id);
        if (ids.length === 0) { setRows([]); setLoading(false); return; }

        const { data: idps } = await supabase
            .from('player_idps')
            .select('id, player_id, title, status, current_block, block_duration_days, start_date')
            .in('player_id', ids)
            .eq('status', 'active');
        const idpIds = (idps || []).map(i => i.id);

        const { data: progress } = idpIds.length > 0 ? await supabase
            .from('idp_skill_progress')
            .select('idp_id, block_number, status')
            .in('idp_id', idpIds) : { data: [] };

        const masteredByIdp = new Map();
        const totalByIdp = new Map();
        (progress || []).forEach(p => {
            const matched = idps.find(i => i.id === p.idp_id);
            if (!matched || p.block_number !== matched.current_block) return;
            totalByIdp.set(p.idp_id, (totalByIdp.get(p.idp_id) || 0) + 1);
            if (p.status === 'mastered') masteredByIdp.set(p.idp_id, (masteredByIdp.get(p.idp_id) || 0) + 1);
        });

        const idpByPlayer = new Map();
        (idps || []).forEach(i => idpByPlayer.set(i.player_id, i));

        const list = (roster || []).map(r => {
            const p = r.players;
            const idp = idpByPlayer.get(p.id);
            return {
                player: p,
                name: `${p.first_name} ${p.last_name?.charAt(0) || ''}.`,
                jersey: p.jersey_number,
                idp,
                mastered: idp ? (masteredByIdp.get(idp.id) || 0) : 0,
                total:    idp ? (totalByIdp.get(idp.id)    || 0) : 0,
            };
        }).sort((a, b) => (b.idp ? 1 : 0) - (a.idp ? 1 : 0));
        setRows(list);
        setLoading(false);
    };

    // Open IDPBuilderModal — fetch the player's IDP skills first so the
    // modal has the full picture (matches how IDPHub launches it).
    const openEditor = async (row) => {
        if (!row.idp || opening) return;
        setOpening(true);
        try {
            const { data: skills } = await supabase
                .from('idp_skills')
                .select('*')
                .eq('idp_id', row.idp.id)
                .order('block_number', { ascending: true });
            setEditing({ player: row.player, existingIDP: row.idp, existingSkills: skills || [] });
        } finally {
            setOpening(false);
        }
    };

    useEffect(() => { load(); }, [teamId]);

    return (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
            <div className="bg-brand-dark border border-white/10 rounded-t-2xl md:rounded-2xl w-full md:max-w-md max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-white font-bold flex items-center gap-2"><Target className="w-4 h-4 text-brand-gold" /> IDP Progress</h3>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="overflow-y-auto p-3">
                    {loading ? (
                        <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>
                    ) : rows.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-6">No active players.</p>
                    ) : (
                        <ul className="space-y-1">
                            {rows.map(r => (
                                <li key={r.player.id}>
                                    <button
                                        type="button"
                                        onClick={() => openEditor(r)}
                                        disabled={!r.idp || opening}
                                        className={`w-full flex items-center gap-3 p-2 rounded text-left ${r.idp ? 'bg-white/5 hover:bg-white/10' : 'bg-white/[0.02] opacity-60'}`}
                                    >
                                        <span className="w-7 text-center text-xs font-bold text-gray-400">#{r.jersey ?? '—'}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-white text-sm font-medium">{r.name}</div>
                                            <div className="text-[11px] text-gray-500 truncate">
                                                {r.idp ? `Block ${r.idp.current_block} · ${r.mastered}/${r.total} mastered` : 'No active IDP'}
                                            </div>
                                        </div>
                                        {r.idp && <ChevronRight className="w-4 h-4 text-gray-500" />}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {editing && (
                <Suspense fallback={null}>
                    <IDPBuilderModal
                        player={editing.player}
                        existingIDP={editing.existingIDP}
                        existingSkills={editing.existingSkills}
                        onClose={(didChange) => { setEditing(null); if (didChange) load(); }}
                    />
                </Suspense>
            )}
        </div>
    );
};

export default IDPProgressDrilldown;
