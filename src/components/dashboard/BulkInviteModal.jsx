import React, { useEffect, useMemo, useState } from 'react';
import { X, Copy, Check, MessageSquare, Mail, Users, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useToast } from '../Toast';

// One-tap roster-wide invite. Generates a single paste-ready message
// with every player's guardian code + setup steps, so the coach can
// drop it into the team's group chat once and every parent self-serves.
const BulkInviteModal = ({ teamId, teamName, onClose }) => {
    const toast = useToast();
    const [roster, setRoster] = useState([]);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!teamId) return;
            const { data, error } = await supabase
                .from('team_active_roster')
                .select('id, first_name, last_name, guardian_code')
                .eq('team_id', teamId)
                .order('last_name', { ascending: true });
            if (cancelled) return;
            if (error) {
                console.error('[BulkInviteModal] roster fetch failed', error);
                toast.error("Couldn't load roster.");
                setRoster([]);
            } else {
                setRoster(data || []);
            }
            setLoading(false);
        };
        run();
        return () => { cancelled = true; };
    }, [teamId]);

    // App URL: best-guess from the current origin. Albert can edit before
    // sending if he wants a custom link.
    const appUrl = (typeof window !== 'undefined' && window.location?.origin)
        ? window.location.origin
        : 'https://your-fire-fc-app';

    const message = useMemo(() => {
        const lines = roster
            .filter(r => r.guardian_code)
            .map(r => `  • ${r.first_name} ${r.last_name} — ${r.guardian_code}`)
            .join('\n');

        return (
`FIRE FC — ${teamName || 'Our Team'}: family app setup

Hi parents! Our team is now set up in the Fire FC app. Each player has a unique 6-character code below — find your kid, then:

1) Open the app on your phone: ${appUrl}
2) Sign up as a FAMILY account (your email + a password)
3) Tap "Link to Your Player" and enter your child's code
4) Fill in your relationship, name, and cell

Your child's code:
${lines || '  (Roster loading — try again in a sec)'}

ADD IT TO YOUR HOME SCREEN (one-time, takes 10 seconds):
• iPhone (Safari): tap the Share button (square + up arrow) at the bottom → scroll down → "Add to Home Screen" → Add
• Android (Chrome): tap the ⋮ menu top-right → "Add to Home screen" or "Install app" → Add
After that, the Fire FC icon launches it like a real app — full-screen, no browser bar.

Both parents/guardians can use the same code — each one signs up with their own account so we have separate contact info for everyone. Reach out with any questions. Thanks!`
        );
    }, [roster, teamName, appUrl]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(message);
            setCopied(true);
            toast.success('Message copied — paste it into your team group chat.');
            setTimeout(() => setCopied(false), 2200);
        } catch {
            toast.error('Copy failed — try selecting the text manually.');
        }
    };

    const encoded = encodeURIComponent(message);
    const smsHref = `sms:?body=${encoded}`;
    const mailHref = `mailto:?subject=${encodeURIComponent('Fire FC app setup — ' + (teamName || 'our team'))}&body=${encoded}`;

    const missingCodes = roster.filter(r => !r.guardian_code).length;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end md:items-center justify-center md:p-4 animate-fade-in">
            <div className="bg-brand-dark border border-white/10 rounded-t-2xl md:rounded-2xl w-full md:max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="p-6 md:p-8 pb-[max(2rem,env(safe-area-inset-bottom)+1.5rem)]">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="p-2.5 bg-brand-gold/15 rounded-xl">
                            <Users className="w-6 h-6 text-brand-gold" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-xl font-display font-bold text-white uppercase tracking-wider truncate">
                                Invite all families
                            </h2>
                            <p className="text-gray-400 text-xs">
                                One message with every code + setup steps. Paste it into your team group chat.
                            </p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
                        </div>
                    ) : (
                        <>
                            {missingCodes > 0 && (
                                <div className="mb-3 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-[11px]">
                                    {missingCodes} player{missingCodes === 1 ? '' : 's'} missing a guardian code — they won't be in the message. Re-add or refresh.
                                </div>
                            )}

                            <textarea
                                value={message}
                                onChange={() => { /* read-only on purpose; force copy/share flow */ }}
                                readOnly
                                rows={14}
                                onFocus={(e) => e.target.select()}
                                className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white text-xs leading-relaxed font-mono resize-none focus:outline-none focus:border-brand-green"
                            />

                            <div className="grid grid-cols-3 gap-3 mt-4">
                                <button
                                    onClick={handleCopy}
                                    className="flex items-center justify-center gap-1.5 px-2 py-3 rounded-xl bg-brand-green/10 border border-brand-green/40 text-brand-green hover:bg-brand-green/20 font-bold uppercase text-[11px] tracking-wider"
                                >
                                    {copied
                                        ? <><Check className="w-4 h-4" /> Copied</>
                                        : <><Copy className="w-4 h-4" /> Copy</>}
                                </button>
                                <a
                                    href={smsHref}
                                    className="flex items-center justify-center gap-1.5 px-2 py-3 rounded-xl bg-blue-500/10 border border-blue-500/40 text-blue-300 hover:bg-blue-500/20 font-bold uppercase text-[11px] tracking-wider"
                                >
                                    <MessageSquare className="w-4 h-4" /> Text
                                </a>
                                <a
                                    href={mailHref}
                                    className="flex items-center justify-center gap-1.5 px-2 py-3 rounded-xl bg-purple-500/10 border border-purple-500/40 text-purple-300 hover:bg-purple-500/20 font-bold uppercase text-[11px] tracking-wider"
                                >
                                    <Mail className="w-4 h-4" /> Email
                                </a>
                            </div>

                            <p className="text-[11px] text-gray-500 mt-4 leading-snug">
                                Tip: SMS works best from the coach's phone with a contact group selected. For a big roster (10+), Copy → paste into your existing team group chat is the fastest path.
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BulkInviteModal;
