// Builds a COMPLETED, signed IYSA waiver PDF for one player from the stored
// form data (all fields) + the league legal text + the electronic signature.
// Staff or the player's guardian may download it. Returns application/pdf.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const errResp = (msg: string, status: number) => new Response(msg, { status, headers: CORS });

const LEGAL: string[] = [
  'LIABILITY WAIVER — In consideration of being allowed to participate in any Illinois Youth Soccer Association (IYSA) program, related events, and activities, I, the undersigned, acknowledge, appreciate, and agree to the following on behalf of myself and the above-listed participant, if the participant is a minor:',
  'The participant will be engaging in programs, activities and/or related events (the "Programs") that involve risk of serious injury, including permanent disability or death, and severe social and economic losses which might result from the participant\'s own actions or the actions, inaction, or negligence of others, the rules of play, or the condition of the premises or equipment. I assume all such risk and accept personal responsibility for the damages following any such injury. I hereby release, discharge, covenant to indemnify and not to sue the IYSA, its directors, officers, employees, coaches, managers, agents, sponsors, contractors, associated personnel and affiliated organizations, and the owners and lessors of premises (the "Releasees") from any and all liability for any claims resulting from the participant\'s involvement in the Programs and transportation to or from them.',
  'I am aware there are risks of exposure to communicable disease, including COVID-19, and I voluntarily assume that risk and accept sole responsibility for any injury, illness, disability or death related to COVID-19 arising from participation. I certify the participant has received a physical examination and is physically capable of participating.',
  'I consent to have an athletic trainer, coach and/or doctor provide the participant with medical assistance and/or treatment and agree to be financially responsible for the cost. I agree to hold harmless and indemnify the Releasees from all liability, loss, cost, claim or damage.',
  'I consent to the Releasees\' use and display of the participant\'s name, likeness, image and biographical information in photographs, recordings and media for promotional and commercial purposes, and I release any claims relating to such use.',
  'I, for the participant and on behalf of the participant\'s heirs and next of kin, HEREBY RELEASE, INDEMNIFY, AND HOLD HARMLESS THE ILLINOIS YOUTH SOCCER ASSOCIATION, its member leagues and clubs, directors, officers, employees, coaches, managers, agents, sponsors, contractors and premises owners from any and all claims, demands, losses and liability arising out of or related to any ILLNESS, INJURY, DISABILITY, OR DEATH, WHETHER ARISING FROM THE NEGLIGENCE OF THE RELEASEES OR OTHERWISE, to the fullest extent permitted by law. I understand this document may not be altered.',
  'I HAVE READ THIS RELEASE OF LIABILITY AND ASSUMPTION OF RISK AGREEMENT, FULLY UNDERSTAND ITS TERMS, UNDERSTAND I HAVE GIVEN UP SUBSTANTIAL RIGHTS BY SIGNING IT, AND SIGN IT FREELY AND VOLUNTARILY.',
  'CODE OF CONDUCT — I agree to set a good example and to create a positive and safe environment free from abuse, harassment, discrimination and bullying. I have read, understand, and agree to abide by the Program/League/Club Code of Conduct, and accept that I and the participant can be removed for improper conduct.',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const authClient = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return errResp('unauthorized', 401);

    const { player_id, waiver_key } = await req.json().catch(() => ({}));
    if (!player_id) return errResp('player_id required', 400);
    const key = waiver_key || 'isl-indoor-2026-27';
    const svc = createClient(SUPA_URL, SERVICE);

    const { data: ptRows } = await svc.from('player_teams').select('team_id').eq('player_id', player_id).eq('status', 'active');
    const teamIds = (ptRows || []).map((r: any) => r.team_id);
    let allowed = false;
    if (teamIds.length) {
      const { data: m } = await svc.from('team_memberships').select('id').eq('user_id', user.id).in('team_id', teamIds).in('role', ['manager', 'coach', 'assistant_coach', 'division_coordinator']).limit(1);
      allowed = (m || []).length > 0;
    }
    if (!allowed) {
      const { data: g } = await svc.from('family_members').select('id').eq('user_id', user.id).eq('player_id', player_id).limit(1);
      allowed = (g || []).length > 0;
    }
    if (!allowed) return errResp('forbidden', 403);

    const { data: sig } = await svc.from('waiver_signatures').select('signer_name, relationship, signed_at, user_agent, form_data').eq('player_id', player_id).eq('waiver_key', key).maybeSingle();
    if (!sig) return errResp('no signature on file', 404);
    const { data: pl } = await svc.from('players').select('first_name,last_name,birthdate').eq('id', player_id).maybeSingle();
    let teamName = '';
    if (teamIds.length) { const { data: t } = await svc.from('teams').select('name').eq('id', teamIds[0]).maybeSingle(); teamName = (t as any)?.name || ''; }
    const d: any = sig.form_data || {};
    const playerName = d.participant_name || `${(pl as any)?.first_name || ''} ${(pl as any)?.last_name || ''}`.trim();

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const M = 50, W = 612, H = 792, MAXW = W - M * 2;
    let page = pdf.addPage([W, H]);
    let y = H - M;
    const space = (n: number) => { if (y - n < M) { page = pdf.addPage([W, H]); y = H - M; } };
    const text = (t: string, size = 10, f = font, color = rgb(0.1, 0.1, 0.12)) => {
      const words = String(t).split(/\s+/); let lineStr = '';
      const flush = () => { if (lineStr) { space(size + 3); page.drawText(lineStr, { x: M, y, size, font: f, color }); y -= size + 3; lineStr = ''; } };
      for (const w of words) {
        const tryStr = lineStr ? lineStr + ' ' + w : w;
        if (f.widthOfTextAtSize(tryStr, size) > MAXW) { flush(); lineStr = w; } else { lineStr = tryStr; }
      }
      flush();
    };
    const row = (label: string, val: any) => { if (val === undefined || val === null || String(val).trim() === '') return; space(15); page.drawText(label, { x: M, y, size: 10, font: bold, color: rgb(0.25, 0.25, 0.3) }); page.drawText(String(val), { x: M + 150, y, size: 10, font, color: rgb(0.05, 0.05, 0.08) }); y -= 15; };
    const heading = (t: string) => { y -= 6; space(16); page.drawText(t, { x: M, y, size: 11, font: bold, color: rgb(0.04, 0.1, 0.2) }); y -= 16; };

    page.drawText('IYSA Emergency Medical Release & Liability Waiver', { x: M, y, size: 15, font: bold, color: rgb(0.04, 0.1, 0.2) }); y -= 20;
    text(`${teamName} · Rock City FC · Winter 2026-27 (ISL Indoor). Completed electronically.`, 9, font, rgb(0.4, 0.4, 0.45)); y -= 4;

    heading('Participant');
    row('Name', playerName); row('Gender', d.gender); row('Birthdate', d.birthdate || (pl as any)?.birthdate);
    row('Street address', d.street); row('City', d.city); row('Zip', d.zip);
    row('Primary phone', d.participant_phone); row('Email', d.participant_email);

    heading('Parent / Guardian');
    row('Guardian 1', d.g1_name); row('  Primary phone', d.g1_phone); row('  Other phone', d.g1_other);
    row('Guardian 2', d.g2_name); row('  Phone', d.g2_phone); row('Email(s)', d.guardian_emails);

    heading('Emergency Contacts');
    row('Contact 1', d.ec1_name); row('  Phone', d.ec1_phone); row('  Relationship', d.ec1_rel); row('  Email', d.ec1_email);
    row('Contact 2', d.ec2_name); row('  Phone', d.ec2_phone); row('  Relationship', d.ec2_rel);

    heading('Medical & Insurance');
    row('Allergies', d.allergies); row('Conditions', d.conditions);
    row('Physician', d.physician); row('  Phone', d.physician_phone);
    row('Insurance company', d.insurance_company); row('  Phone', d.insurance_phone);
    row('Policy holder', d.policy_holder); row('Policy number', d.policy_number);

    heading('Waiver & Code of Conduct');
    for (const p of LEGAL) { text(p, 9); y -= 4; }

    heading('Electronic Signature');
    const signedCt = new Date(sig.signed_at).toLocaleString('en-US', { timeZone: 'America/Chicago' });
    row('Signed by', `${sig.signer_name}${sig.relationship ? ` (${sig.relationship})` : ''}`);
    row('Date & time', `${signedCt} (Central)`);
    row('Method', 'Electronic signature via firefcapp.com');
    if (sig.user_agent) { text(`Device: ${String(sig.user_agent).slice(0, 90)}`, 8, font, rgb(0.5, 0.5, 0.55)); }
    y -= 4; text('By signing, the guardian confirmed they read and agreed to this waiver, medical release, media consent and code of conduct. Recorded and stored by Rock City FC.', 8, font, rgb(0.4, 0.4, 0.45));

    const bytes = await pdf.save();
    const fname = `waiver-${(playerName || 'player').replace(/[^a-z0-9]+/gi, '-')}.pdf`;
    return new Response(bytes, { status: 200, headers: { ...CORS, 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${fname}"` } });
  } catch (e) {
    return errResp('error: ' + String(e), 500);
  }
});
