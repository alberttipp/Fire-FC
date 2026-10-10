import React, { useState } from 'react';
import { X, Share2, Copy, Check, MessageSquare, Mail, Users, Smartphone, Download } from 'lucide-react';
import { useBranding } from '../../context/BrandingContext';
import { useToast } from '../Toast';
import BulkInviteModal from '../dashboard/BulkInviteModal';

// TeamShareModal — one place for a coach/manager to hand the app to their
// people. Two paths:
//   1. Share the app  — a club-branded link (?club=slug) so whoever opens it
//      sees THIS club's crest/colors and gets the install-the-app prompt with
//      the club icon. For coaches, assistants, fans — anyone.
//   2. Invite families — the roster-wide per-player codes (reuses
//      BulkInviteModal) so each parent is auto-linked to their own child.
const DEFAULT_CLUB_SLUG = 'rock-city-fc';

const TeamShareModal = ({ teamId, teamName, onClose }) => {
    const brand = useBranding();
    const toast = useToast();
    const [copied, setCopied] = useState(false);
    const [showBulk, setShowBulk] = useState(false);

    const origin = (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : 'https://firefcapp.com';
    const clubParam = brand.slug && brand.slug !== DEFAULT_CLUB_SLUG ? `?club=${encodeURIComponent(brand.slug)}` : '';
    const appUrl = `${origin}/login${clubParam}`;

    const title = `Join ${brand.name} on the app`;
    const message = `${brand.name} is on the app — your player's development hub: player card, training plan, schedule, team chat & stats, all in one place.\n\nOpen this link, then tap "Install app" to add it to your phone:\n${appUrl}`;

    const nativeShare = async () => {
        if (navigator.share) {
            try { await navigator.share({ title, text: message, url: appUrl }); return; } catch (_) { /* cancelled */ }
        }
        copyLink();
    };
    const copyLink = () => {
        try { navigator.clipboard.writeText(appUrl); setCopied(true); toast.success('Link copied.'); setTimeout(() => setCopied(false), 2000); }
        catch (_) { toast.error("Couldn't copy — long-press the link to copy it."); }
    };
    const smsHref = `sms:?body=${encodeURIComponent(message)}`;
    const emailHref = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(message)}`;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end md:items-center justify-center md:p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-brand-dark border border-white/10 rounded-t-2xl md:rounded-2xl w-full md:max-w-lg max-h-[92dvh] overflow-y-auto shadow-2xl relative"
                onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"><X className="w-6 h-6" /></button>

                <div className="p-6 md:p-8 pb-[max(2rem,env(safe-area-inset-bottom)+1.5rem)]">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 overflow-hidden shrink-0">
                            {brand.logoUrl ? <img src={brand.logoUrl} alt="" className="w-full h-full object-contain p-1" /> : <Share2 className="w-6 h-6 text-brand-green" />}
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-xl md:text-2xl font-display font-bold text-white uppercase tracking-wider truncate">Share the app</h2>
                            <p className="text-brand-green font-bold text-xs uppercase tracking-widest mt-0.5">{brand.name}</p>
                        </div>
                    </div>

                    {/* App link */}
                    <div className="bg-gradient-to-br from-brand-green/20 via-brand-green/5 to-transparent border border-brand-green/40 rounded-xl p-5 mb-4">
                        <p className="text-[10px] text-brand-green uppercase tracking-widest font-bold mb-1.5">Your club link</p>
                        <div className="flex items-center justify-between gap-2">
                            <div className="font-mono text-sm text-gray-200 truncate">{appUrl}</div>
                            <button onClick={copyLink} className="shrink-0 px-3 py-2 bg-brand-green/20 hover:bg-brand-green/30 rounded-lg flex items-center gap-1.5 text-brand-green text-xs font-bold uppercase tracking-wider">
                                {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                            </button>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-3 leading-snug flex items-start gap-1.5">
                            <Smartphone className="w-3 h-3 mt-0.5 shrink-0" />
                            Opens with the {brand.shortName || brand.name} crest and colors, and prompts them to install the app to their home screen.
                        </p>
                    </div>

                    {/* Share buttons */}
                    <button onClick={nativeShare}
                        className="w-full flex items-center justify-center gap-2 bg-brand-green text-brand-dark font-bold text-sm rounded-xl py-3 mb-3 hover:opacity-90 uppercase tracking-wider">
                        <Share2 className="w-4 h-4" /> Share link
                    </button>
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <a href={smsHref} className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-brand-green/40 bg-brand-green/10 text-brand-green font-bold uppercase text-xs tracking-wider hover:bg-brand-green/20">
                            <MessageSquare className="w-4 h-4" /> Text
                        </a>
                        <a href={emailHref} className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-purple-500/40 bg-purple-500/10 text-purple-300 font-bold uppercase text-xs tracking-wider hover:bg-purple-500/20">
                            <Mail className="w-4 h-4" /> Email
                        </a>
                    </div>

                    {/* Invite families (per-kid auto-link codes) */}
                    <div className="border-t border-white/10 pt-5">
                        <p className="text-[10px] text-brand-gold uppercase tracking-widest font-bold mb-2">Onboarding your team's parents?</p>
                        <button onClick={() => setShowBulk(true)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left">
                            <Users className="w-5 h-5 text-brand-gold shrink-0" />
                            <span className="flex-1 min-w-0">
                                <span className="block text-white text-sm font-bold">Invite families — with player codes</span>
                                <span className="block text-[11px] text-gray-400">One paste-ready message for the group chat; each parent links to their own child automatically.</span>
                            </span>
                            <Download className="w-4 h-4 text-gray-500 shrink-0" />
                        </button>
                        <p className="text-[11px] text-gray-500 mt-3 leading-snug">
                            Coaches &amp; assistants use the same club link above to sign up — then you can promote them from your roster.
                        </p>
                    </div>
                </div>
            </div>

            {showBulk && <BulkInviteModal teamId={teamId} teamName={teamName || brand.name} onClose={() => setShowBulk(false)} />}
        </div>
    );
};

export default TeamShareModal;
