import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Users, UserCheck, Activity, ChevronDown, ChevronUp, Copy, Check, MessageSquare, Link as LinkIcon } from 'lucide-react';
import { buildInviteUrl } from '../../utils/pendingInvite';

// Rollout-period "Setup Health" panel for the manager/coach landing.
// Shows how many players have a parent connected, how many parents are
// linked, recent activity, and the chase-list of players with no parent
// yet (with their guardian codes for easy sharing).
//
// Backed by get_manager_setup_health() RPC (SECURITY DEFINER, self-checks
// that the caller is staff). Returns {error:'not_staff'} for non-staff,
// in which case this panel renders nothing.
//
// NOTE on "active": these are recently-active counts (logged in within
// the window), NOT live concurrent presence. True "online now" needs
// realtime presence tracking, which is a later add.

const Stat = ({ label, value, icon: Icon, accent }) => (
    <div className="flex-1 bg-white/[0.03] rounded-lg p-3 text-center">
        <Icon className={`w-4 h-4 mx-auto mb-1 ${accent}`} />
        <p className="text-white text-xl font-bold leading-none">{value}</p>
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">{label}</p>
    </div>
);

const SetupHealthPanel = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);
    const [copiedCode, setCopiedCode] = useState(null);
    const [copiedLink, setCopiedLink] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data: res, error } = await supabase.rpc('get_manager_setup_health');
            if (cancelled) return;
            if (!error && res && !res.error) setData(res);
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, []);

    if (loading || !data) return null;

    const connected = data.players_with_parent || 0;
    const total = data.total_players || 0;
    const pct = total > 0 ? Math.round((connected / total) * 100) : 0;
    const unlinked = data.unlinked_players || [];

    const copyCode = (code) => {
        try {
            navigator.clipboard?.writeText(code);
            setCopiedCode(code);
            setTimeout(() => setCopiedCode(null), 1500);
        } catch (_) { /* clipboard blocked — non-fatal */ }
    };

    const copyLink = (code) => {
        try {
            navigator.clipboard?.writeText(buildInviteUrl(code));
            setCopiedLink(code);
            setTimeout(() => setCopiedLink(null), 1500);
        } catch (_) { /* clipboard blocked — non-fatal */ }
    };

    // Pre-filled SMS body with the tap-to-join link (code as backup).
    const inviteSmsHref = (p) =>
        `sms:?&body=${encodeURIComponent(
            `Join ${p.name} on the Fire FC app — tap to sign up and you're connected automatically:\n${buildInviteUrl(p.code)}\n\n(Backup: go to firefcapp.com and enter code ${p.code}.)`
        )}`;

    return (
        <div className="glass-panel p-4 border-l-4 border-l-brand-green">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-display font-bold uppercase tracking-wider text-sm">
                    Setup Health
                </h3>
                <span className="text-[10px] uppercase tracking-wider text-gray-500">Rollout tracker</span>
            </div>

            {/* Connected-players progress */}
            <div className="mb-3">
                <div className="flex items-end justify-between mb-1.5">
                    <span className="text-sm text-gray-300">
                        <span className="text-brand-green font-bold text-lg">{connected}</span>
                        <span className="text-gray-500"> / {total}</span> players have a parent connected
                    </span>
                    <span className="text-brand-green font-bold text-sm">{pct}%</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-brand-green to-green-400 rounded-full transition-all"
                         style={{ width: `${pct}%` }} />
                </div>
            </div>

            <div className="flex gap-2">
                <Stat label="Parents linked" value={data.parents_linked || 0} icon={UserCheck} accent="text-brand-gold" />
                <Stat label="Active 24h"     value={data.active_24h || 0}    icon={Activity}  accent="text-brand-green" />
                <Stat label="Active 7d"      value={data.active_7d || 0}     icon={Users}     accent="text-blue-400" />
            </div>

            {unlinked.length > 0 && (
                <>
                    <button
                        onClick={() => setExpanded(v => !v)}
                        className="w-full mt-3 flex items-center justify-between px-3 py-2 rounded-lg bg-brand-gold/10 border border-brand-gold/20 text-brand-gold text-sm font-medium hover:bg-brand-gold/15 transition-colors"
                    >
                        <span>{unlinked.length} player{unlinked.length === 1 ? '' : 's'} still need a parent</span>
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {expanded && (
                        <div className="mt-2 space-y-1.5">
                            {unlinked.map((p) => (
                                <div key={p.code} className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5">
                                    <div className="flex items-center gap-2">
                                        <span className="flex-1 text-sm text-gray-300 truncate">
                                            {p.name} {p.jersey ? <span className="text-gray-600">#{p.jersey}</span> : null}
                                        </span>
                                        <code className="text-xs font-mono text-brand-gold">{p.code}</code>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <a
                                            href={inviteSmsHref(p)}
                                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-green/15 border border-brand-green/30 text-brand-green text-xs font-bold uppercase tracking-wider hover:bg-brand-green/25 transition-colors"
                                        >
                                            <MessageSquare className="w-3.5 h-3.5" /> Text invite
                                        </a>
                                        <button
                                            onClick={() => copyLink(p.code)}
                                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-gray-300 text-xs font-medium hover:bg-white/10 transition-colors"
                                            title="Copy invite link"
                                        >
                                            {copiedLink === p.code
                                                ? <><Check className="w-3.5 h-3.5 text-brand-green" /> Copied</>
                                                : <><LinkIcon className="w-3.5 h-3.5" /> Copy link</>}
                                        </button>
                                        <button
                                            onClick={() => copyCode(p.code)}
                                            className="p-1.5 text-gray-500 hover:text-white"
                                            title="Copy backup code"
                                        >
                                            {copiedCode === p.code ? <Check className="w-3.5 h-3.5 text-brand-green" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <p className="text-[10px] text-gray-600 px-1 pt-1">
                                "Text invite" sends a tap-to-join link — the parent signs up and is linked automatically. The code is just a backup.
                            </p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default SetupHealthPanel;
