// Rock City FC — RSVP alerts to Albert via Resend (verified send.firefcapp.com).
//   mode 'accept' { token, event_id, player_id } -> "<name> is IN for <event>" (real-time, from a DB trigger)
//   mode 'digest' { token }                       -> who-has-and-hasn't for all upcoming events (from pg_cron)
// Gated by a shared token (deployed --no-verify-jwt; the trigger + cron include it).
// Emails go ONLY to RC_ALERT_EMAIL (Albert) — never to families.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
const FROM = Deno.env.get('RESEND_FROM_EMAIL') || 'Rock City FC <noreply@send.firefcapp.com>';
const TO = Deno.env.get('RC_ALERT_EMAIL') || 'alberttipp@gmail.com';
const TOKEN = Deno.env.get('RC_ALERT_TOKEN') || 'rc-rsvp-alerts-2026';

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

async function sendRaw(subject: string, htmlStr: string, textStr: string) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [TO], subject, html: htmlStr, text: textStr }),
  });
  if (r.ok) return { ok: true };
  return { ok: false, status: r.status, body: await r.text().catch(() => '') };
}

const ctTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: 'America/Chicago', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

Deno.serve(async (req) => {
  try {
    if (!RESEND_KEY) return json({ ok: false, error: 'RESEND not configured' }, 503);
    const body = await req.json().catch(() => ({}));
    if (body.token !== TOKEN) return json({ ok: false, error: 'unauthorized' }, 401);
    const supa = createClient(SUPABASE_URL, SERVICE);
    const mode = body.mode;

    if (mode === 'accept') {
      const { event_id, player_id } = body;
      if (!event_id || !player_id) return json({ ok: false, error: 'event_id + player_id required' }, 400);
      const { data: p } = await supa.from('players').select('first_name,last_name').eq('id', player_id).maybeSingle();
      const { data: e } = await supa.from('events').select('title,start_time').eq('id', event_id).maybeSingle();
      if (!p || !e) return json({ ok: false, error: 'player or event not found' }, 404);
      const name = `${p.first_name} ${p.last_name || ''}`.trim();
      const when = ctTime(e.start_time);
      const { count } = await supa.from('event_rsvps').select('id', { count: 'exact', head: true })
        .eq('event_id', event_id).eq('status', 'going');
      const subject = `✅ ${name} is IN — ${e.title}`;
      const htmlStr = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;color:#111827;line-height:1.5">
        <p><b>${name}</b> just marked <b style="color:#15803d">GOING</b> for:</p>
        <p style="font-size:16px;margin:6px 0"><b>${e.title}</b><br><span style="color:#6b7280">${when}</span></p>
        <p style="color:#6b7280">That's <b>${count || 0}</b> confirmed for this game now.</p></div>`;
      const textStr = `${name} marked GOING for ${e.title} (${when}). ${count || 0} confirmed now.`;
      const res = await sendRaw(subject, htmlStr, textStr);
      return json({ ok: res.ok, mode: 'accept', send: res });
    }

    if (mode === 'digest') {
      const { data: rows, error } = await supa.rpc('rc_upcoming_rsvp_status');
      if (error) return json({ ok: false, error: error.message }, 500);
      const events = (rows || []) as Array<Record<string, unknown>>;
      const nowCt = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', weekday: 'short', hour: 'numeric', minute: '2-digit' });
      if (events.length === 0) return json({ ok: true, mode: 'digest', events: 0, sent: false, note: 'no upcoming events' });

      let h = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:620px;color:#111827;line-height:1.5"><h2 style="margin:0 0 2px">Rock City FC — who's in</h2><p style="color:#6b7280;margin:0 0 16px">As of ${nowCt} CT · upcoming games &amp; practices</p>`;
      let t = `Rock City FC — availability (as of ${nowCt} CT)\n\n`;
      for (const ev of events as any[]) {
        h += `<table style="width:100%;border-collapse:collapse;margin:0 0 14px">
          <tr><td style="background:#0f1e3d;color:#fff;padding:8px 12px;font-weight:700">${ev.event} — ${ev.when} <span style="font-weight:400;color:#c9ccd3">(${ev.team})</span></td></tr>
          <tr><td style="padding:8px 12px;background:#f5f6f8">✅ Going: <b>${ev.going}</b> &nbsp;·&nbsp; ❌ Out: ${ev.out} &nbsp;·&nbsp; 🤔 Maybe: ${ev.maybe} &nbsp;·&nbsp; ❓ No response: <b>${ev.no_response}</b></td></tr>`;
        if ((ev.no_response_names || []).length) h += `<tr><td style="padding:8px 12px;color:#b45309;background:#fff">Haven't answered: ${ev.no_response_names.join(', ')}</td></tr>`;
        h += `</table>`;
        t += `${ev.event} — ${ev.when} (${ev.team})\n  Going ${ev.going} / Out ${ev.out} / Maybe ${ev.maybe} / No response ${ev.no_response}\n  Haven't answered: ${(ev.no_response_names || []).join(', ') || '—'}\n\n`;
      }
      h += `</div>`;
      const res = await sendRaw(`Rock City FC — who's in (${nowCt} CT)`, h, t);
      return json({ ok: res.ok, mode: 'digest', events: events.length, send: res });
    }

    return json({ ok: false, error: 'bad mode' }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
