// Rock City FC — winter welcome email blast via Resend (verified send.firefcapp.com).
// One personalized email per guardian of a winter-team player (U13/U12), covering
// both parents where linked. Server-side recipient list (list_winter_welcome_recipients).
//
// modes:
//   { mode: 'dry', test_email }                     -> sends ONE sample to test_email
//   { mode: 'live', confirm: 'SEND-WINTER-WELCOME' } -> sends to every guardian
//
// Anti-abuse: only ever emails guardians the DB returns for the winter roster.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
const FROM = Deno.env.get('RESEND_FROM_EMAIL') || 'Rock City FC <noreply@send.firefcapp.com>';
const SUBJECT = "⚽ Rock City FC Winter — you're IN. Here's the plan + your team app";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

function html(player: string, link: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;line-height:1.55">
  <div style="background:#0b1a33;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;font-weight:800;letter-spacing:1px;font-size:18px;text-transform:uppercase">⚽ Rock City FC — Winter</div>
  <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:20px">
    <p style="background:#fff7e6;border:1px solid #e6cd87;border-radius:8px;padding:10px 12px;margin:0 0 16px;font-weight:700">📱 Text or call Albert with any questions at all — 847.338.7700.</p>
    <p>${player}, welcome to the Rock City FC winter season — this one's going to be special.</p>
    <p><b>Here's the plan.</b> This winter our club steps up and competes in <b>TWO leagues</b> — real games, real development, all winter long:</p>
    <ul>
      <li>🏟️ <b>U13 Squad</b> — the brand-new league at <b>Elite Sports Center</b>, coached by <b>Jeremy Gunderson</b>.</li>
      <li>🌍 <b>U12 Squad</b> — the <b>International League</b>, coached by <b>Kevan Watkins</b>.</li>
      <li>📍 <b>Practices: TBD</b> — we'll post them in the app the moment they're locked in.</li>
    </ul>
    <p>The coaches and Albert will answer all questions ASAP.</p>
    <p style="text-align:center;margin:22px 0"><a href="${link}" style="background:#e6cd87;color:#0b1a33;font-weight:800;text-decoration:none;padding:13px 24px;border-radius:10px;display:inline-block">Set up your team app →</a></p>
    <p>Tap the button and you're in the app. When you log in you'll be able to <b>see your team's full roster</b> — plus the full schedule, team chat, your player's FIFA-style card, and a one-tap waiver to sign.</p>
    <div style="background:#f3f4f6;border-radius:8px;padding:12px 14px;margin:16px 0">
      <p style="margin:0 0 6px"><b>💵 Initial fees — about $200 to get started:</b></p>
      <p style="margin:0">• <b>$50 now</b> to secure your player's spot — <b>Venmo @Albert-Tipp</b> (put your player's name in the note).<br>• <b>$150 over the next couple of weeks</b> to finish covering the <b>league fees and uniform</b>.</p>
    </div>
    <p style="background:#eef6ef;border:1px solid #cfe8cf;border-radius:8px;padding:12px 14px"><b>Want to play both?</b> A few players will be <b>dual-rostered on BOTH squads</b>. If your player would like to, <b>reach out to me directly</b> — there's a <b>limited number</b> of spots, and it's <b>a little more</b> to cover the second league's initial fee.</p>
    <p><b>Questions? I'm sure you've got plenty —</b> drop them in your <b>team chat</b> in the app, or <b>text/call me: 847.338.7700</b>. We'll keep a <b>running FAQ</b> going so every family stays in the loop.</p>
    <p style="font-weight:800;color:#0b1a33;margin-top:18px">Let's go. Our city. Our club.</p>
    <p style="color:#6b7280">— Albert &amp; the Rock City FC coaches</p>
  </div>
</div>`;
}

function text(player: string, link: string): string {
  return `Text or call Albert with any questions at all — 847.338.7700.

${player}, welcome to the Rock City FC winter season — this one's going to be special.

Here's the plan. This winter our club competes in TWO leagues:
- U13 Squad — the brand-new league at Elite Sports Center, coached by Jeremy Gunderson.
- U12 Squad — the International League, coached by Kevan Watkins.
- Practices: TBD — posted in the app once locked in.

The coaches and Albert will answer all questions ASAP.

Set up your team app: ${link}
Log in to see your team's full roster, the schedule, team chat, your player's card, and sign the waiver.

Initial fees — about $200 to get started:
- $50 now to secure the spot — Venmo @Albert-Tipp (player's name in the note).
- $150 over the next couple of weeks for league fees + uniform.

Want to play both? A few players will be dual-rostered on BOTH squads (limited spots, a little more to cover the second league's initial fee) — reach out to me.

Questions? Team chat in the app, or text/call me: 847.338.7700.

Let's go. Our city. Our club.
— Albert & the Rock City FC coaches`;
}

async function send(to: string, subject: string, player: string, link: string) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html: html(player, link), text: text(player, link) }),
  });
  if (r.ok) return { ok: true };
  return { ok: false, status: r.status, body: await r.text().catch(() => '') };
}

const linkFor = (code: string) => `https://firefcapp.com/login?join=${code}`;

Deno.serve(async (req) => {
  try {
    if (!RESEND_KEY) return json({ ok: false, error: 'RESEND not configured' }, 503);
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'dry';
    const supa = createClient(SUPABASE_URL, SERVICE);
    const { data: recips, error } = await supa.rpc('list_winter_welcome_recipients');
    if (error) return json({ ok: false, error: error.message }, 500);
    const list = (recips || []) as { first_name: string; guardian_code: string; email: string }[];

    if (mode === 'dry') {
      if (!body.test_email) return json({ ok: false, error: 'test_email required' }, 400);
      const s = list[0] || { first_name: 'Bo', guardian_code: '92E943' };
      const res = await send(body.test_email, '[TEST] ' + SUBJECT, s.first_name, linkFor(s.guardian_code));
      return json({ ok: res.ok, mode: 'dry', recipients_total: list.length, send: res });
    }

    if (mode === 'live') {
      if (body.confirm !== 'SEND-WINTER-WELCOME') return json({ ok: false, error: 'confirm token required' }, 400);
      let sent = 0;
      const errors: unknown[] = [];
      for (const r of list) {
        const res = await send(r.email, SUBJECT, r.first_name, linkFor(r.guardian_code));
        if (res.ok) sent++;
        else errors.push({ email: r.email, ...res });
        await new Promise((x) => setTimeout(x, 120)); // gentle pacing
      }
      return json({ ok: true, mode: 'live', total: list.length, sent, errors });
    }

    if (mode === 'single') {
      if (!body.email || !body.guardian_code) return json({ ok: false, error: 'email + guardian_code required' }, 400);
      const res = await send(body.email, SUBJECT, body.player_first || 'your player', linkFor(body.guardian_code));
      return json({ ok: res.ok, mode: 'single', email: body.email, send: res });
    }

    return json({ ok: false, error: 'bad mode' }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
