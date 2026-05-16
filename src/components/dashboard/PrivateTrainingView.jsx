import React, { useEffect, useMemo, useState } from 'react';
import {
    Plus, Users, UserPlus, Search, Trash2, Settings, X,
    Save, Loader2, ChevronRight, Send, Mail, Pencil,
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import { useConfirm } from '../ConfirmDialog';
import BulkInviteModal from './BulkInviteModal';
import PrivateSessionsPanel from './PrivateSessionsPanel';

// =====================================================================
// Private Training — Phase A
//
// Each "private training group" is a teams row with team_type='private_group'.
// Group roster is managed via player_teams (same multi-team mechanism that
// supports kids on multiple club teams).
//
// "Add Current Player" = link an existing players record from one of the
// coach's other staff teams via player_teams. Shared identity, shared data.
// "Add New Player" = create a fresh players record + player_teams row,
// using the same Info fields the team Info tab captures.
//
// Phases B–D (deferred): sessions log + auto-credit, parent-side badge,
// billing placeholder. See task list for scope.
// =====================================================================

const STAFF_ROLES = new Set(['coach', 'manager', 'head_coach', 'assistant_coach', 'team_manager', 'director']);

const POSITIONS = [
    'Goalkeeper', 'Center Back', 'Fullback', 'Defensive Midfielder',
    'Center Midfielder', 'Attacking Midfielder', 'Winger', 'Striker', 'Anywhere',
];

const generateJoinCode = () => {
    const tail = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PT-${tail}`;
};

const generatePin = () => String(Math.floor(1000 + Math.random() * 9000));

const PrivateTrainingView = () => {
    const { user } = useAuth();
    const toast = useToast();
    const confirm = useConfirm();

    const [groups, setGroups] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [roster, setRoster] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [showCreate, setShowCreate] = useState(false);
    const [showAddCurrent, setShowAddCurrent] = useState(false);
    const [showAddNew, setShowAddNew] = useState(false);
    const [showInvite, setShowInvite] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [groupTab, setGroupTab] = useState('roster'); // 'roster' | 'sessions'

    const selected = useMemo(() => groups.find(g => g.id === selectedId) || null, [groups, selectedId]);

    // Pull the coach's org_id (from any team they're staff on) for new groups
    const orgId = useMemo(() => groups[0]?.org_id || null, [groups]);

    // ---- Fetch ----
    const fetchGroups = async () => {
        if (!user?.id) return;
        const { data: memberships, error } = await supabase
            .from('team_memberships')
            .select('role, teams!inner(id, name, team_type, org_id, join_code)')
            .eq('user_id', user.id);
        if (error) {
            console.error('[PrivateTraining] fetch groups failed:', error);
            setGroups([]);
            return;
        }
        const list = (memberships || [])
            .filter(m => STAFF_ROLES.has(m.role) && m.teams?.team_type === 'private_group')
            .map(m => ({ ...m.teams, role: m.role }))
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setGroups(list);
        if (!selectedId && list.length > 0) setSelectedId(list[0].id);
    };

    const fetchRoster = async (groupId) => {
        if (!groupId) { setRoster([]); return; }
        const { data, error } = await supabase
            .from('team_active_roster')
            .select('id, first_name, last_name, jersey_number, display_name, avatar_url, guardian_code, position')
            .eq('team_id', groupId)
            .order('last_name', { ascending: true });
        if (error) { console.error('[PrivateTraining] roster fetch:', error); setRoster([]); return; }
        setRoster(data || []);
    };

    useEffect(() => {
        (async () => {
            setLoading(true);
            await fetchGroups();
            setLoading(false);
        })();
    }, [user?.id]);

    useEffect(() => {
        if (selectedId) fetchRoster(selectedId);
    }, [selectedId]);

    // ---- Group CRUD ----
    const handleCreateGroup = async (name) => {
        const trimmed = (name || '').trim();
        if (!trimmed) { toast.error('Group needs a name.'); return; }

        // Find an org the user is staff on — required for the new teams row.
        const { data: memberships } = await supabase
            .from('team_memberships')
            .select('teams!inner(org_id)')
            .eq('user_id', user.id);
        const orgIdToUse = (memberships || []).find(m => m.teams?.org_id)?.teams?.org_id;
        if (!orgIdToUse) {
            toast.error("You need to be on at least one team in an org before creating a group.");
            return;
        }

        try {
            const { data: teamData, error: teamErr } = await supabase
                .from('teams')
                .insert({
                    name: trimmed,
                    age_group: 'Mixed',
                    team_type: 'private_group',
                    join_code: generateJoinCode(),
                    org_id: orgIdToUse,
                })
                .select()
                .single();
            if (teamErr) throw teamErr;

            const { error: memErr } = await supabase
                .from('team_memberships')
                .insert({ team_id: teamData.id, user_id: user.id, role: 'coach' });
            if (memErr) throw memErr;

            toast.success(`Created group "${trimmed}".`);
            setShowCreate(false);
            await fetchGroups();
            setSelectedId(teamData.id);
        } catch (err) {
            console.error('[PrivateTraining] create group failed:', err);
            toast.error(err?.message?.includes('policy')
                ? "You don't have permission to create groups here."
                : `Create failed: ${err?.message || 'Unknown error'}.`);
        }
    };

    const handleRenameGroup = async () => {
        const trimmed = (renameValue || '').trim();
        if (!trimmed || !selected) return;
        try {
            const { error } = await supabase.from('teams').update({ name: trimmed }).eq('id', selected.id);
            if (error) throw error;
            toast.success('Group renamed.');
            setRenaming(false);
            await fetchGroups();
        } catch (err) {
            console.error('[PrivateTraining] rename failed:', err);
            toast.error('Rename failed.');
        }
    };

    const handleDeleteGroup = async () => {
        if (!selected) return;
        const ok = await confirm({
            title: `Delete "${selected.name}"?`,
            body: `Removes the group and unlinks all ${roster.length} players from it. The players themselves stay — only their membership in THIS group is removed.`,
            confirmLabel: 'Delete group',
            destructive: true,
        });
        if (!ok) return;
        try {
            // Cascade handles player_teams + team_memberships via teams FK
            const { error } = await supabase.from('teams').delete().eq('id', selected.id);
            if (error) throw error;
            toast.success('Group deleted.');
            setSelectedId(null);
            await fetchGroups();
        } catch (err) {
            console.error('[PrivateTraining] delete group failed:', err);
            toast.error('Delete failed.');
        }
    };

    // ---- Add Current Player ----
    const handleLinkExistingPlayer = async (playerId) => {
        if (!selected) return;
        try {
            const { error } = await supabase
                .from('player_teams')
                .insert({ player_id: playerId, team_id: selected.id, status: 'active' });
            if (error) throw error;
            toast.success('Player added to group.');
            await fetchRoster(selected.id);
        } catch (err) {
            console.error('[PrivateTraining] link existing failed:', err);
            // PG23505 = unique violation → friendly message
            if (err?.code === '23505') toast.info('Already in this group.');
            else toast.error(err?.message || 'Add failed.');
        }
    };

    // ---- Add New Player (via create-player edge fn, then enrich) ----
    const handleCreateNewPlayer = async (form) => {
        if (!selected) return;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not signed in.');

            const jerseyNum = form.jersey ? parseInt(form.jersey, 10) : Math.floor(Math.random() * 89) + 10;
            const pin = generatePin();

            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-player`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                    },
                    body: JSON.stringify({
                        firstName: form.first_name.trim(),
                        lastName: form.last_name.trim(),
                        jerseyNumber: jerseyNum,
                        pin,
                        teamId: selected.id,
                    }),
                }
            );
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || 'Create-player failed');

            // Enrich with extra Info-tab fields the edge fn doesn't take
            const enrich = {};
            if (form.position)           enrich.position = form.position;
            if (form.position_secondary) enrich.position_secondary = form.position_secondary;
            if (form.birthdate)          enrich.birthdate = form.birthdate;
            if (form.display_name?.trim()) enrich.display_name = form.display_name.trim();
            if (Object.keys(enrich).length > 0) {
                await supabase.from('players').update(enrich).eq('id', result.player_id);
            }

            // Make sure they're on this group's player_teams (the edge fn might
            // only set the legacy team_id pointer; we want them in the
            // multi-team join too so team_active_roster picks them up).
            await supabase
                .from('player_teams')
                .upsert(
                    { player_id: result.player_id, team_id: selected.id, status: 'active' },
                    { onConflict: 'player_id,team_id' }
                );

            toast.success(`${result.display_name || form.first_name} added.`);
            await fetchRoster(selected.id);
            return true;
        } catch (err) {
            console.error('[PrivateTraining] create player failed:', err);
            toast.error(err?.message || 'Create failed.');
            return false;
        }
    };

    const handleRemoveFromGroup = async (player) => {
        if (!selected) return;
        const ok = await confirm({
            title: `Remove ${player.first_name} from this group?`,
            body: `Just removes them from "${selected.name}". Their player record and any other team memberships stay intact.`,
            confirmLabel: 'Remove',
            destructive: true,
        });
        if (!ok) return;
        try {
            const { error } = await supabase
                .from('player_teams')
                .delete()
                .eq('player_id', player.id)
                .eq('team_id', selected.id);
            if (error) throw error;
            toast.success('Removed.');
            await fetchRoster(selected.id);
        } catch (err) {
            console.error('[PrivateTraining] remove failed:', err);
            toast.error('Remove failed.');
        }
    };

    // ---- Render ----
    return (
        <div className="space-y-6 animate-fade-in-up">
            <div>
                <h2 className="text-3xl text-white font-display uppercase font-bold flex items-center gap-3">
                    <Users className="w-8 h-8 text-brand-gold" /> Private Training
                </h2>
                <p className="text-gray-400 text-sm">Build a private roster, share with families, log sessions later.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* LEFT: Groups list */}
                <div className="md:col-span-4 glass-panel p-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="text-xs uppercase font-bold tracking-wider text-gray-400">My groups</h3>
                        <button
                            onClick={() => setShowCreate(true)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider bg-brand-gold/15 border border-brand-gold/40 text-brand-gold hover:bg-brand-gold/25"
                        >
                            <Plus className="w-3 h-3" /> New
                        </button>
                    </div>

                    {loading ? (
                        <div className="text-center text-gray-500 text-sm py-4">Loading…</div>
                    ) : groups.length === 0 ? (
                        <div className="text-center py-6">
                            <Users className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                            <p className="text-gray-500 text-sm">No groups yet</p>
                            <button
                                onClick={() => setShowCreate(true)}
                                className="mt-3 text-brand-gold text-xs font-bold uppercase tracking-wider hover:text-white"
                            >
                                + Create your first group
                            </button>
                        </div>
                    ) : (
                        groups.map(g => (
                            <button
                                key={g.id}
                                onClick={() => { setSelectedId(g.id); setRenaming(false); }}
                                className={`flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                                    selectedId === g.id
                                        ? 'bg-brand-gold/10 border border-brand-gold/40 text-white'
                                        : 'bg-white/[0.03] border border-white/5 text-gray-300 hover:bg-white/5'
                                }`}
                            >
                                <span className="font-bold text-sm truncate">{g.name}</span>
                                <ChevronRight className={`w-4 h-4 shrink-0 ${selectedId === g.id ? 'text-brand-gold' : 'text-gray-600'}`} />
                            </button>
                        ))
                    )}
                </div>

                {/* RIGHT: Selected group */}
                <div className="md:col-span-8 glass-panel p-5">
                    {!selected ? (
                        <div className="text-center py-16 text-gray-500 text-sm">
                            Select or create a group to manage its roster.
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                                {renaming ? (
                                    <div className="flex items-center gap-2 flex-1">
                                        <input
                                            type="text"
                                            value={renameValue}
                                            onChange={(e) => setRenameValue(e.target.value)}
                                            autoFocus
                                            className="flex-1 bg-black/40 border border-brand-gold/40 rounded px-3 py-1.5 text-white text-sm"
                                        />
                                        <button onClick={handleRenameGroup} className="px-3 py-1.5 bg-brand-gold text-black text-xs font-bold uppercase rounded">Save</button>
                                        <button onClick={() => setRenaming(false)} className="px-3 py-1.5 text-gray-400 text-xs font-bold uppercase hover:text-white">Cancel</button>
                                    </div>
                                ) : (
                                    <h3 className="text-xl text-white font-display uppercase font-bold tracking-wider flex items-center gap-2">
                                        {selected.name}
                                        <button onClick={() => { setRenameValue(selected.name); setRenaming(true); }} className="text-gray-500 hover:text-white" aria-label="Rename">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                    </h3>
                                )}

                                <div className="flex items-center gap-2 flex-wrap">
                                    {groupTab === 'roster' && (
                                        <>
                                            <button
                                                onClick={() => setShowAddCurrent(true)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider bg-brand-green/10 border border-brand-green/30 text-brand-green hover:bg-brand-green/20"
                                            >
                                                <UserPlus className="w-3.5 h-3.5" /> Current Player
                                            </button>
                                            <button
                                                onClick={() => setShowAddNew(true)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10"
                                            >
                                                <Plus className="w-3.5 h-3.5" /> New Player
                                            </button>
                                            <button
                                                onClick={() => setShowInvite(true)}
                                                disabled={roster.length === 0}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                <Send className="w-3.5 h-3.5" /> Invite Families
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={handleDeleteGroup}
                                        className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                                        aria-label="Delete group"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Tab switcher: Roster | Sessions */}
                            <div className="flex gap-1 border-b border-white/10 mb-5">
                                <button
                                    onClick={() => setGroupTab('roster')}
                                    className={`pb-2.5 px-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${groupTab === 'roster' ? 'border-brand-gold text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                                >
                                    Roster ({roster.length})
                                </button>
                                <button
                                    onClick={() => setGroupTab('sessions')}
                                    className={`pb-2.5 px-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${groupTab === 'sessions' ? 'border-brand-gold text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                                >
                                    Sessions
                                </button>
                            </div>

                            {groupTab === 'sessions' ? (
                                <PrivateSessionsPanel
                                    groupId={selected.id}
                                    groupName={selected.name}
                                    roster={roster}
                                    orgId={selected.org_id}
                                />
                            ) : roster.length === 0 ? (
                                <div className="text-center py-12 border border-dashed border-white/10 rounded-lg">
                                    <UserPlus className="w-10 h-10 text-gray-700 mx-auto mb-2" />
                                    <p className="text-gray-500 text-sm">No players in this group yet</p>
                                    <p className="text-gray-600 text-xs mt-1">Tap "Current Player" to pull someone from another team, or "New Player" to add an outside trainee.</p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-white/5">
                                    {roster.map(p => (
                                        <li key={p.id} className="flex items-center justify-between py-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 border border-white/10 flex items-center justify-center shrink-0">
                                                    {p.avatar_url ? (
                                                        <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-brand-gold font-display font-bold text-sm">{p.first_name?.charAt(0) || '?'}</span>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-white text-sm font-bold truncate">{p.first_name} {p.last_name}</p>
                                                    <p className="text-gray-500 text-xs">
                                                        {p.position || 'No position'}
                                                        {p.jersey_number != null && ` · #${p.jersey_number}`}
                                                        {p.guardian_code && ` · Code: ${p.guardian_code}`}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveFromGroup(p)}
                                                aria-label="Remove from group"
                                                className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* MODALS */}
            {showCreate && (
                <CreateGroupModal
                    onClose={() => setShowCreate(false)}
                    onCreate={handleCreateGroup}
                />
            )}

            {showAddCurrent && selected && (
                <AddCurrentPlayerModal
                    user={user}
                    groupId={selected.id}
                    existingPlayerIds={roster.map(r => r.id)}
                    onClose={() => setShowAddCurrent(false)}
                    onPick={async (playerId) => {
                        await handleLinkExistingPlayer(playerId);
                    }}
                />
            )}

            {showAddNew && selected && (
                <AddNewPlayerModal
                    onClose={() => setShowAddNew(false)}
                    onCreate={async (form) => {
                        const ok = await handleCreateNewPlayer(form);
                        if (ok) setShowAddNew(false);
                    }}
                />
            )}

            {showInvite && selected && (
                <BulkInviteModal
                    teamId={selected.id}
                    teamName={selected.name}
                    onClose={() => setShowInvite(false)}
                />
            )}
        </div>
    );
};

// =====================================================================
// Sub-modals
// =====================================================================

const CreateGroupModal = ({ onClose, onCreate }) => {
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        setSaving(true);
        await onCreate(name);
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-brand-dark border border-white/10 rounded-t-2xl md:rounded-2xl w-full md:max-w-sm shadow-2xl relative p-6" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                <h3 className="text-xl font-display uppercase font-bold text-white tracking-wider mb-1">New private group</h3>
                <p className="text-xs text-gray-500 mb-4">Give it a name parents will recognize — "Bo Solo", "Goalkeepers", "Tuesday Crew".</p>
                <input
                    type="text"
                    autoFocus
                    placeholder="Group name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) submit(); }}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-gold"
                />
                <div className="flex gap-2 mt-4">
                    <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-white/10 text-gray-300 text-sm font-bold uppercase tracking-wider hover:bg-white/5">Cancel</button>
                    <button
                        onClick={submit}
                        disabled={!name.trim() || saving}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-brand-gold text-black text-sm font-bold uppercase tracking-wider hover:bg-brand-gold/90 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Creating' : 'Create'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AddCurrentPlayerModal = ({ user, groupId, existingPlayerIds, onClose, onPick }) => {
    const [loading, setLoading] = useState(true);
    const [candidates, setCandidates] = useState([]);
    const [query, setQuery] = useState('');
    const [picking, setPicking] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            // Step 1: find teams the coach is staff on (any role in STAFF_ROLES),
            //         EXCLUDING this private group.
            const { data: memberships } = await supabase
                .from('team_memberships')
                .select('team_id, role')
                .eq('user_id', user.id);
            const staffTeamIds = (memberships || [])
                .filter(m => STAFF_ROLES.has(m.role))
                .map(m => m.team_id)
                .filter(tid => tid !== groupId);
            if (staffTeamIds.length === 0) {
                if (!cancelled) { setCandidates([]); setLoading(false); }
                return;
            }
            // Step 2: pull active rosters from those teams
            const { data, error } = await supabase
                .from('team_active_roster')
                .select('id, first_name, last_name, jersey_number, position, avatar_url, team_id')
                .in('team_id', staffTeamIds)
                .order('last_name', { ascending: true });
            if (cancelled) return;
            if (error) {
                console.error('[AddCurrent] roster fetch:', error);
                setCandidates([]);
                setLoading(false);
                return;
            }
            // Dedup by player.id (could appear on multiple teams) + drop already-in-group
            const seen = new Set(existingPlayerIds);
            const unique = [];
            for (const p of (data || [])) {
                if (seen.has(p.id)) continue;
                seen.add(p.id);
                unique.push(p);
            }
            setCandidates(unique);
            setLoading(false);
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filtered = useMemo(() => {
        if (!query.trim()) return candidates;
        const q = query.toLowerCase();
        return candidates.filter(c =>
            `${c.first_name} ${c.last_name}`.toLowerCase().includes(q)
        );
    }, [candidates, query]);

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-brand-dark border border-white/10 rounded-t-2xl md:rounded-2xl w-full md:max-w-md max-h-[85vh] flex flex-col shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
                <div className="p-5 border-b border-white/10">
                    <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                    <h3 className="text-xl font-display uppercase font-bold text-white tracking-wider mb-1">Add current player</h3>
                    <p className="text-xs text-gray-500 mb-3">Pulls from kids on your other teams. Their info, stats, IDP, and evaluations stay linked across contexts.</p>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search names…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-brand-gold"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                    {loading ? (
                        <div className="text-center text-gray-500 text-sm py-6">Loading…</div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center text-gray-500 text-sm py-8">
                            {candidates.length === 0
                                ? "No players available — you don't coach any other teams yet."
                                : 'No matches.'}
                        </div>
                    ) : (
                        <ul className="space-y-1">
                            {filtered.map(p => (
                                <li key={p.id}>
                                    <button
                                        onClick={async () => {
                                            setPicking(p.id);
                                            await onPick(p.id);
                                            setPicking(null);
                                        }}
                                        disabled={picking === p.id}
                                        className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/5 disabled:opacity-50 text-left"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center border border-white/10">
                                                {p.avatar_url
                                                    ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                                                    : <span className="text-brand-gold font-bold text-xs">{p.first_name?.charAt(0)}</span>}
                                            </div>
                                            <div>
                                                <p className="text-white text-sm font-bold">{p.first_name} {p.last_name}</p>
                                                <p className="text-[11px] text-gray-500">
                                                    {p.position || 'No position'}
                                                    {p.jersey_number != null && ` · #${p.jersey_number}`}
                                                </p>
                                            </div>
                                        </div>
                                        {picking === p.id
                                            ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                            : <Plus className="w-4 h-4 text-brand-gold" />}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

const AddNewPlayerModal = ({ onClose, onCreate }) => {
    const [form, setForm] = useState({
        first_name: '', last_name: '', jersey: '',
        position: '', position_secondary: '',
        birthdate: '', display_name: '',
    });
    const [saving, setSaving] = useState(false);

    const submit = async (e) => {
        e?.preventDefault?.();
        if (!form.first_name.trim() || !form.last_name.trim()) return;
        if (form.position && form.position_secondary && form.position === form.position_secondary) return;
        setSaving(true);
        await onCreate(form);
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-brand-dark border border-white/10 rounded-t-2xl md:rounded-2xl w-full md:max-w-md max-h-[90vh] overflow-y-auto shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                <form onSubmit={submit} className="p-6 space-y-4">
                    <div>
                        <h3 className="text-xl font-display uppercase font-bold text-white tracking-wider mb-1">Add new player</h3>
                        <p className="text-xs text-gray-500">Creates a real player record — same Info fields as your team roster. Parents can link via the family-invite code.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-gray-400 text-[11px] uppercase tracking-wider">First name</span>
                            <input type="text" required value={form.first_name}
                                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                                className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-gold" />
                        </label>
                        <label className="block">
                            <span className="text-gray-400 text-[11px] uppercase tracking-wider">Last name</span>
                            <input type="text" required value={form.last_name}
                                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                                className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-gold" />
                        </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-gray-400 text-[11px] uppercase tracking-wider">Jersey # <span className="normal-case font-normal">(optional)</span></span>
                            <input type="number" inputMode="numeric" min={0} max={99} value={form.jersey}
                                onChange={(e) => setForm({ ...form, jersey: e.target.value })}
                                placeholder="auto"
                                className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-gold" />
                        </label>
                        <label className="block">
                            <span className="text-gray-400 text-[11px] uppercase tracking-wider">Birthday</span>
                            <input type="date" value={form.birthdate}
                                onChange={(e) => setForm({ ...form, birthdate: e.target.value })}
                                max={new Date().toISOString().slice(0, 10)}
                                className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-gold" />
                        </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-gray-400 text-[11px] uppercase tracking-wider">1st position</span>
                            <select value={form.position}
                                onChange={(e) => {
                                    const next = e.target.value;
                                    setForm(f => ({ ...f, position: next, position_secondary: next && f.position_secondary === next ? '' : f.position_secondary }));
                                }}
                                className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-gold">
                                <option value="">(unset)</option>
                                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </label>
                        <label className="block">
                            <span className="text-gray-400 text-[11px] uppercase tracking-wider">2nd position</span>
                            <select value={form.position_secondary}
                                onChange={(e) => setForm({ ...form, position_secondary: e.target.value })}
                                className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-gold">
                                <option value="">(none)</option>
                                {POSITIONS.filter(p => p !== form.position).map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </label>
                    </div>

                    <label className="block">
                        <span className="text-gray-400 text-[11px] uppercase tracking-wider">
                            Display name <span className="normal-case font-normal">(optional — defaults to "First Last")</span>
                        </span>
                        <input type="text" value={form.display_name}
                            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                            placeholder={`${form.first_name || 'First'} ${form.last_name || 'Last'}`}
                            className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-gold" />
                    </label>

                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2 rounded-lg border border-white/10 text-gray-300 text-sm font-bold uppercase tracking-wider hover:bg-white/5">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving || !form.first_name.trim() || !form.last_name.trim()}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-brand-gold text-black text-sm font-bold uppercase tracking-wider hover:bg-brand-gold/90 disabled:opacity-50">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {saving ? 'Saving' : 'Add player'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PrivateTrainingView;
