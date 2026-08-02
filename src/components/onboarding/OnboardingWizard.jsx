import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    Shield, Palette, Users, Link as LinkIcon, Calendar, PartyPopper,
    Plus, Trash2, Copy, Check, MessageSquare, ChevronLeft, ChevronRight,
    Loader2, Upload, ClipboardPaste, SkipForward
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import { buildInviteUrl } from '../../utils/pendingInvite';

// ============================================================================
// Self-serve club onboarding wizard.
//
// Goal: a brand-new club director goes from "empty account" to "team live +
// families invited" in under 15 minutes, unaided. Every step REUSES an
// existing, proven operation:
//   1. Branding  -> organizations UPDATE (white-label columns from the
//                   20260706 migration: display_name / logo_url / primary_color)
//                   + the SponsorsDrilldown media-bucket upload pattern.
//   2. Team      -> the exact CreateTeamModal insert (teams + membership upsert;
//                   a DB trigger also auto-adds the creator as manager).
//   3. Players   -> the create-player edge function (same one CreatePlayerModal
//                   calls). Jersey #s auto-assigned when blank; PINs generated.
//   4. Invites   -> guardian codes returned by create-player, rendered as
//                   tap-to-join links via buildInviteUrl() (SetupHealthPanel
//                   pattern), with get_manager_setup_health() as fallback.
//   5. Event     -> the exact KeyDatesPanel events INSERT shape.
//   6. Done      -> join info + QR.
//
// Rendered through a PORTAL to document.body so the fixed overlay can never be
// trapped inside a glass-panel/backdrop-filter ancestor (known Fire FC trap).
// Idempotent-ish: once the team exists in state it is never recreated; players
// already created are never re-sent; Back/Next is always safe.
// ============================================================================

export const ONBOARDING_DISMISSED_KEY = 'ff_onboarding_dismissed';

const STEP_LABELS = ['Branding', 'Team', 'Players', 'Invites', 'Schedule', 'Done'];

// Same option set as CreateTeamModal so age_group values stay consistent.
const AGE_BRACKETS = ['U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18'];
const GENDER_GROUPS = ['Boys', 'Girls', 'Coed'];

const EVENT_TYPES = [
    { value: 'practice', label: 'Practice' },
    { value: 'game', label: 'Game' },
    { value: 'social', label: 'Social / Team Event' },
    { value: 'tournament', label: 'Tournament' },
];

const inputCls = 'w-full bg-black/50 border border-white/10 rounded-lg py-2.5 px-3 text-white text-sm focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none';
const labelCls = 'block text-brand-green text-xs font-bold uppercase tracking-widest mb-1.5';

