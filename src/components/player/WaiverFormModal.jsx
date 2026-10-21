import React, { useState } from 'react';
import { X, FileSignature, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { trackEvent } from '../../utils/analytics';

// Full IYSA Emergency Medical Release & Liability Waiver — user-friendly fillable
// form. Prefills what we know (participant from the player record, guardian from
// the account), captures everything the league form requires, agreement + typed
// signature, and stores it via sign_waiver (which also produces the signed PDF).
const WAIVER_KEY = 'isl-indoor-2026-27';

const inp = 'w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-brand-green focus:outline-none';

// Required fields + friendly labels, so a blocked submit can say exactly what's
// missing instead of a vague "fill in all required fields" the parent can't act on.
const REQUIRED_FIELDS = [
    ['participant_name', 'Participant full name'],
    ['gender', 'Gender'],
    ['birthdate', 'Birthdate'],
    ['street', 'Street address'],
    ['city', 'City'],
    ['zip', 'Zip'],
    ['g1_name', 'Guardian 1 name'],
    ['g1_phone', 'Guardian 1 phone'],
    ['ec1_name', 'Emergency contact name'],
    ['ec1_phone', 'Emergency contact phone'],
    ['ec1_rel', 'Emergency contact relationship'],
    ['insurance_company', 'Insurance company'],
    ['policy_holder', 'Policy holder name'],
];

// NOTE: Field and Section MUST live at module scope. If they're defined inside
// WaiverFormModal, every keystroke re-creates them as new component types, so
// React remounts each input and focus is lost after one character.
const Field = ({ l, k, req, type = 'text', half, f, set }) => (
    <label className={`block ${half ? '' : 'col-span-2'}`}>
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{l}{req && <span className="text-red-400 font-bold"> *</span>}</span>
        <input type={type} value={f[k]} onChange={set(k)} className={inp} />
    </label>
);

const Section = ({ title, children }) => (
    <div className="space-y-2">
        <h3 className="text-brand-gold text-xs font-bold uppercase tracking-widest border-b border-white/10 pb-1">{title}</h3>
        <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
);

const WaiverFormModal = ({ player, onClose, onSigned }) => {
    const { user, profile } = useAuth();
    const guardianName = profile?.full_name || user?.user_metadata?.full_name || '';
    const guardianEmail = user?.email || '';

    const [f, setF] = useState({
        participant_name: `${player?.first_name || ''} ${player?.last_name || ''}`.trim(),
        gender: '', birthdate: player?.birthdate || '',
        street: '', city: '', zip: '', participant_phone: '', participant_email: '',
        g1_name: guardianName, g1_phone: '', g1_other: '',
        g2_name: '', g2_phone: '',
        guardian_emails: guardianEmail,
        ec1_name: '', ec1_phone: '', ec1_rel: '', ec1_email: '',
        ec2_name: '', ec2_phone: '', ec2_rel: '',
        allergies: '', conditions: '',
        physician: '', physician_phone: '',
        insurance_company: '', insurance_phone: '', policy_holder: '', policy_number: '',
    });
    const [agree, setAgree] = useState(false);
    const [sigName, setSigName] = useState(guardianName);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

    const submit = async () => {
        const missing = REQUIRED_FIELDS.filter(([k]) => !String(f[k] || '').trim());
        if (missing.length) { setErr('Still needed: ' + missing.map(([, l]) => l).join(', ') + '.'); return; }
        if (!agree) { setErr('Please check the “I agree” box to continue.'); return; }
        if (!sigName.trim()) { setErr('Please type your full legal name to sign.'); return; }
        setBusy(true); setErr('');
        trackEvent('waiver_submit', { player_id: player.id }, { teamId: player.team_id });
        onSigned?.();  // optimistic — mark the checklist done
        try {
            const { error } = await supabase.rpc('sign_waiver', {
                p_player_id: player.id, p_waiver_key: WAIVER_KEY,
                p_signer_name: sigName.trim(), p_relationship: 'Parent/Guardian',
                p_user_agent: (typeof navigator !== 'undefined' ? navigator.userAgent : null),
                p_form_data: f,
            });
            if (error) throw error;
            onClose?.();
        } catch (e) { setErr('Could not save. Please try again.'); setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
            <div className="bg-brand-dark border border-white/10 w-full max-w-lg sm:rounded-2xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-2">
                        <FileSignature className="w-5 h-5 text-brand-green" />
                        <div>
                            <h2 className="text-white font-display font-bold uppercase tracking-wider text-sm">League Waiver</h2>
                            <p className="text-[11px] text-gray-500">IYSA Medical Release & Liability Waiver</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                <div className="overflow-y-auto p-4 space-y-5">
                    <a href="/docs/2026-27-waiver.pdf" target="_blank" rel="noopener noreferrer"
                        onClick={() => trackEvent('waiver_read_doc', { player_id: player.id }, { teamId: player.team_id })}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-green hover:underline">
                        <ExternalLink className="w-3.5 h-3.5" /> Read the full waiver document
                    </a>

                    <div className="rounded-lg border border-red-400/30 bg-red-400/5 px-3 py-2">
                        <p className="text-xs text-gray-300">Fields marked <span className="text-red-400 font-bold">*</span> are <b>required</b> — you can't submit until those are filled in. Everything else is optional.</p>
                    </div>

                    <Section title="Participant">
                        <Field l="Full name" k="participant_name" req f={f} set={set} />
                        <label className="block">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Gender <span className="text-red-400 font-bold">*</span></span>
                            <select value={f.gender} onChange={set('gender')} className={inp}>
                                <option value="" className="bg-gray-800">Select…</option>
                                <option value="Male" className="bg-gray-800">Male</option>
                                <option value="Female" className="bg-gray-800">Female</option>
                                <option value="Other" className="bg-gray-800">Other</option>
                            </select>
                        </label>
                        <Field l="Birthdate" k="birthdate" type="date" req half f={f} set={set} />
                        <Field l="Street address (no PO box)" k="street" req f={f} set={set} />
                        <Field l="City" k="city" req half f={f} set={set} />
                        <Field l="Zip" k="zip" req half f={f} set={set} />
                        <Field l="Participant phone" k="participant_phone" type="tel" half f={f} set={set} />
                        <Field l="Participant email" k="participant_email" type="email" half f={f} set={set} />
                    </Section>

                    <Section title="Parent / Guardian">
                        <Field l="Guardian 1 name" k="g1_name" req f={f} set={set} />
                        <Field l="Primary phone" k="g1_phone" type="tel" req half f={f} set={set} />
                        <Field l="Other phone" k="g1_other" type="tel" half f={f} set={set} />
                        <Field l="Guardian 2 name (optional)" k="g2_name" f={f} set={set} />
                        <Field l="Guardian 2 phone" k="g2_phone" type="tel" half f={f} set={set} />
                        <Field l="Email(s)" k="guardian_emails" f={f} set={set} />
                    </Section>

                    <Section title="Emergency Contact">
                        <Field l="Name" k="ec1_name" req f={f} set={set} />
                        <Field l="Primary phone" k="ec1_phone" type="tel" req half f={f} set={set} />
                        <Field l="Relationship" k="ec1_rel" req half f={f} set={set} />
                        <Field l="Email" k="ec1_email" type="email" f={f} set={set} />
                        <Field l="2nd contact name (optional)" k="ec2_name" f={f} set={set} />
                        <Field l="2nd phone" k="ec2_phone" type="tel" half f={f} set={set} />
                        <Field l="2nd relationship" k="ec2_rel" half f={f} set={set} />
                    </Section>

                    <Section title="Medical & Insurance">
                        <Field l="Allergies" k="allergies" f={f} set={set} />
                        <Field l="Other medical conditions / concerns" k="conditions" f={f} set={set} />
                        <Field l="Physician" k="physician" half f={f} set={set} />
                        <Field l="Physician phone" k="physician_phone" type="tel" half f={f} set={set} />
                        <Field l="Insurance company" k="insurance_company" req f={f} set={set} />
                        <Field l="Insurance phone" k="insurance_phone" type="tel" half f={f} set={set} />
                        <Field l="Policy holder's name" k="policy_holder" req half f={f} set={set} />
                        <Field l="Policy number" k="policy_number" f={f} set={set} />
                    </Section>

                    <div className="space-y-3 pt-1">
                        <label className="flex items-start gap-2.5 text-sm text-gray-200 cursor-pointer">
                            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 w-4 h-4 accent-green-500" />
                            <span>I have read and agree to the <b>Liability Waiver, Medical Release, media consent & Code of Conduct</b> on behalf of {player?.first_name || 'my player'}.</span>
                        </label>
                        <label className="block">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Type your full legal name to sign <span className="text-red-400 font-bold">*</span></span>
                            <input value={sigName} onChange={(e) => setSigName(e.target.value)} className={inp} placeholder="Your full legal name" />
                            <span className="text-[11px] text-gray-500">Signed electronically on {new Date().toLocaleDateString()}.</span>
                        </label>
                    </div>
                </div>

                <div className="p-4 border-t border-white/10 shrink-0">
                    {err && <p className="text-red-400 text-sm mb-2 text-center">{err}</p>}
                    <button onClick={submit} disabled={busy} className="w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wider text-brand-dark bg-brand-green hover:bg-white disabled:opacity-50 flex items-center justify-center gap-2">
                        {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Sign & submit waiver'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WaiverFormModal;
