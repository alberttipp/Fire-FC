// Generates a signed-waiver PDF for one player: the league waiver pages +
// an electronic-signature certificate (who signed, when, device). Staff or the
// player's guardian may download it. Returns application/pdf.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const WAIVER_URL = 'https://firefcapp.com/docs/2026-27-waiver.pdf';

// CORS — this function is called from the browser, so it must answer the
// preflight and echo the allowed headers, or the fetch is silently blocked.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const err = (msg: string, status: number) => new Response(msg, { status, headers: CORS });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const authHeader = req.headers.get('Authorization') || '';
    const authClient = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return err('unauthorized', 401);

    const { player_id, waiver_key } = await req.json().catch(() => ({}));
    if (!player_id) return err('player_id required', 400);
    const key = waiver_key || 'isl-indoor-2026-27';
    const svc = createClient(SUPA_URL, SERVICE);

    // authz: staff of a team the player is active on, OR the player's guardian
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
    if (!allowed) return err('forbidden', 403);

    const { data: sig } = await svc.from('waiver_signatures').select('signer_name, relationship, signed_at, user_agent').eq('player_id', player_id).eq('waiver_key', key).maybeSingle();
    if (!sig) return err('no signature on file', 404);
    const { data: pl } = await svc.from('players').select('first_name,last_name,birthdate').eq('id', player_id).maybeSingle();
    let teamName = '';
    if (teamIds.length) { const { data: t } = await svc.from('teams').select('name').eq('id', teamIds[0]).maybeSingle(); teamName = (t as any)?.name || ''; }
    const playerName = `${(pl as any)?.first_name || ''} ${(pl as any)?.last_name || ''}`.trim();
    const dob = (pl as any)?.birthdate || '';

    const out = await PDFDocument.create();
    const font = await out.embedFont(StandardFonts.Helvetica);
    const bold = await out.embedFont(StandardFonts.HelveticaBold);

    // Prepend the actual waiver pages (best-effort).
    try {
      const wres = await fetch(WAIVER_URL);
      if (wres.ok) {
        const src = await PDFDocument.load(new Uint8Array(await wres.arrayBuffer()));
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
      }
    } catch (_) { /* still emit the certificate */ }

    const page = out.addPage([612, 792]);
    let y = 744;
    const line = (t: string, f = font, s = 12, c = rgb(0.1, 0.1, 0.12)) => { page.drawText(t, { x: 56, y, size: s, font: f, color: c }); y -= s + 8; };
    const signedCt = new Date(sig.signed_at).toLocaleString('en-US', { timeZone: 'America/Chicago' });
    line('ROCK CITY FC - ELECTRONIC WAIVER SIGNATURE', bold, 15, rgb(0.04, 0.1, 0.2)); y -= 6;
    line('This certifies the league waiver, medical release & code of conduct was', font, 11);
    line('reviewed and agreed to electronically for the player below.', font, 11); y -= 12;
    line(`Player:          ${playerName}`, bold, 12);
    line(`Date of birth:   ${dob}`, font, 12);
    line(`Team:            ${teamName}`, font, 12);
    line(`Waiver:          ISL Indoor 2026-27`, font, 12); y -= 12;
    line(`Signed by:       ${sig.signer_name}${sig.relationship ? ` (${sig.relationship})` : ''}`, bold, 12);
    line(`Date & time:     ${signedCt} (Central)`, font, 12);
    line('Method:          Electronic signature via firefcapp.com', font, 11);
    if (sig.user_agent) line(`Device:          ${String(sig.user_agent).slice(0, 80)}`, font, 9, rgb(0.4, 0.4, 0.45));
    y -= 18;
    line('The guardian confirmed they read and agreed to the waiver document', font, 9, rgb(0.4, 0.4, 0.45));
    line('included in this PDF. Recorded and stored by Rock City FC.', font, 9, rgb(0.4, 0.4, 0.45));

    const bytes = await out.save();
    const fname = `waiver-${(playerName || 'player').replace(/[^a-z0-9]+/gi, '-')}.pdf`;
    return new Response(bytes, { status: 200, headers: { ...CORS, 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${fname}"` } });
  } catch (e) {
    return err('error: ' + String(e), 500);
  }
});
