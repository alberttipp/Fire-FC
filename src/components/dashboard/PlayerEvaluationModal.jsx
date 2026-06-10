import React, { useState, useEffect } from 'react';
import { X, Save, TrendingUp, Award, Medal, Clock, FileText, Target, IdCard, Loader2, ChevronDown, Shield, Dumbbell } from 'lucide-react';
import CoachNotesPanel from './CoachNotesPanel';
import IDPBuilder from './IDPBuilder';
import AvatarUploader from '../player/AvatarUploader';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { badges as mockBadges } from '../../data/badges';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import {
    OUTFIELD_ATTRIBUTES, GK_ATTRIBUTES, getCard, activeSubs, isFaceScoredDirectly,
    attributeFace, overallRating, resolveEvalMode, GK_POSITION, DEFAULT_SUBSTAT,
} from '../../constants/fifaAttributes';

const PlayerEvaluationModal = ({ player, onClose, readOnly = false, onTrainCategory = null, roster = null, onNavigate = null }) => {
    const { user } = useAuth();
    const toast = useToast();
    const [activeTab, setActiveTab] = useState('eval'); // 'eval', 'awards', or 'training'
    const [saving, setSaving] = useState(false);
    // Local avatar URL — initialized from the player prop and updated
    // optimistically when AvatarUploader reports a successful upload, so the
    // modal reflects the new photo without waiting for a parent re-fetch.
    const [currentAvatar, setCurrentAvatar] = useState(player?.avatar_url || player?.avatar || null);

    // Info-tab state. Initial values from the prop (which uses TeamView's
    // formatted shape), then enriched via a small fetch on mount so we also
    // have display_name (not in the prop). On save, we update both the DB
    // and this local state so the modal header reflects edits immediately.
    const [info, setInfo] = useState({
        first_name: player?.firstName || (player?.name || '').split(' ')[0] || '',
        last_name: player?.lastName || (player?.name || '').split(' ').slice(1).join(' ') || '',
        jersey_number: player?.number ?? '',
        position: player?.position || '',          // 1st-choice position
        position_secondary: '',                    // 2nd-choice
        birthdate: '',                             // 'YYYY-MM-DD'
        display_name: '',
    });
    const [savingInfo, setSavingInfo] = useState(false);
    // 9 positions, matching the TryoutSignup form so families and coaches
    // pick from the same vocabulary.
    const POSITIONS = [
        'Goalkeeper',
        'Center Back',
        'Fullback',
        'Defensive Midfielder',
        'Center Midfielder',
        'Attacking Midfielder',
        'Winger',
        'Striker',
        'Anywhere',
    ];

    // Years (whole) from a YYYY-MM-DD string, or null if unset/invalid.
    const ageFromBirthdate = (yyyyMmDd) => {
        if (!yyyyMmDd) return null;
        const d = new Date(yyyyMmDd + 'T00:00');
        if (Number.isNaN(d.getTime())) return null;
        const today = new Date();
        let age = today.getFullYear() - d.getFullYear();
        const m = today.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
        return age >= 0 && age < 120 ? age : null;
    };
    const [coachNotes, setCoachNotes] = useState('');
    const [season, setSeason] = useState('Spring 2026');
    const [existingEvalId, setExistingEvalId] = useState(null);
    const [evalHistory, setEvalHistory] = useState([]);

    // Badge Data State
    const [allBadges, setAllBadges] = useState([]);
    const [awardedBadges, setAwardedBadges] = useState({}); // { badgeId: count }
    // Awards tab default view: earned-only. The coach taps "Award a badge"
    // to reveal the full catalog so they can grant one; the catalog
    // collapses back to earned-only after an award via toggleBadge.
    const [showCatalog, setShowCatalog] = useState(false);

    // Training Stats State
    const [trainingStats, setTrainingStats] = useState({
        weekly_minutes: 0,
        season_minutes: 0,
        yearly_minutes: 0,
        training_minutes: 0,
        drills_completed: 0,
        streak_days: 0,
        weekly_touches: 0,
        season_touches: 0,
        yearly_touches: 0,
        career_touches: 0,
    });

    // --- FIFA card state -----------------------------------------------------
    // cardType: 'outfield' | 'gk' (keepers get DIV/HAN/KIC/REF/SPD/POS).
    // mode: effective depth — 'youth' (trimmed) | 'pro' (full FIFA sub-stats).
    // subValues: { subStatKey: 0-99 } — the coach scores these; faces compute.
    // directFaces: { ATTR_KEY: 0-99 } — for attributes with no active sub-stats
    //   in this mode (e.g. youth goalkeeper faces), scored directly.
    const [cardType, setCardType] = useState('outfield');
    const [playerEvalMode, setPlayerEvalMode] = useState(null); // null = inherit team
    const [teamEvalMode, setTeamEvalMode] = useState('youth');
    const mode = resolveEvalMode(playerEvalMode, teamEvalMode);
    const [subValues, setSubValues] = useState({});
    const [directFaces, setDirectFaces] = useState({});
    const [expandedAttr, setExpandedAttr] = useState(null);
    const [baselineFaces, setBaselineFaces] = useState(null); // array of 6, in card order

    // A player whose position is Goalkeeper always shows the GK card; otherwise
    // the (manually toggleable) cardType state applies. Position is the truth.
    const isKeeper = info.position === GK_POSITION;
    const effCardType = isKeeper ? 'gk' : cardType;
    const card = getCard(effCardType);
    const faceValue = (attr) => isFaceScoredDirectly(attr, mode)
        ? (directFaces[attr.key] ?? DEFAULT_SUBSTAT)
        : attributeFace(attr, mode, subValues);
    const faces = card.map(faceValue);
    const ovr = overallRating(faces);

    // "Save & Next player" — when launched from the coach roster (TeamView passes
    // `roster` + `onNavigate`), find the next player so the coach can baseline the
    // whole squad without closing/reopening the modal each time. TeamView remounts
    // the modal via key={player.id}, so each player gets clean card state.
    const rosterIndex = Array.isArray(roster) && player?.id
        ? roster.findIndex((p) => p.id === player.id)
        : -1;
    const nextPlayer = rosterIndex >= 0 && rosterIndex < roster.length - 1
        ? roster[rosterIndex + 1]
        : null;

    // Reconstruct sub/face state from a saved evaluation row. New rows carry a
    // structured sub_stats jsonb; legacy rows (6 int columns only) get each
    // column spread across that attribute's sub-stats so faces still match.
    const hydrateFromEval = (ev) => {
        const ct = ev?.card_type === 'gk' ? 'gk' : 'outfield';
        if (ev?.sub_stats && typeof ev.sub_stats === 'object') {
            return { cardType: ct, subs: ev.sub_stats.subs || {}, directFaces: ev.sub_stats.directFaces || {} };
        }
        const cols = { PAC: ev?.pace, SHO: ev?.shooting, PAS: ev?.passing, DRI: ev?.dribbling, DEF: ev?.defending, PHY: ev?.physical };
        const subs = {}; const faceMap = {};
        OUTFIELD_ATTRIBUTES.forEach((attr) => {
            const v = cols[attr.key] ?? DEFAULT_SUBSTAT;
            if (attr.subs.length) attr.subs.forEach((s) => { subs[s.key] = v; });
            else faceMap[attr.key] = v;
        });
        return { cardType: 'outfield', subs, directFaces: faceMap };
    };

    // Compute the 6 face values (in card order) for an arbitrary card/subs/faces
    // combo — used to build the dashed baseline radar from the first evaluation.
    const computeFaces = (ct, m, subs, faceMap) => getCard(ct).map((attr) => (
        isFaceScoredDirectly(attr, m) ? (faceMap[attr.key] ?? DEFAULT_SUBSTAT) : attributeFace(attr, m, subs)
    ));

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
                // 2. Get ALL Evaluations for this player (for history + baseline)
                const { data: allEvals, error: evalError } = await supabase
                    .from('evaluations')
                    .select('*')
                    .eq('player_id', player.id)
                    .order('created_at', { ascending: true });

                if (evalError && evalError.code !== 'PGRST116') {
                    console.error("Error fetching evaluations:", evalError);
                }

                if (allEvals && allEvals.length > 0) {
                    setEvalHistory(allEvals);

                    // Current = latest evaluation — hydrate the editable card.
                    const latest = allEvals[allEvals.length - 1];
                    setExistingEvalId(latest.id);
                    const latestState = hydrateFromEval(latest);
                    setCardType(latestState.cardType);
                    setSubValues(latestState.subs);
                    setDirectFaces(latestState.directFaces);
                    if (latest.eval_mode === 'youth' || latest.eval_mode === 'pro') {
                        setPlayerEvalMode(latest.eval_mode);
                    }
                    setCoachNotes(latest.notes || '');
                    setSeason(latest.season || 'Summer 2026');

                    // Baseline = first evaluation ever → dashed radar overlay.
                    const baseline = allEvals[0];
                    const baseState = hydrateFromEval(baseline);
                    const baseMode = (baseline.eval_mode === 'youth' || baseline.eval_mode === 'pro')
                        ? baseline.eval_mode
                        : resolveEvalMode(latest.eval_mode, teamEvalMode);
                    setBaselineFaces(computeFaces(baseState.cardType, baseMode, baseState.subs, baseState.directFaces));
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
                    .select('weekly_minutes, season_minutes, yearly_minutes, training_minutes, drills_completed, streak_days, weekly_touches, season_touches, yearly_touches, career_touches')
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
                        weekly_touches: statsRow.weekly_touches || 0,
                        season_touches: statsRow.season_touches || 0,
                        yearly_touches: statsRow.yearly_touches || 0,
                        career_touches: statsRow.career_touches || 0,
                    });
                }
            }
        };
        fetchData();
    }, [player]);

    // Fetch the canonical Info-tab fields (display_name not in the prop)
    useEffect(() => {
        if (!player?.id) return;
        let cancelled = false;
        (async () => {
            const { data, error } = await supabase
                .from('players')
                .select('first_name, last_name, jersey_number, position, position_secondary, birthdate, display_name, eval_mode, team_id')
                .eq('id', player.id)
                .single();
            if (cancelled || error || !data) return;
            setInfo({
                first_name: data.first_name || '',
                last_name: data.last_name || '',
                jersey_number: data.jersey_number ?? '',
                position: data.position || '',
                position_secondary: data.position_secondary || '',
                birthdate: data.birthdate || '',
                display_name: data.display_name || '',
            });
            // Evaluation depth: player override (null = inherit) + team default.
            if (data.eval_mode === 'youth' || data.eval_mode === 'pro') setPlayerEvalMode(data.eval_mode);
            const teamId = data.team_id || player.team_id;
            if (teamId) {
                const { data: team } = await supabase.from('teams').select('eval_mode').eq('id', teamId).maybeSingle();
                if (!cancelled && (team?.eval_mode === 'youth' || team?.eval_mode === 'pro')) setTeamEvalMode(team.eval_mode);
            }
        })();
        return () => { cancelled = true; };
    }, [player?.id]);

    const handleSaveInfo = async () => {
        const first_name = (info.first_name || '').trim();
        const last_name = (info.last_name || '').trim();
        const jersey = info.jersey_number === '' ? null : parseInt(info.jersey_number, 10);

        if (!first_name) { toast.error('First name is required.'); return; }
        if (!last_name)  { toast.error('Last name is required.');  return; }
        if (jersey === null || Number.isNaN(jersey) || jersey < 0 || jersey > 999) {
            toast.error('Jersey number must be 0–999.'); return;
        }

        // Disallow same primary + secondary position (DB CHECK constraint
        // catches it too, but give a friendlier error here).
        if (info.position && info.position_secondary && info.position === info.position_secondary) {
            toast.error("1st and 2nd choice can't be the same position.");
            return;
        }

        setSavingInfo(true);
        try {
            const { error } = await supabase
                .from('players')
                .update({
                    first_name,
                    last_name,
                    jersey_number: jersey,
                    position: info.position || null,
                    position_secondary: info.position_secondary || null,
                    birthdate: info.birthdate || null,
                    display_name: (info.display_name || '').trim() || `${first_name} ${last_name}`,
                })
                .eq('id', player.id);
            if (error) throw error;
            toast.success('Player info updated.');
            // Keep our local mirror in sync with what we wrote
            setInfo(prev => ({
                ...prev,
                first_name,
                last_name,
                jersey_number: jersey,
                position: info.position || '',
                position_secondary: info.position_secondary || '',
                birthdate: info.birthdate || '',
                display_name: (info.display_name || '').trim() || `${first_name} ${last_name}`,
            }));
        } catch (err) {
            console.error('[PlayerEvaluationModal] save info failed:', err);
            const msg = err?.message || 'Save failed.';
            toast.error(msg.includes('policy') || msg.includes('permission')
                ? "You don't have permission to edit this player."
                : `Save failed: ${msg}`);
        } finally {
            setSavingInfo(false);
        }
    };

    const data = card.map((attr, i) => ({
        subject: attr.key,
        A: faces[i],
        baseline: baselineFaces ? (baselineFaces[i] ?? faces[i]) : faces[i],
        fullMark: 100,
    }));

    const setSub = (subKey, value) => {
        if (readOnly) return;
        setSubValues(prev => ({ ...prev, [subKey]: parseInt(value) }));
    };
    const setDirectFace = (attrKey, value) => {
        if (readOnly) return;
        setDirectFaces(prev => ({ ...prev, [attrKey]: parseInt(value) }));
    };
    // Persist a per-player depth-mode override immediately so it sticks even if
    // the coach closes without saving an eval. null clears back to team default.
    const changePlayerMode = async (nextMode) => {
        if (readOnly) return;
        setPlayerEvalMode(nextMode);
        try { await supabase.from('players').update({ eval_mode: nextMode }).eq('id', player.id); }
        catch (err) { console.warn('[eval] could not persist eval_mode', err); }
    };

    const toggleBadge = async (badgeId) => {
        if (readOnly) return;

        // Optimistic UI Update
        setAwardedBadges(prev => ({ ...prev, [badgeId]: (prev[badgeId] || 0) + 1 }));

        // Database Insert - use player_user_id (the auth.users UUID linked to this player).
        // The column NAME says "user_id" so it MUST be the auth.users UUID, never the
        // players-table primary key. The previous fallback to player.id was the source
        // of a real bug: badges got inserted under the wrong UUID and the kid's
        // dashboard couldn't find them. If we don't have a real user_id, fail loud
        // rather than write bad data.
        let playerUserId = player?.user_id;
        if (!playerUserId && player?.id) {
            // Fall back via DB lookup so we never silently use the wrong UUID
            const { data: p } = await supabase
                .from('players').select('user_id').eq('id', player.id).maybeSingle();
            playerUserId = p?.user_id || null;
        }

        if (!playerUserId) {
            console.error('Cannot award badge: player has no auth.users link', { player });
            toast.warning("Can't award badge — this player doesn't have an account linked yet.");
            // Revert optimistic update
            setAwardedBadges(prev => {
                const newCount = (prev[badgeId] || 1) - 1;
                if (newCount <= 0) {
                    const { [badgeId]: _, ...rest } = prev;
                    return rest;
                }
                return { ...prev, [badgeId]: newCount };
            });
            return;
        }

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

    const handleSave = async (advance = false) => {
        if (!player?.id || !user?.id) {
            toast.error('Missing player or user information.');
            return;
        }

        setSaving(true);
        try {
            // Face values in card order drive the six legacy int columns (kept as
            // the rollup for radar/OVR/history) and are mirrored into sub_stats.
            // For a GK card those columns hold DIV/HAN/KIC/REF/SPD/POS in order.
            const faceMap = {};
            card.forEach((attr, i) => { faceMap[attr.key] = faces[i]; });
            const [c0, c1, c2, c3, c4, c5] = faces;

            const evaluationData = {
                player_id: player.id,
                coach_id: user.id,
                season,
                notes: coachNotes,
                card_type: effCardType,
                eval_mode: mode,
                sub_stats: { card_type: effCardType, mode, attributes: faceMap, subs: subValues, directFaces },
                pace: c0, shooting: c1, passing: c2, dribbling: c3, defending: c4, physical: c5,
            };

            // Always INSERT a new evaluation — creates timestamped history.
            // Each save becomes a historical record; latest = current, first = baseline.
            const { error } = await supabase.from('evaluations').insert([evaluationData]);
            if (error) throw error;

            // Advance to the next roster player without closing (clean remount
            // per player via key={id} in TeamView).
            if (advance && nextPlayer && onNavigate) {
                toast.success(`Saved. Next up: ${nextPlayer.name || 'player'}.`);
                onNavigate(nextPlayer);
            } else {
                toast.success('Evaluation saved.');
                onClose();
            }
        } catch (err) {
            console.error('Error saving evaluation:', err);
            toast.error("Couldn't save the evaluation. Try again in a moment.");
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
            toast.success('Training stats saved.');
        } catch (err) {
            console.error('Error saving training stats:', err);
            toast.error("Couldn't save training stats. Try again.");
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
        <div className="fixed inset-0 z-[100] flex items-stretch md:items-center justify-center md:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-brand-dark border border-white/10 w-full md:max-w-4xl rounded-none md:rounded-xl shadow-2xl relative overflow-hidden flex flex-col md:flex-row h-[100dvh] md:h-auto md:max-h-[92vh]">

                {/* Visual Section (Left) */}
                <div className="w-full md:w-1/2 bg-gradient-to-br from-gray-900 to-black p-3 md:p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/10 shrink-0">
                    <div className="text-center mb-2 md:mb-6 flex flex-col items-center gap-2 md:gap-3">
                        <AvatarUploader
                            playerId={player?.id}
                            playerName={player?.name}
                            currentAvatarUrl={currentAvatar}
                            canEdit={!readOnly}
                            size="md"
                            onUploaded={(newUrl) => setCurrentAvatar(newUrl)}
                        />
                        <div>
                            <h2 className="text-xl md:text-3xl text-white font-display uppercase font-bold tracking-wider">
                                {info.display_name || `${info.first_name || ''} ${info.last_name || ''}`.trim() || player?.name || 'Player Name'}
                            </h2>
                            <p className="text-brand-green tracking-widest uppercase text-[10px] md:text-sm font-bold">
                                {[info.position || 'Position not set', info.jersey_number !== '' ? `#${info.jersey_number}` : null].filter(Boolean).join(' • ')}
                            </p>
                        </div>
                    </div>

                    <div className="w-full h-[160px] md:h-[300px] relative">
                        {/* Recharts Radar */}
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                                <PolarGrid stroke="#333" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 'bold' }} />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                {baselineFaces && evalHistory.length > 1 && (
                                    <Radar
                                        name="Baseline"
                                        dataKey="baseline"
                                        stroke="#6b7280"
                                        strokeWidth={1}
                                        strokeDasharray="4 4"
                                        fill="#6b7280"
                                        fillOpacity={0.1}
                                    />
                                )}
                                <Radar
                                    name="Current"
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
                            <span className="text-2xl md:text-4xl font-display font-bold text-white drop-shadow-md">
                                {ovr}
                            </span>
                            <p className="text-[9px] md:text-[10px] text-gray-400 uppercase">OVR</p>
                        </div>
                    </div>
                </div>

                {/* Controls Section (Right) */}
                <div className="w-full md:w-1/2 bg-brand-dark relative flex flex-col flex-1 min-h-0">
                    {/* Close button — fixed to top-right of entire modal, visible on all tabs */}
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/60 backdrop-blur border border-white/20 text-white hover:bg-white hover:text-brand-dark transition-colors flex items-center justify-center shadow-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Header / Tabs */}
                    <div className="px-3 md:px-6 pt-4 md:pt-6 pb-0 shrink-0">
                        <div className="flex gap-1 md:gap-6 border-b border-white/10 mb-4 md:mb-6 overflow-x-auto no-scrollbar -mx-1 px-1 pr-12">
                            <button
                                onClick={() => setActiveTab('info')}
                                className={`pb-3 text-xs md:text-sm font-bold uppercase tracking-wider transition-colors border-b-2 shrink-0 ${activeTab === 'info' ? 'border-brand-green text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                <span className="flex items-center gap-1.5"><IdCard className="w-3.5 h-3.5 md:w-4 md:h-4" /> Info</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('eval')}
                                className={`pb-3 text-xs md:text-sm font-bold uppercase tracking-wider transition-colors border-b-2 shrink-0 ${activeTab === 'eval' ? 'border-brand-green text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4" /> Eval</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('awards')}
                                className={`pb-3 text-xs md:text-sm font-bold uppercase tracking-wider transition-colors border-b-2 shrink-0 ${activeTab === 'awards' ? 'border-brand-green text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                <span className="flex items-center gap-1.5"><Award className="w-3.5 h-3.5 md:w-4 md:h-4" /> Badges</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('training')}
                                className={`pb-3 text-xs md:text-sm font-bold uppercase tracking-wider transition-colors border-b-2 shrink-0 ${activeTab === 'training' ? 'border-brand-green text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 md:w-4 md:h-4" /> Training</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('notes')}
                                className={`pb-3 text-xs md:text-sm font-bold uppercase tracking-wider transition-colors border-b-2 shrink-0 ${activeTab === 'notes' ? 'border-brand-green text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 md:w-4 md:h-4" /> Notes</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('idp')}
                                className={`pb-3 text-xs md:text-sm font-bold uppercase tracking-wider transition-colors border-b-2 shrink-0 ${activeTab === 'idp' ? 'border-brand-green text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                <span className="flex items-center gap-1.5"><Target className="w-3.5 h-3.5 md:w-4 md:h-4" /> IDP</span>
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar px-3 md:px-6 pt-0 pb-4" style={{ WebkitOverflowScrolling: 'touch' }}>
                        {activeTab === 'training' ? (
                            <div className="space-y-5">
                                {/* Read-only summary row */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
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
                                    <div className="text-center p-3 bg-white/5 rounded-lg">
                                        <div className="text-2xl font-bold text-orange-400">{(trainingStats.career_touches || 0).toLocaleString()}</div>
                                        <div className="text-[10px] text-gray-500 uppercase">Career Touches</div>
                                    </div>
                                </div>

                                {[
                                    { key: 'weekly_minutes', touchKey: 'weekly_touches', label: 'This Week', color: 'text-blue-400', bgColor: 'bg-blue-500' },
                                    { key: 'season_minutes', touchKey: 'season_touches', label: 'Season Total', color: 'text-brand-green', bgColor: 'bg-brand-green' },
                                    { key: 'yearly_minutes', touchKey: 'yearly_touches', label: 'Year Total', color: 'text-brand-gold', bgColor: 'bg-brand-gold' },
                                    { key: 'training_minutes', touchKey: 'career_touches', label: 'Career Total', color: 'text-white', bgColor: 'bg-white' },
                                ].map(({ key, touchKey, label, color, bgColor }) => (
                                    <div key={key}>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-xs text-gray-400 uppercase font-bold tracking-wider">{label}</label>
                                            <div className="flex items-baseline gap-3">
                                                <span className={`text-lg font-bold ${color}`}>
                                                    {trainingStats[key] || 0} <span className="text-xs text-gray-500">min</span>
                                                </span>
                                                <span className="text-sm font-bold text-orange-400">
                                                    {(trainingStats[touchKey] || 0).toLocaleString()} <span className="text-xs text-gray-500">touches</span>
                                                </span>
                                            </div>
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
                                {/* Depth mode (youth/pro) + goalkeeper card controls — coach only */}
                                {!readOnly && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Card</span>
                                        <div className="inline-flex rounded-md border border-white/10 overflow-hidden">
                                            {['youth', 'pro'].map((m) => (
                                                <button
                                                    key={m}
                                                    type="button"
                                                    onClick={() => changePlayerMode(m)}
                                                    className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${mode === m ? 'bg-brand-green text-brand-dark' : 'text-gray-400 hover:text-white'}`}
                                                >
                                                    {m === 'youth' ? 'Youth' : 'Pro'}
                                                </button>
                                            ))}
                                        </div>
                                        {playerEvalMode && (
                                            <button
                                                type="button"
                                                onClick={() => changePlayerMode(null)}
                                                className="text-[10px] text-gray-500 underline hover:text-gray-300"
                                            >
                                                use team default ({teamEvalMode})
                                            </button>
                                        )}
                                        {isKeeper ? (
                                            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-gold">
                                                <Shield className="w-3 h-3" /> Goalkeeper card
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => { setCardType((c) => (c === 'gk' ? 'outfield' : 'gk')); setExpandedAttr(null); }}
                                                className={`ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider transition-colors ${effCardType === 'gk' ? 'border-brand-gold/50 text-brand-gold bg-brand-gold/10' : 'border-white/10 text-gray-400 hover:text-white'}`}
                                            >
                                                <Shield className="w-3 h-3" /> Goalkeeper
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Attribute groups — tap to expand into FIFA sub-stats */}
                                <div className="space-y-2.5">
                                    {card.map((attr, i) => {
                                        const subs = activeSubs(attr, mode);
                                        const direct = subs.length === 0; // scored at the face (e.g. youth GK)
                                        const face = faces[i];
                                        const isOpen = expandedAttr === attr.key;
                                        return (
                                            <div key={attr.key} className="rounded-lg border border-white/5 bg-white/[0.02]">
                                                <button
                                                    type="button"
                                                    disabled={direct}
                                                    onClick={() => !direct && setExpandedAttr(isOpen ? null : attr.key)}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                                                >
                                                    <span className="w-9 text-center text-[11px] font-display font-bold tracking-wider" style={{ color: attr.color }}>{attr.key}</span>
                                                    <span className="flex-1 text-sm text-gray-200 font-bold">{attr.label}</span>
                                                    {direct && !readOnly && (
                                                        <input
                                                            type="range" min="0" max="99" value={face}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onChange={(e) => setDirectFace(attr.key, e.target.value)}
                                                            className="w-24 sm:w-28 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-green"
                                                        />
                                                    )}
                                                    <span className={`w-7 text-right text-sm font-bold ${face > 80 ? 'text-brand-green' : 'text-white'}`}>{face}</span>
                                                    {!direct && <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
                                                </button>

                                                {!direct && isOpen && (
                                                    <div className="px-3 pb-3 pt-1 space-y-3 border-t border-white/5">
                                                        {subs.map((s) => {
                                                            const v = subValues[s.key] ?? DEFAULT_SUBSTAT;
                                                            return (
                                                                <div key={s.key}>
                                                                    <div className="flex justify-between mb-1">
                                                                        <label className="text-[11px] text-gray-400">{s.label}</label>
                                                                        <span className={`text-[11px] font-bold ${v > 80 ? 'text-brand-green' : 'text-gray-200'}`}>{v}</span>
                                                                    </div>
                                                                    {!readOnly ? (
                                                                        <input
                                                                            type="range" min="0" max="99" value={v}
                                                                            onChange={(e) => setSub(s.key, e.target.value)}
                                                                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-green hover:accent-brand-gold transition-colors"
                                                                        />
                                                                    ) : (
                                                                        <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                                                                            <div className="h-full bg-brand-green" style={{ width: `${v}%` }} />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                        {attr.drillCategories?.length > 0 && (
                                                            <div className="flex items-center gap-x-2 gap-y-1 flex-wrap pt-1">
                                                                <span className="text-[10px] text-gray-500 flex items-center gap-1.5">
                                                                    <Dumbbell className="w-3 h-3 text-brand-gold shrink-0" /> Train:
                                                                </span>
                                                                {onTrainCategory ? (
                                                                    attr.drillCategories.map((cat) => (
                                                                        <button
                                                                            key={cat}
                                                                            type="button"
                                                                            onClick={() => onTrainCategory(cat)}
                                                                            className="text-[10px] font-semibold text-brand-gold/90 hover:text-brand-gold underline decoration-dotted underline-offset-2"
                                                                        >
                                                                            {cat}
                                                                        </button>
                                                                    ))
                                                                ) : (
                                                                    <span className="text-[10px] text-gray-500">{attr.drillCategories.join(' · ')}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                {!readOnly && (
                                    <div className="mt-8 pt-6 border-t border-white/10 space-y-4">
                                        <div>
                                            <label className="block text-xs text-gray-400 uppercase font-bold mb-2">Season</label>
                                            <select
                                                value={season}
                                                onChange={(e) => setSeason(e.target.value)}
                                                className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white text-sm focus:border-brand-green outline-none"
                                            >
                                                <option value="Fall 2026">Fall 2026</option>
                                                <option value="Summer 2026">Summer 2026</option>
                                                <option value="Spring 2026">Spring 2026</option>
                                                <option value="Fall 2025">Fall 2025</option>
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

                                {/* Evaluation History Timeline */}
                                {evalHistory.length > 1 && (
                                    <div className="mt-6 pt-4 border-t border-white/10">
                                        <h4 className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-3">Evaluation History</h4>
                                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                            {[...evalHistory].reverse().map((ev, i) => {
                                                const prevEv = i < evalHistory.length - 1 ? [...evalHistory].reverse()[i + 1] : null;
                                                const ovr = Math.round((ev.pace + ev.shooting + ev.passing + ev.dribbling + ev.defending + ev.physical) / 6);
                                                const deltas = prevEv ? ['pace','shooting','passing','dribbling','defending','physical']
                                                    .map(s => ({ stat: s.charAt(0).toUpperCase() + s.slice(1), diff: ev[s] - prevEv[s] }))
                                                    .filter(d => d.diff !== 0) : [];
                                                return (
                                                    <div key={ev.id} className={`p-3 rounded-lg border ${i === 0 ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/5'}`}>
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="text-xs text-gray-400">{new Date(ev.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-gray-500">{ev.season}</span>
                                                                <span className="text-sm font-bold text-white">OVR {ovr}</span>
                                                            </div>
                                                        </div>
                                                        {deltas.length > 0 && (
                                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                                {deltas.map(d => (
                                                                    <span key={d.stat} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${d.diff > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                                        {d.diff > 0 ? '+' : ''}{d.diff} {d.stat}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {i === evalHistory.length - 1 && (
                                                            <span className="text-[10px] text-gray-500 italic">Initial evaluation</span>
                                                        )}
                                                        {ev.notes && <p className="text-[11px] text-gray-400 mt-1 italic truncate">{ev.notes}</p>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : activeTab === 'awards' ? (
                            <div className="space-y-8 animate-fade-in">
                                {(() => {
                                    // Default view: earned-only. The coach taps "Award a badge"
                                    // to flip showCatalog and reveal the full catalog.
                                    const categories = ['Performance', 'Technical', 'Leadership & Character'];
                                    const earnedCount = Object.values(awardedBadges).filter(c => c > 0).length;
                                    const renderedSections = categories.map(cat => {
                                        const inCategory = allBadges.filter(b => b.category === cat || (cat === 'Technical' && b.category === 'Technical & Growth'));
                                        const visible = showCatalog ? inCategory : inCategory.filter(b => (awardedBadges[b.id] || 0) > 0);
                                        if (visible.length === 0) return null;
                                        return (
                                            <div key={cat}>
                                                <h4 className="text-brand-gold text-xs font-bold uppercase tracking-widest mb-3 border-l-2 border-brand-gold pl-3">{cat} Badges</h4>
                                                <div className="grid grid-cols-4 gap-3">
                                                    {visible.map(badge => {
                                                        const count = awardedBadges[badge.id] || 0;
                                                        return (
                                                            <div
                                                                key={badge.id}
                                                                onClick={() => toggleBadge(badge.id)}
                                                                className={`aspect-square rounded-lg border flex flex-col items-center justify-center gap-1 cursor-pointer transition-all relative overflow-hidden group ${count > 0 ? 'bg-brand-green/10 border-brand-green' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                                                            >
                                                                <span className="text-2xl transform group-hover:scale-110 transition-transform">{badge.icon}</span>
                                                                <span className="text-xs text-gray-400 text-center leading-tight px-1 font-bold">{badge.name}</span>

                                                                {count > 0 && (
                                                                    <div className="absolute top-1 right-1 w-4 h-4 bg-brand-green rounded-full flex items-center justify-center text-xs font-bold text-black border border-black/20">
                                                                        {count}
                                                                    </div>
                                                                )}
                                                                {count > 0 && <div className="absolute inset-0 bg-brand-green/5 animate-pulse rounded-lg pointer-events-none"></div>}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    });
                                    const hasAnyRendered = renderedSections.some(Boolean);

                                    return (
                                        <>
                                            {hasAnyRendered ? renderedSections : (
                                                <div className="text-center text-gray-400 text-xs italic p-6 border border-dashed border-white/10 rounded">
                                                    No badges earned yet.
                                                </div>
                                            )}
                                            {!readOnly && (
                                                <div className="flex justify-center pt-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowCatalog(s => !s)}
                                                        className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-md border border-brand-gold/40 text-brand-gold hover:bg-brand-gold/10 transition-colors"
                                                    >
                                                        {showCatalog ? 'Done — show earned only' : `+ Award a badge${earnedCount > 0 ? ' from catalog' : ''}`}
                                                    </button>
                                                </div>
                                            )}
                                            {readOnly && !hasAnyRendered && (
                                                <div className="text-center text-gray-400 text-xs italic mt-2">
                                                    Badges are waiting to be earned in the next session!
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        ) : activeTab === 'notes' ? (
                            <CoachNotesPanel player={player} readOnly={readOnly} />
                        ) : activeTab === 'idp' ? (
                            <IDPBuilder player={player} readOnly={readOnly} />
                        ) : activeTab === 'info' ? (
                            <div className="space-y-4">
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    Core player identity. Updates here flow to every screen — the roster card, the parent dashboard, and the kid's locker room.
                                </p>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-1.5">First name</label>
                                        <input
                                            type="text"
                                            value={info.first_name}
                                            onChange={(e) => setInfo({ ...info, first_name: e.target.value })}
                                            disabled={readOnly}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green disabled:opacity-60"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-1.5">Last name</label>
                                        <input
                                            type="text"
                                            value={info.last_name}
                                            onChange={(e) => setInfo({ ...info, last_name: e.target.value })}
                                            disabled={readOnly}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green disabled:opacity-60"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-1.5">Jersey #</label>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            min={0}
                                            max={999}
                                            value={info.jersey_number}
                                            onChange={(e) => setInfo({ ...info, jersey_number: e.target.value })}
                                            disabled={readOnly}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green disabled:opacity-60"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-1.5">
                                            Birthday
                                            {ageFromBirthdate(info.birthdate) !== null && (
                                                <span className="text-gray-500 text-[10px] normal-case font-normal ml-2">
                                                    (age {ageFromBirthdate(info.birthdate)})
                                                </span>
                                            )}
                                        </label>
                                        <input
                                            type="date"
                                            value={info.birthdate}
                                            onChange={(e) => setInfo({ ...info, birthdate: e.target.value })}
                                            disabled={readOnly}
                                            max={new Date().toISOString().slice(0, 10)}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green disabled:opacity-60"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-1.5">1st-choice position</label>
                                        <select
                                            value={info.position}
                                            onChange={(e) => {
                                                const next = e.target.value;
                                                // If the new primary collides with the secondary, clear secondary.
                                                setInfo({
                                                    ...info,
                                                    position: next,
                                                    position_secondary: next && info.position_secondary === next ? '' : info.position_secondary,
                                                });
                                            }}
                                            disabled={readOnly}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green disabled:opacity-60"
                                        >
                                            <option value="">(unset)</option>
                                            {POSITIONS.map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-1.5">
                                            2nd-choice position <span className="text-gray-500 text-[10px] normal-case font-normal ml-1">(optional)</span>
                                        </label>
                                        <select
                                            value={info.position_secondary}
                                            onChange={(e) => setInfo({ ...info, position_secondary: e.target.value })}
                                            disabled={readOnly}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green disabled:opacity-60"
                                        >
                                            <option value="">(none)</option>
                                            {POSITIONS.filter(p => p !== info.position).map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-brand-green text-xs font-bold uppercase tracking-widest mb-1.5">
                                        Display name <span className="text-gray-500 text-[10px] normal-case font-normal ml-1">(optional — defaults to "First Last")</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={info.display_name}
                                        onChange={(e) => setInfo({ ...info, display_name: e.target.value })}
                                        disabled={readOnly}
                                        placeholder={`${info.first_name || 'First'} ${info.last_name || 'Last'}`}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green disabled:opacity-60"
                                    />
                                </div>

                                {!readOnly && (
                                    <div className="pt-2">
                                        <button
                                            onClick={handleSaveInfo}
                                            disabled={savingInfo}
                                            className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50 w-full sm:w-auto sm:ml-auto"
                                        >
                                            {savingInfo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            {savingInfo ? 'Saving…' : 'Save Info'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>

                    {!readOnly && ['eval', 'training', 'awards'].includes(activeTab) && (
                        <div className="p-3 md:p-6 md:pt-4 border-t border-white/10 bg-black/20 shrink-0 flex justify-between items-center gap-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
                            <span className="text-xs text-gray-500 hidden sm:inline">
                                {activeTab === 'training' ? 'Edit training minutes' : activeTab === 'awards' ? 'Tap badges to award' : rosterIndex >= 0 ? `Player ${rosterIndex + 1} of ${roster.length}` : 'Adjust stats carefully'}
                            </span>
                            <div className="flex items-center gap-2 ml-auto">
                                <button
                                    onClick={activeTab === 'training' ? handleSaveTraining : () => handleSave(false)}
                                    disabled={saving}
                                    className="btn-primary flex items-center gap-2 disabled:opacity-50"
                                >
                                    <Save className="w-4 h-4" /> {saving ? 'Saving...' : (
                                        activeTab === 'training' ? 'Save Training' :
                                        activeTab === 'awards' ? 'Save Badges' :
                                        evalHistory.length === 0 ? 'Lock In Eval' : 'Update Eval'
                                    )}
                                </button>
                                {/* Baseline the whole roster without closing the modal. */}
                                {activeTab === 'eval' && nextPlayer && (
                                    <button
                                        onClick={() => handleSave(true)}
                                        disabled={saving}
                                        className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-white text-sm font-bold hover:bg-white/15 transition-colors disabled:opacity-50"
                                        title={`Save and go to ${nextPlayer.name || 'next player'}`}
                                    >
                                        Next <ChevronDown className="w-4 h-4 -rotate-90" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PlayerEvaluationModal;
