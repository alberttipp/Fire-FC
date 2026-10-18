// Alerts Albert (email + optional SMS-gateway) when a family links to a winter
// player. Fired by the trg_notify_family_link DB trigger via pg_net.
const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
const FROM = Deno.env.get('RESEND_FROM_EMAIL') || 'Rock City FC <noreply@send.firefcapp.com>';
const TO = Deno.env.get('WINTER_NOTIFY_EMAIL') || 'alberttipp@gmail.com';

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  try {
    if (!RESEND_KEY) return json({ ok: false, error: 'RESEND not configured' }, 503);
    const b = await req.json().catch(() => ({}));
    const guardian = (b.guardian || 'A parent').toString();
    const player = (b.player || 'a player').toString();
    const team = (b.team || '').toString();
    // extra recipients (e.g. an email-to-SMS gateway) passed by the trigger
    const also = Array.isArray(b.also) ? b.also : (b.also ? [b.also] : []);
    const to = [TO, ...also].filter(Boolean);

    const subject = `✅ New Rock City signup: ${player}${team ? ` (${team})` : ''}`;
    const line = `${guardian} just signed up and linked to ${player}${team ? ` (${team})` : ''} in the Rock City app.`;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, text: line, html: `<p>${line}</p>` }),
    });
    if (!r.ok) return json({ ok: false, status: r.status, body: await r.text().catch(() => '') }, 502);
    return json({ ok: true, to });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