const randomPin = () => String(Math.floor(1000 + Math.random() * 9000));
const randomJoinCode = () => `FC-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

// "First Last", "First Middle Last", optional trailing jersey ("Bo Tipp 58" /
// "Bo Tipp #58"). Returns { players: [{first,last,jersey}], skipped }.
const parsePastedRoster = (text) => {
    const players = [];
    let skipped = 0;
    (text || '').split(/\r?\n/).forEach((line) => {
        const cleaned = line.replace(/[,\t]+/g, ' ').trim();
        if (!cleaned) return;
        const tokens = cleaned.split(/\s+/);
        let jersey = '';
        if (tokens.length > 1 && /^#?\d{1,2}$/.test(tokens[tokens.length - 1])) {
            jersey = tokens.pop().replace('#', '');
        }
        if (tokens.length < 2) { skipped += 1; return; }
        players.push({ first: tokens[0], last: tokens.slice(1).join(' '), jersey });
    });
    return { players, skipped };
};

const emptyRow = () => ({ first: '', last: '', jersey: '' });

const OnboardingWizard = ({ onClose }) => {
    const { user } = useAuth();
    const toast = useToast();

    const [step, setStep] = useState(1);
    const [busy, setBusy] = useState(false);

    // --- Org / branding state ---------------------------------------------
    const [org, setOrg] = useState(null);          // { id, name, display_name, logo_url, primary_color, slug }
    const [orgLoading, setOrgLoading] = useState(true);
    const [clubName, setClubName] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [brandColor, setBrandColor] = useState('#3b82f6');
    const [uploadingLogo, setUploadingLogo] = useState(false);

    // --- Team state --------------------------------------------------------
    const [teamName, setTeamName] = useState('');
    const [ageGroup, setAgeGroup] = useState('U10 Coed');
    const [season, setSeason] = useState('');
    const [team, setTeam] = useState(null);        // created team row (idempotency anchor)

    // --- Players state -----------------------------------------------------
    const [rows, setRows] = useState([emptyRow()]);
    const [pasteText, setPasteText] = useState('');
    const [showPaste, setShowPaste] = useState(false);
    const [createdPlayers, setCreatedPlayers] = useState([]); // { player_id, name, jersey, code }

    // --- Event state -------------------------------------------------------
    const [evTitle, setEvTitle] = useState('First Team Practice');
    const [evType, setEvType] = useState('practice');
    const [evDate, setEvDate] = useState('');
    const [evTime, setEvTime] = useState('18:00');
    const [evLocation, setEvLocation] = useState('');
    const [eventSaved, setEventSaved] = useState(false);

    // --- Invite-step UI state ---------------------------------------------
    const [copiedKey, setCopiedKey] = useState(null);
    const [inviteFallback, setInviteFallback] = useState([]); // from get_manager_setup_health

    // Lock body scroll while the overlay is open (same pattern Dashboard uses
    // for its top-level overlays).
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    // Resolve the director's club — the exact org_memberships query
    // CreateTeamModal uses, then the white-label branding columns for prefill.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!user?.id) { setOrgLoading(false); return; }
            try {
                const { data, error } = await supabase
                    .from('org_memberships')
                    .select('org_id')
                    .eq('user_id', user.id)
                    .eq('role', 'club_director');
                if (error) throw error;
                const orgId = data?.[0]?.org_id || null;
                if (!orgId) { if (!cancelled) setOrgLoading(false); return; }
                const { data: orgRow, error: orgErr } = await supabase
                    .from('organizations')
                    .select('id, name, display_name, logo_url, primary_color, slug')
                    .eq('id', orgId)
                    .maybeSingle();
                if (orgErr) throw orgErr;
                if (cancelled || !orgRow) { if (!cancelled) setOrgLoading(false); return; }
                setOrg(orgRow);
                setClubName(orgRow.display_name || orgRow.name || '');
                setLogoUrl(orgRow.logo_url || '');
                if (orgRow.primary_color) setBrandColor(orgRow.primary_color);
            } catch (err) {
                console.error('[Onboarding] club fetch failed:', err);
            } finally {
                if (!cancelled) setOrgLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [user?.id]);

    const dismiss = useCallback(() => {
        try { localStorage.setItem(ONBOARDING_DISMISSED_KEY, '1'); } catch (_) { /* ignore */ }
        onClose?.();
    }, [onClose]);

    // ------------------------------------------------------------------ Step 1
    // Same storage pattern as SponsorsDrilldown.uploadLogo (media bucket +
    // getPublicUrl), namespaced under branding/{orgId}/.
    const uploadClubLogo = async (file) => {
        if (!file) return;
        if (!org?.id) { toast.error('No club found for your account yet.'); return; }
        const okTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
        if (!okTypes.includes(file.type)) { toast.error('Use a PNG, JPG, WEBP or SVG image.'); return; }
        if (file.size > 1024 * 1024) { toast.error('Logo must be under 1MB.'); return; }
        setUploadingLogo(true);
        try {
            const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/svg+xml' ? 'svg' : file.type.split('/')[1];
            const path = `branding/${org.id}/${crypto.randomUUID()}.${ext}`;
            const { error: upErr } = await supabase.storage.from('media').upload(path, file, { contentType: file.type, upsert: true });
            if (upErr) throw upErr;
            const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
            setLogoUrl(publicUrl);
            toast.success('Logo uploaded.');
        } catch (e) {
            toast.error(`Logo upload failed: ${e.message}. You can add it later — keep going.`);
        } finally {
            setUploadingLogo(false);
        }
    };

    const saveBranding = async () => {
        if (!org?.id) {
            // No club_director membership — branding/team steps can't work.
            toast.error('Your account is not a club director on any club yet. Ask your club admin, then re-run setup.');
            return false;
        }
        if (!clubName.trim()) { toast.error('Club name is required.'); return false; }
        try {
            // Column-restricted SECURITY DEFINER RPC (a club_director must not be
            // able to write arbitrary org columns like slug/fee/owner via RLS).
            const { error } = await supabase.rpc('update_org_branding', {
                p_org_id: org.id,
                p_name: clubName.trim(),
                p_display_name: clubName.trim(),
                p_logo_url: logoUrl || null,
                p_primary_color: brandColor || null,
            });
            if (error) throw error;
            toast.success('Club branding saved.');
            return true;
        } catch (err) {
            // Non-fatal: branding is cosmetic; don't dead-end the flow.
            toast.warning(`Branding couldn't be saved (${err.message}) — continuing setup.`);
            return true;
        }
    };

    // ------------------------------------------------------------------ Step 2
    // Exact CreateTeamModal shape: teams insert (org_id, name, age_group,
    // join_code [+ season]) then a belt-and-braces membership upsert — a DB
    // trigger (auto_add_team_creator_membership) also links the creator.
    const saveTeam = async () => {
        if (team?.id) return true; // already created — never recreate on Back/Next
        if (!org?.id) { toast.error('No club found — you need club director access to create a team.'); return false; }
        if (!teamName.trim()) { toast.error('Team name is required.'); return false; }
        try {
            const { data: teamData, error: teamError } = await supabase
                .from('teams')
                .insert({
                    org_id: org.id,
                    name: teamName.trim(),
                    age_group: ageGroup,
                    season: season.trim() || null,
                    join_code: randomJoinCode(),
                })
                .select()
                .single();
            if (teamError) throw teamError;

            const { error: membershipError } = await supabase
                .from('team_memberships')
                .upsert(
                    { team_id: teamData.id, user_id: user.id, role: 'manager' },
                    { onConflict: 'team_id,user_id', ignoreDuplicates: true }
                );
            // The trigger already added the membership; a failed upsert is non-fatal.
            if (membershipError) console.warn('[Onboarding] membership upsert warning:', membershipError.message);

            setTeam(teamData);
            toast.success(`Team "${teamData.name}" created!`);
            return true;
        } catch (err) {
            toast.error(`Couldn't create team: ${err.message}`);
            return false;
        }
    };

    // ------------------------------------------------------------------ Step 3
    // The same create-player edge function CreatePlayerModal calls. It requires
    // firstName, lastName, jerseyNumber (1-99, unique per team) and a 4-digit
    // pin — we auto-assign blank jerseys and auto-generate PINs so entry stays
    // fast. Each success returns player_id + guardian_code (the invite key).
    const createOnePlayer = async (p, jerseyNum, accessToken) => {
        const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-player`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({
                    firstName: p.first.trim(),
                    lastName: p.last.trim(),
                    jerseyNumber: jerseyNum,
                    pin: randomPin(),
                    teamId: team.id,
                }),
            }
        );
        let result = null;
        try { result = await response.json(); } catch (_) { /* non-JSON error body */ }
        if (!response.ok || !result?.success) {
            throw new Error(result?.error || `Failed to create ${p.first} ${p.last}`);
        }
        return result;
    };

    const savePlayers = async () => {
        if (!team?.id) { toast.error('Create your team first.'); return false; }

        // Collect pending entries: typed rows + pasted list.
        const typed = rows.filter((r) => r.first.trim() && r.last.trim());
        const { players: pasted, skipped } = parsePastedRoster(pasteText);
        if (skipped > 0) toast.warning(`${skipped} pasted line${skipped === 1 ? '' : 's'} skipped (need "First Last").`);
        const pending = [...typed, ...pasted];

        if (pending.length === 0) {
            if (createdPlayers.length > 0) return true; // nothing new — just advance
            toast.error('Add at least one player (or paste a list).');
            return false;
        }

        const { data: { session: liveSession } } = await supabase.auth.getSession();
        if (!liveSession) { toast.error('Not signed in — please log in again.'); return false; }

        // Jersey auto-assignment: honor typed numbers, fill blanks with the
        // lowest unused 1-99 (unique per team is enforced by the DB).
        const used = new Set(createdPlayers.map((c) => Number(c.jersey)).filter(Boolean));
        const nextFree = () => { let n = 1; while (used.has(n) && n <= 99) n += 1; return n <= 99 ? n : null; };

        const created = [];
        const failures = [];
        for (const p of pending) {
            let jerseyNum = parseInt(p.jersey, 10);
            if (!Number.isInteger(jerseyNum) || jerseyNum < 1 || jerseyNum > 99 || used.has(jerseyNum)) {
                jerseyNum = nextFree();
            }
            if (!jerseyNum) { failures.push(`${p.first} ${p.last}: no jersey numbers left`); continue; }
            try {
                const result = await createOnePlayer(p, jerseyNum, liveSession.access_token);
                used.add(jerseyNum);
                created.push({
                    player_id: result.player_id,
                    name: `${p.first.trim()} ${p.last.trim()}`,
                    jersey: result.jersey_number || jerseyNum,
                    code: result.guardian_code || null,
                });
            } catch (err) {
                failures.push(`${p.first} ${p.last}: ${err.message}`);
            }
        }

        if (created.length > 0) {
            setCreatedPlayers((prev) => [...prev, ...created]);
            setRows([emptyRow()]);
            setPasteText('');
            toast.success(`${created.length} player${created.length === 1 ? '' : 's'} added to the roster.`);
        }
        if (failures.length > 0) {
            toast.error(`Couldn't add: ${failures.join(' • ')}`, 8000);
        }
        return created.length > 0 || createdPlayers.length > 0;
    };

    // ------------------------------------------------------------------ Step 4
    // Invite links from the guardian codes create-player returned. If state is
    // empty (wizard re-entry), fall back to get_manager_setup_health() — the
    // same RPC SetupHealthPanel uses; its unlinked_players carry name/code/jersey.
    const invitees = createdPlayers.filter((p) => p.code).length > 0
        ? createdPlayers.filter((p) => p.code)
        : inviteFallback;

    useEffect(() => {
        if (step !== 4 || createdPlayers.some((p) => p.code) || inviteFallback.length > 0) return;
        let cancelled = false;
        (async () => {
            const { data: res, error } = await supabase.rpc('get_manager_setup_health');
            if (cancelled || error || !res || res.error) return;
            setInviteFallback((res.unlinked_players || []).map((p) => ({
                player_id: p.code, name: p.name, jersey: p.jersey, code: p.code,
            })));
        })();
        return () => { cancelled = true; };
    }, [step, createdPlayers, inviteFallback.length]);

    const clubLabel = clubName.trim() || 'our team';
    const inviteMessage = (p) =>
        `Join ${p.name} on the ${clubLabel} app — tap to sign up and you're connected automatically:\n${buildInviteUrl(p.code)}\n\n(Backup: go to firefcapp.com and enter code ${p.code}.)`;
    const allInvitesMessage = () =>
        `${clubLabel} is live on our team app! Tap YOUR player's link to sign up — you're connected automatically:\n\n` +
        invitees.map((p) => `${p.name}: ${buildInviteUrl(p.code)}`).join('\n');

    const copyText = (key, text) => {
        try {
            navigator.clipboard?.writeText(text);
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(null), 1500);
        } catch (_) { /* clipboard blocked — non-fatal */ }
    };

    // Pre-filled SMS body — same sms:?&body= scheme SetupHealthPanel uses.
    const smsHref = (body) => `sms:?&body=${encodeURIComponent(body)}`;

    // ------------------------------------------------------------------ Step 5
    // Exact KeyDatesPanel insert shape: title/type/start_time/location_name/
    // notes + team_id/org_id/created_by.
    const saveEvent = async () => {
        if (eventSaved) return true; // don't double-create on Back/Next
        if (!team?.id) { toast.error('Create your team first.'); return false; }
        if (!evTitle.trim()) { toast.error('Event title is required.'); return false; }
        if (!evDate) { toast.error('Event date is required.'); return false; }
        try {
            const start_time = new Date(`${evDate}T${evTime || '00:00'}`).toISOString();
            const { error } = await supabase.from('events').insert({
                title: evTitle.trim(),
                type: evType,
                start_time,
                location_name: evLocation.trim() || null,
                notes: null,
                team_id: team.id,
                org_id: team.org_id || org?.id,
                created_by: user?.id || null,
            });
            if (error) throw error;
            setEventSaved(true);
            toast.success('First event on the calendar!');
            return true;
        } catch (err) {
            toast.error(`Couldn't save event: ${err.message}`);
            return false;
        }
    };

    // ------------------------------------------------------------- Navigation
    const goNext = async () => {
        if (busy) return;
        setBusy(true);
        try {
            let ok = true;
            if (step === 1) ok = await saveBranding();
            else if (step === 2) ok = await saveTeam();
            else if (step === 3) ok = await savePlayers();
            else if (step === 5) ok = await saveEvent();
            if (ok) setStep((s) => Math.min(s + 1, 6));
        } catch (err) {
            // Belt-and-braces: no step may ever crash the dashboard.
            console.error('[Onboarding] step failed:', err);
            toast.error(err?.message || 'Something went wrong — try again.');
        } finally {
            setBusy(false);
        }
    };
    const goBack = () => { if (!busy && step > 1) setStep((s) => s - 1); };
    const skipEvent = () => { if (!busy) setStep(6); };

    const firstInviteUrl = invitees[0]?.code ? buildInviteUrl(invitees[0].code) : '';
    const clubLoginUrl = org?.slug
        ? `${window.location.origin}/login?club=${encodeURIComponent(org.slug)}`
        : `${window.location.origin}/login`;
    const qrData = firstInviteUrl || clubLoginUrl;
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;

    // ----------------------------------------------------------------- Render
    const overlay = (
        <div className="fixed inset-0 z-[120] bg-brand-dark flex flex-col animate-fade-in" style={{ height: '100dvh' }}>
            {/* Header */}
            <div className="shrink-0 border-b border-white/10 bg-black/40 px-4 py-3">
                <div className="max-w-lg mx-auto">
                    <div className="flex items-center justify-between gap-2">
                        <h1 className="text-white font-display font-bold uppercase tracking-wider text-base flex items-center gap-2">
                            <Shield className="w-5 h-5 text-brand-green" /> Club Setup
                        </h1>
                        <button
                            onClick={dismiss}
                            className="text-xs text-gray-500 hover:text-white underline underline-offset-2 flex items-center gap-1"
                        >
                            <SkipForward className="w-3.5 h-3.5" /> Skip setup for now
                        </button>
                    </div>
                    {/* Progress */}
                    <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">
                                Step {step} of 6 — <span className="text-brand-gold">{STEP_LABELS[step - 1]}</span>
                            </span>
                            <span className="text-[11px] text-gray-600">{Math.round((step / 6) * 100)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-brand-green to-brand-gold rounded-full transition-all duration-300"
                                style={{ width: `${(step / 6) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Body — flex-1 min-h-0 so it scrolls on mobile */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6">
                <div className="max-w-lg mx-auto space-y-5 pb-6">

                    {/* ================= STEP 1: Welcome + Branding ================= */}
                    {step === 1 && (
                        <>
                            <div className="text-center mb-2">
                                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-brand-green/10 flex items-center justify-center">
                                    <Palette className="w-8 h-8 text-brand-green" />
                                </div>
                                <h2 className="text-2xl text-white font-display font-bold uppercase tracking-wider">Welcome!</h2>
                                <p className="text-gray-400 text-sm mt-1">
                                    Let's get your club live in about 10 minutes. First — make it yours.
                                </p>
                            </div>

                            {orgLoading ? (
                                <div className="glass-panel p-6 flex items-center justify-center gap-2 text-gray-400 text-sm">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Loading your club…
                                </div>
                            ) : !org ? (
                                <div className="glass-panel p-4 border-l-4 border-l-yellow-500 text-sm text-yellow-300">
                                    We couldn't find a club on your account. If you just subscribed, give it a
                                    minute and reopen setup — or contact us and we'll get you sorted.
                                </div>
                            ) : (
                                <div className="glass-panel p-5 space-y-4">
                                    <div>
                                        <label className={labelCls}>Club Name</label>
                                        <input
                                            type="text"
                                            value={clubName}
                                            onChange={(e) => setClubName(e.target.value)}
                                            placeholder="e.g. Rockford Raptors SC"
                                            className={inputCls}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Club Logo (optional)</label>
                                        <div className="flex items-center gap-3">
                                            {logoUrl
                                                ? <img src={logoUrl} alt="Club logo" className="h-14 w-14 object-contain rounded-lg bg-white/10 p-1" />
                                                : <div className="h-14 w-14 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 font-display text-xl">{(clubName || '?').charAt(0).toUpperCase()}</div>}
                                            <label className="cursor-pointer text-sm bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 flex items-center gap-1.5 text-gray-200">
                                                {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                                {logoUrl ? 'Replace logo' : 'Upload logo'}
                                                <input
                                                    type="file"
                                                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                                    className="hidden"
                                                    onChange={(e) => { uploadClubLogo(e.target.files?.[0]); e.target.value = ''; }}
                                                />
                                            </label>
                                        </div>
                                        <p className="mt-1 text-[11px] text-gray-500">PNG, JPG, WEBP or SVG, under 1MB.</p>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Primary Brand Color</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="color"
                                                value={brandColor}
                                                onChange={(e) => setBrandColor(e.target.value)}
                                                className="h-10 w-16 rounded bg-black/50 border border-white/10 cursor-pointer"
                                            />
                                            <span className="text-sm font-mono text-gray-300">{brandColor}</span>
                                        </div>
                                        <p className="mt-1 text-[11px] text-gray-500">Buttons, highlights and your team pages take this color.</p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* ================= STEP 2: Create Team ================= */}
                    {step === 2 && (
                        <>
                            <div className="text-center mb-2">
                                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-brand-green/10 flex items-center justify-center">
                                    <Shield className="w-8 h-8 text-brand-green" />
                                </div>
                                <h2 className="text-2xl text-white font-display font-bold uppercase tracking-wider">Create Your First Team</h2>
                                <p className="text-gray-400 text-sm mt-1">You can add more teams later from the Team tab.</p>
                            </div>

                            {team?.id ? (
                                <div className="glass-panel p-5 border-l-4 border-l-brand-green">
                                    <p className="text-white font-bold flex items-center gap-2">
                                        <Check className="w-5 h-5 text-brand-green" /> {team.name}
                                    </p>
                                    <p className="text-gray-400 text-sm mt-1">
                                        {team.age_group}{team.season ? ` • ${team.season}` : ''} — team code <code className="text-brand-gold font-mono">{team.join_code}</code>
                                    </p>
                                    <p className="text-[11px] text-gray-500 mt-2">Team created — hit Next to build the roster.</p>
                                </div>
                            ) : (
                                <div className="glass-panel p-5 space-y-4">
                                    <div>
                                        <label className={labelCls}>Team Name</label>
                                        <input
                                            type="text"
                                            value={teamName}
                                            onChange={(e) => setTeamName(e.target.value)}
                                            placeholder="e.g. Raptors Red U10"
                                            className={inputCls}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className={labelCls}>Age Group</label>
                                            <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} className={inputCls}>
                                                {GENDER_GROUPS.map((gender) => (
                                                    <optgroup key={gender} label={gender}>
                                                        {AGE_BRACKETS.map((bracket) => {
                                                            const value = `${bracket} ${gender}`;
                                                            return <option key={value} value={value}>{value}</option>;
                                                        })}
                                                    </optgroup>
                                                ))}
                                                <option value="High School">High School</option>
                                                <option value="Adult">Adult</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelCls}>Season</label>
                                            <input
                                                type="text"
                                                value={season}
                                                onChange={(e) => setSeason(e.target.value)}
                                                placeholder="e.g. Fall 2026"
                                                className={inputCls}
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-gray-500">A join code is generated automatically for your team.</p>
                                </div>
                            )}
                        </>
                    )}

                    {/* ================= STEP 3: Add Players ================= */}
                    {step === 3 && (
                        <>
                            <div className="text-center mb-2">
                                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-brand-green/10 flex items-center justify-center">
                                    <Users className="w-8 h-8 text-brand-green" />
                                </div>
                                <h2 className="text-2xl text-white font-display font-bold uppercase tracking-wider">Add Your Players</h2>
                                <p className="text-gray-400 text-sm mt-1">
                                    Just names — jersey numbers auto-assign if you leave them blank.
                                </p>
                            </div>

                            {createdPlayers.length > 0 && (
                                <div className="glass-panel p-3 border-l-4 border-l-brand-green flex items-center gap-2 text-sm text-white">
                                    <Check className="w-4 h-4 text-brand-green shrink-0" />
                                    <span><span className="text-brand-green font-bold text-lg">{createdPlayers.length}</span> player{createdPlayers.length === 1 ? '' : 's'} on the roster</span>
                                </div>
                            )}

                            <div className="glass-panel p-4 space-y-2.5">
                                {rows.map((row, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={row.first}
                                            onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, first: e.target.value } : r)))}
                                            placeholder="First"
                                            className={`${inputCls} flex-1`}
                                        />
                                        <input
                                            type="text"
                                            value={row.last}
                                            onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, last: e.target.value } : r)))}
                                            placeholder="Last"
                                            className={`${inputCls} flex-1`}
                                        />
                                        <input
                                            type="number"
                                            value={row.jersey}
                                            onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, jersey: e.target.value } : r)))}
                                            placeholder="#"
                                            min="1"
                                            max="99"
                                            className={`${inputCls} w-16 px-2 text-center`}
                                        />
                                        <button
                                            onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [emptyRow()]))}
                                            className="p-1.5 text-gray-600 hover:text-red-400 shrink-0"
                                            title="Remove row"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => setRows((rs) => [...rs, emptyRow()])}
                                    className="w-full py-2 rounded-lg border border-dashed border-white/15 text-gray-400 text-sm hover:text-white hover:border-brand-green/40 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <Plus className="w-4 h-4" /> Add another
                                </button>
                            </div>

                            <div className="glass-panel p-4">
                                <button
                                    onClick={() => setShowPaste((v) => !v)}
                                    className="text-sm text-brand-gold flex items-center gap-1.5 font-bold uppercase tracking-wider text-xs"
                                >
                                    <ClipboardPaste className="w-4 h-4" /> {showPaste ? 'Hide paste-a-list' : 'Or paste a list'}
                                </button>
                                {showPaste && (
                                    <>
                                        <textarea
                                            value={pasteText}
                                            onChange={(e) => setPasteText(e.target.value)}
                                            rows={5}
                                            placeholder={'One player per line:\nLeo Messi\nBo Tipp 58\nMia Hamm #9'}
                                            className={`${inputCls} mt-2 font-mono text-xs`}
                                        />
                                        <p className="mt-1 text-[11px] text-gray-500">"First Last" — add a number at the end for their jersey.</p>
                                    </>
                                )}
                            </div>
                            <p className="text-[11px] text-gray-500 text-center">
                                Each player gets a private sign-in PIN automatically — families connect with the invite links on the next step.
                            </p>
                        </>
                    )}

                    {/* ================= STEP 4: Invite Families ================= */}
                    {step === 4 && (
                        <>
                            <div className="text-center mb-2">
                                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-brand-gold/10 flex items-center justify-center">
                                    <LinkIcon className="w-8 h-8 text-brand-gold" />
                                </div>
                                <h2 className="text-2xl text-white font-display font-bold uppercase tracking-wider">Invite The Families</h2>
                                <p className="text-gray-400 text-sm mt-1">
                                    Each player has a tap-to-join link. Parents tap it, sign up, and they're connected automatically.
                                </p>
                            </div>

                            {invitees.length === 0 ? (
                                <div className="glass-panel p-5 text-center text-gray-400 text-sm">
                                    No players yet — go back a step and add your roster first.
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-2">
                                        <a
                                            href={smsHref(allInvitesMessage())}
                                            className="btn-primary py-3 flex items-center justify-center gap-1.5 text-sm"
                                        >
                                            <MessageSquare className="w-4 h-4" /> Text all invites
                                        </a>
                                        <button
                                            onClick={() => copyText('__all__', allInvitesMessage())}
                                            className="py-3 rounded-lg bg-brand-gold/15 border border-brand-gold/40 text-brand-gold font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-1.5 hover:bg-brand-gold/25 transition-colors"
                                        >
                                            {copiedKey === '__all__' ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy all invites</>}
                                        </button>
                                    </div>

                                    <div className="space-y-1.5">
                                        {invitees.map((p) => (
                                            <div key={p.code} className="glass-panel px-3 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="flex-1 text-sm text-white font-medium truncate">
                                                        {p.name} {p.jersey ? <span className="text-gray-600">#{p.jersey}</span> : null}
                                                    </span>
                                                    <code className="text-xs font-mono text-brand-gold">{p.code}</code>
                                                </div>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <a
                                                        href={smsHref(inviteMessage(p))}
                                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-green/15 border border-brand-green/30 text-brand-green text-xs font-bold uppercase tracking-wider hover:bg-brand-green/25 transition-colors"
                                                    >
                                                        <MessageSquare className="w-3.5 h-3.5" /> Text invite
                                                    </a>
                                                    <button
                                                        onClick={() => copyText(p.code, buildInviteUrl(p.code))}
                                                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-gray-300 text-xs font-medium hover:bg-white/10 transition-colors"
                                                    >
                                                        {copiedKey === p.code
                                                            ? <><Check className="w-3.5 h-3.5 text-brand-green" /> Copied</>
                                                            : <><LinkIcon className="w-3.5 h-3.5" /> Copy link</>}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-gray-500 text-center">
                                        You can always resend these later from Coach HQ → Setup Health.
                                    </p>
                                </>
                            )}
                        </>
                    )}

                    {/* ================= STEP 5: First Event ================= */}
                    {step === 5 && (
                        <>
                            <div className="text-center mb-2">
                                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-brand-green/10 flex items-center justify-center">
                                    <Calendar className="w-8 h-8 text-brand-green" />
                                </div>
                                <h2 className="text-2xl text-white font-display font-bold uppercase tracking-wider">Schedule Your First Event</h2>
                                <p className="text-gray-400 text-sm mt-1">
                                    Families see it the moment they join — and can RSVP right away.
                                </p>
                            </div>

                            {eventSaved ? (
                                <div className="glass-panel p-5 border-l-4 border-l-brand-green text-sm text-white flex items-center gap-2">
                                    <Check className="w-5 h-5 text-brand-green shrink-0" /> "{evTitle}" is on the calendar. Hit Next to finish.
                                </div>
                            ) : (
                                <div className="glass-panel p-5 space-y-4">
                                    <div>
                                        <label className={labelCls}>Title</label>
                                        <input type="text" value={evTitle} onChange={(e) => setEvTitle(e.target.value)} className={inputCls} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className={labelCls}>Type</label>
                                            <select value={evType} onChange={(e) => setEvType(e.target.value)} className={inputCls}>
                                                {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelCls}>Date</label>
                                            <input type="date" value={evDate} onChange={(e) => setEvDate(e.target.value)} className={inputCls} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className={labelCls}>Time</label>
                                            <input type="time" value={evTime} onChange={(e) => setEvTime(e.target.value)} className={inputCls} />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Location</label>
                                            <input type="text" value={evLocation} onChange={(e) => setEvLocation(e.target.value)} placeholder="e.g. Mercyhealth Sportscore" className={inputCls} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!eventSaved && (
                                <button onClick={skipEvent} className="w-full text-center text-sm text-gray-500 hover:text-white underline underline-offset-2">
                                    Skip for now — I'll schedule later
                                </button>
                            )}
                        </>
                    )}

                    {/* ================= STEP 6: Done ================= */}
                    {step === 6 && (
                        <>
                            <div className="text-center">
                                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-brand-gold/10 flex items-center justify-center animate-pulse">
                                    <PartyPopper className="w-10 h-10 text-brand-gold" />
                                </div>
                                <h2 className="text-3xl text-white font-display font-bold uppercase tracking-wider">You're Live!</h2>
                                <p className="text-gray-400 text-sm mt-2 max-w-sm mx-auto">
                                    {clubLabel} is up and running{team ? ` with ${team.name}` : ''}
                                    {createdPlayers.length > 0 ? ` and ${createdPlayers.length} player${createdPlayers.length === 1 ? '' : 's'} on the roster` : ''}.
                                </p>
                            </div>

                            <div className="glass-panel p-5 text-center space-y-3">
                                <p className="text-xs uppercase tracking-widest text-gray-400 font-bold">
                                    {firstInviteUrl ? 'Scan to join — first player invite' : 'Scan to open your club login'}
                                </p>
                                <img src={qrSrc} alt="Join QR code" className="mx-auto rounded-lg bg-white p-2" width="200" height="200" />
                                {team?.join_code && (
                                    <p className="text-sm text-gray-300">
                                        Team code: <code className="text-brand-gold font-mono font-bold">{team.join_code}</code>
                                    </p>
                                )}
                                <p className="text-[11px] text-gray-500 break-all">{qrData}</p>
                            </div>

                            <button onClick={dismiss} className="w-full btn-primary py-3.5 font-display uppercase tracking-wider">
                                Go to my dashboard
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Footer nav (hidden on the Done step) */}
            {step < 6 && (
                <div className="shrink-0 border-t border-white/10 bg-black/40 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
                        <button
                            onClick={goBack}
                            disabled={busy || step === 1}
                            className="px-4 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors uppercase font-bold text-xs tracking-wider flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-4 h-4" /> Back
                        </button>
                        <button
                            onClick={goNext}
                            disabled={busy}
                            className="btn-primary px-8 py-2.5 flex items-center gap-1.5 disabled:opacity-60"
                        >
                            {busy
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                                : <>{step === 4 ? 'Next' : step === 5 ? 'Finish' : 'Next'} <ChevronRight className="w-4 h-4" /></>}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

    // Portal to <body>: the fixed overlay can never be trapped by a
    // glass-panel / backdrop-filter ancestor.
    return createPortal(overlay, document.body);
};

export default OnboardingWizard;
