// Fills the ACTUAL IYSA waiver form (the official 2-page PDF) with the player's
// completed data + electronic signature, overlaid on each blank. Staff or the
// player's guardian may download it. Returns application/pdf.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const WAIVER_URL = 'https://firefcapp.com/docs/2026-27-waiver.pdf';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const errResp = (msg: string, status: number) => new Response(msg, { status, headers: CORS });

// {page, x, y} overlay positions computed from the official form's text layout.
const COORDS: Record<string, { p: number; x: number; y: number }> = {
  participant_name: { p: 1, x: 55, y: 630 }, gender: { p: 1, x: 350, y: 630 }, birthdate: { p: 1, x: 462, y: 630 },
  street: { p: 1, x: 113, y: 607 }, city: { p: 1, x: 319, y: 607 }, zip: { p: 1, x: 489, y: 607 },
  participant_phone: { p: 1, x: 67, y: 583 }, participant_email: { p: 1, x: 216, y: 583 },
  g1_name: { p: 1, x: 94, y: 540 }, g1_phone: { p: 1, x: 359, y: 540 }, g1_other: { p: 1, x: 511, y: 540 },
  g2_name: { p: 1, x: 94, y: 526 }, g2_phone: { p: 1, x: 359, y: 526 },
  guardian_emails: { p: 1, x: 48, y: 511 },
  ec1_name: { p: 1, x: 60, y: 478 }, ec1_phone: { p: 1, x: 516, y: 478 }, ec1_rel: { p: 1, x: 121, y: 464 }, ec1_email: { p: 1, x: 298, y: 464 },
  ec2_name: { p: 1, x: 69, y: 447 }, ec2_phone: { p: 1, x: 516, y: 447 }, ec2_rel: { p: 1, x: 123, y: 432 },
  allergies: { p: 1, x: 8, y: 418 }, conditions: { p: 1, x: 189, y: 401 },
  physician: { p: 1, x: 47, y: 386 }, physician_phone: { p: 1, x: 362, y: 386 },
  insurance_company: { p: 1, x: 153, y: 372 }, insurance_phone: { p: 1, x: 470, y: 372 },
  policy_holder: { p: 1, x: 94, y: 356 }, policy_number: { p: 1, x: 408, y: 356 },
  sig_name: { p: 2, x: 202, y: 325 }, sig_date: { p: 2, x: 28, y: 314 },
};

const fmtDate = (s: any): string => {
  if (!s) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? String(s) : d.toLocaleDateString('en-US', { timeZone: 'America/Chicago' });
};

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

    const { data: sig } = await svc.from('waiver_signatures').select('signer_name, signed_at, form_data').eq('player_id', player_id).eq('waiver_key', key).maybeSingle();
    if (!sig) return errResp('no signature on file', 404);
    const { data: pl } = await svc.from('players').select('first_name,last_name,birthdate').eq('id', player_id).maybeSingle();
    const d: any = sig.form_data || {};
    const playerName = d.participant_name || `${(pl as any)?.first_name || ''} ${(pl as any)?.last_name || ''}`.trim();

    const vals: Record<string, string> = {
      participant_name: d.participant_name || playerName,
      gender: d.gender || '', birthdate: fmtDate(d.birthdate || (pl as any)?.birthdate),
      street: d.street || '', city: d.city || '', zip: d.zip || '',
      participant_phone: d.participant_phone || '', participant_email: d.participant_email || '',
      g1_name: d.g1_name || '', g1_phone: d.g1_phone || '', g1_other: d.g1_other || '',
      g2_name: d.g2_name || '', g2_phone: d.g2_phone || '', guardian_emails: d.guardian_emails || '',
      ec1_name: d.ec1_name || '', ec1_phone: d.ec1_phone || '', ec1_rel: d.ec1_rel || '', ec1_email: d.ec1_email || '',
      ec2_name: d.ec2_name || '', ec2_phone: d.ec2_phone || '', ec2_rel: d.ec2_rel || '',
      allergies: d.allergies || '', conditions: d.conditions || '',
      physician: d.physician || '', physician_phone: d.physician_phone || '',
      insurance_company: d.insurance_company || '', insurance_phone: d.insurance_phone || '',
      policy_holder: d.policy_holder || '', policy_number: d.policy_number || '',
      sig_name: sig.signer_name || '',
      sig_date: new Date(sig.signed_at).toLocaleDateString('en-US', { timeZone: 'America/Chicago' }),
    };

    const wres = await fetch(WAIVER_URL);
    if (!wres.ok) return errResp('could not load waiver template', 502);
    const pdf = await PDFDocument.load(new Uint8Array(await wres.arrayBuffer()));
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const ink = rgb(0.06, 0.1, 0.42);
    const pages = pdf.getPages();
    for (const [k, c] of Object.entries(COORDS)) {
      const v = vals[k];
      if (!v || !String(v).trim()) continue;
      const pg = pages[c.p - 1];
      if (!pg) continue;
      // shrink if the value is long so it stays within the blank
      const size = String(v).length > 34 ? 7 : 8.5;
      pg.drawText(String(v), { x: c.x, y: c.y, size, font, color: ink });
    }

    const bytes = await pdf.save();
    const fname = `IYSA-waiver-${(playerName || 'player').replace(/[^a-z0-9]+/gi, '-')}.pdf`;
    return new Response(bytes, { status: 200, headers: { ...CORS, 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${fname}"` } });
  } catch (e) {
    return errResp('error: ' + String(e), 500);
  }
});
