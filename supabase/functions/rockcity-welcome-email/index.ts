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

async function sendRaw(to: string, subject: string, htmlStr: string, textStr: string) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html: htmlStr, text: textStr }),
  });
  if (r.ok) return { ok: true };
  return { ok: false, status: r.status, body: await r.text().catch(() => '') };
}

async function sendRawAtt(to: string, subject: string, htmlStr: string, textStr: string, attachments: unknown[]) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html: htmlStr, text: textStr, attachments }),
  });
  if (r.ok) return { ok: true };
  return { ok: false, status: r.status, body: await r.text().catch(() => '') };
}

function reminderHtml(player: string, link: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;line-height:1.55">
  <div style="background:#0b1a33;color:#fff;padding:14px 20px;border-radius:12px 12px 0 0;font-weight:800;letter-spacing:1px;font-size:18px;text-transform:uppercase">⚽ Rock City FC — Winter</div>
  <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:20px">
    <p style="background:#fff7e6;border:1px solid #e6cd87;border-radius:8px;padding:10px 12px;margin:0 0 16px;font-weight:700">📱 Questions? Text or call Albert — 847.338.7700.</p>
    <p>Just a quick nudge — <b>${player}</b> is on the Rock City FC winter roster, but we haven't seen you in the team app yet.</p>
    <p>It takes about <b>60 seconds</b> — you'll get the schedule, team chat, your player's card, and can sign the league waiver.</p>
    <p style="text-align:center;margin:22px 0"><a href="${link}" style="background:#e6cd87;color:#0b1a33;font-weight:800;text-decoration:none;padding:13px 24px;border-radius:10px;display:inline-block">Set up ${player}'s app →</a></p>
    <p>Don't want you to miss anything as the season kicks off. Any trouble, just text me: 847.338.7700.</p>
    <p style="font-weight:800;color:#0b1a33;margin-top:16px">Our city. Our club.</p>
    <p style="color:#6b7280">— Albert &amp; the Rock City FC coaches</p>
  </div>
</div>`;
}
function reminderText(player: string, link: string): string {
  return `Questions? Text or call Albert — 847.338.7700.

Just a quick nudge — ${player} is on the Rock City FC winter roster, but we haven't seen you in the team app yet.

It takes about 60 seconds — you'll get the schedule, team chat, your player's card, and can sign the league waiver.

Set up ${player}'s app: ${link}

Any trouble, just text me: 847.338.7700.
— Albert & the Rock City FC coaches`;
}

function checklistHtml(player: string): string {
  const app = 'https://firefcapp.com';
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;line-height:1.55">
  <div style="background:#0b1a33;color:#fff;padding:14px 20px;border-radius:12px 12px 0 0;font-weight:800;letter-spacing:1px;font-size:18px;text-transform:uppercase">⚽ Rock City FC — Winter</div>
  <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:20px">
    <p style="background:#fff7e6;border:1px solid #e6cd87;border-radius:8px;padding:10px 12px;margin:0 0 16px;font-weight:700">📱 Questions or trouble logging in? Text or call Albert — 847.338.7700.</p>
    <p><b>Thank you for signing ${player} up</b> for the Rock City FC winter season — we're fired up to get going!</p>
    <p style="background:#eef6ef;border:1px solid #cfe8cf;border-radius:8px;padding:12px 14px;font-weight:700">🧵 We're ordering uniforms THIS WEEK — please lock in your jersey size &amp; number ASAP so ${player} gets the right kit.</p>
    <p><b>Three quick things to finish in the app:</b></p>
    <ol style="padding-left:18px">
      <li style="margin-bottom:6px"><b>Pick a jersey size &amp; number</b> — on your player's setup checklist.</li>
      <li style="margin-bottom:6px"><b>Sign the league waiver</b> — right from the checklist (takes about 2 minutes).</li>
      <li style="margin-bottom:6px"><b>Pay the $50 deposit</b> — Venmo <b>@Albert-Tipp</b> (put ${player}'s name in the note).</li>
    </ol>
    <p style="text-align:center;margin:22px 0"><a href="${app}" style="background:#e6cd87;color:#0b1a33;font-weight:800;text-decoration:none;padding:13px 24px;border-radius:10px;display:inline-block">Open the app →</a></p>
    <p style="color:#6b7280;font-size:13px">Already done some of these? Perfect — just finish whatever's left. Your checklist is right there when you log in.</p>
    <p style="font-weight:800;color:#0b1a33;margin-top:16px">Our city. Our club.</p>
    <p style="color:#6b7280">— Albert &amp; the Rock City FC coaches</p>
  </div>
</div>`;
}
function checklistText(player: string): string {
  return `Questions or trouble logging in? Text or call Albert — 847.338.7700.

Thank you for signing ${player} up for the Rock City FC winter season!

We're ordering uniforms THIS WEEK — please lock in your jersey size & number ASAP so ${player} gets the right kit.

Three quick things to finish in the app:
1) Pick a jersey size & number (on your player's setup checklist).
2) Sign the league waiver (right from the checklist, ~2 minutes).
3) Pay the $50 deposit — Venmo @Albert-Tipp (put ${player}'s name in the note).

Open the app: https://firefcapp.com

Already done some of these? Great — just finish whatever's left.
Our city. Our club.
— Albert & the Rock City FC coaches`;
}

function practiceHtml(): string {
  const app = 'https://firefcapp.com';
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;line-height:1.55">
  <div style="background:#0b1a33;color:#fff;padding:14px 20px;border-radius:12px 12px 0 0;font-weight:800;letter-spacing:1px;font-size:18px;text-transform:uppercase">⚽ Rock City FC — Winter</div>
  <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:20px">
    <p style="background:#fff7e6;border:1px solid #e6cd87;border-radius:8px;padding:10px 12px;margin:0 0 16px;font-weight:700">📱 Questions? Text or call Albert anytime — 847.338.7700.</p>
    <p>Rock City FC families — it's go time! Our first two sessions are set, and both are now on the <b>team calendar in the app</b>:</p>
    <div style="background:#f3f4f6;border-radius:8px;padding:14px 16px;margin:14px 0">
      <p style="margin:0 0 10px"><b>🗓️ This Thursday (Oct 29): 5:00–6:00 PM</b><br><span style="color:#b91c1c;font-weight:700">⚠️ OUTDOORS</span> — please dress for the weather.</p>
      <p style="margin:0 0 10px"><b>🗓️ Next Thursday (Nov 5): 5:30–7:00 PM</b><br><span style="color:#0b1a33;font-weight:700">🏀 INDOORS on the gym floor</span> — please bring <b>indoor/flat shoes (no cleats)</b>.</p>
      <p style="margin:0">📍 <b>Rock Valley College</b><br>3301 N. Mulford Rd, Rockford, IL 61114 <i>(both sessions)</i></p>
    </div>
    <p>Thursday's is a combined <b>practice + team meeting</b> for both squads — a great chance to meet the coaches and the team before the season.</p>
    <p style="background:#eef6ef;border:1px solid #cfe8cf;border-radius:8px;padding:12px 14px"><b>📲 We're moving to the app as our main way to communicate going forward.</b> Please open the app, find each practice on the calendar, and <b>mark whether you can make it (RSVP) as soon as you know</b> — it really helps the coaches plan. Team chat and all updates will live there too.</p>
    <p><b>A couple of season notes:</b></p>
    <ul>
      <li>I'll send <b>more details later today</b> on what we still need before the season starts. For the <b>U12 International League</b> team, the main item is getting a <b>team appointment for player cards</b> — specifics coming shortly.</li>
      <li>For the <b>U13 Elite League</b> team, I'm still waiting on details from the new league and will share them the moment I have them.</li>
    </ul>
    <p>If you haven't finished your player's checklist (<b>jersey size &amp; number, waiver, deposit</b>), please knock it out this week.</p>
    <p><b>Thank you all so much for your patience</b> getting everything set up — we're going to have a great season. See you Thursday!</p>
    <p style="text-align:center;margin:22px 0"><a href="${app}" style="background:#e6cd87;color:#0b1a33;font-weight:800;text-decoration:none;padding:13px 24px;border-radius:10px;display:inline-block">Open the app &amp; RSVP →</a></p>
    <p style="font-weight:800;color:#0b1a33;margin-top:16px">Our city. Our club.</p>
    <p style="color:#6b7280">— Albert &amp; the Rock City FC coaches</p>
  </div>
</div>`;
}
function practiceText(): string {
  return `Questions? Text or call Albert anytime — 847.338.7700.

Rock City FC families — it's go time! Our first two sessions are set, and both are now on the team calendar in the app:

THIS THURSDAY (Oct 29): 5:00–6:00 PM — OUTDOORS, please dress for the weather.
NEXT THURSDAY (Nov 5): 5:30–7:00 PM — INDOORS on the gym floor, please bring indoor/flat shoes (no cleats).
Location: Rock Valley College, 3301 N. Mulford Rd, Rockford, IL 61114 (both sessions).

Thursday's is a combined practice + team meeting for both squads — come meet the coaches and the team.

We're moving to the app as our main way to communicate going forward. Please open the app, find each practice on the calendar, and mark whether you can make it (RSVP) as soon as you know — it helps the coaches plan. Team chat and all updates live there too.

Season notes:
- More details coming later today. For the U12 International League team, the main item is getting a team appointment for player cards — specifics soon.
- For the U13 Elite League team, I'm still waiting on details from the new league and will share them as soon as I have them.

If you haven't finished your player's checklist (jersey size & number, waiver, deposit), please knock it out this week.

Thank you all for your patience getting everything set up — it's going to be a great season. See you Thursday!

Open the app & RSVP: https://firefcapp.com

Our city. Our club.
— Albert & the Rock City FC coaches`;
}

function tonightHtml(): string {
  const app = 'https://firefcapp.com';
  const map = 'https://firefcapp.com/docs/rvc-campus-map.jpg';
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;line-height:1.55">
  <div style="background:#0b1a33;color:#fff;padding:14px 20px;border-radius:12px 12px 0 0;font-weight:800;letter-spacing:1px;font-size:18px;text-transform:uppercase">⚽ Rock City FC — Winter</div>
  <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:20px">
    <p style="background:#fff7e6;border:1px solid #e6cd87;border-radius:8px;padding:10px 12px;margin:0 0 16px;font-weight:700">📱 Questions? Text or call Albert anytime — 847.338.7700.</p>
    <p>Rock City FC — it's here. <b>First practice is TONIGHT and the season is right around the corner.</b> 🔥</p>
    <div style="background:#fff7e6;border:1px solid #e6cd87;border-radius:8px;padding:12px 14px;margin:14px 0">
      <p style="margin:0 0 6px;font-weight:800">🗓️ TONIGHT — Thursday, Oct 29 · 5:00–6:00 PM · OUTDOORS</p>
      <p style="margin:0">📍 <b>Rock Valley College — 3301 N. Mulford Rd, Rockford, IL 61114</b><br>🅿️ <b>Park in Lot 10</b> (northwest corner, just inside the Mulford Rd entrance) — the <b>athletic fields are right there.</b> Dress for the weather! <i>(Campus map below &amp; attached.)</i></p>
    </div>
    <p style="background:#eef6ef;border:1px solid #cfe8cf;border-radius:8px;padding:12px 14px"><b>👉 Please update your status for tonight in the app</b> — tap the practice on the calendar and mark <b>Going / Can't Make It</b> so the coaches know who to expect. We're moving all communication to the app, so this is the place.</p>
    <p style="font-weight:800;color:#0b1a33;margin:18px 0 6px">📅 The next few weeks</p>
    <ul>
      <li><b>Tonight (10/29):</b> Practice — RVC, outdoors, 5–6 PM</li>
      <li><b>Thu 11/5:</b> Practice — RVC, <b>indoors on the gym floor</b>, 5:30–7:00 PM (bring <b>indoor/flat shoes</b>)</li>
      <li><b>Next week:</b> Getting <b>player cards</b> sorted for everyone on the <b>U12 International</b> team — <b>main roster + backups</b> (more details coming)</li>
      <li>🏆 <b>Sat 11/7: FIRST U12 International GAME!</b></li>
      <li>🏆 <b>Sat 11/14: Elite Tournament</b> (U13)</li>
      <li>🏆 <b>Sat 11/21: Elite League season starts</b> (U13)</li>
    </ul>
    <p style="font-weight:800;color:#0b1a33;margin:18px 0 6px">🥅 Friday-night futsal? Let's talk tonight</p>
    <p>There's a chance to add <b>Raptors Futsal on Friday nights</b> — we'd <b>swap our weekly practice most weekends</b> so the kids can play futsal and rack up extra touches. <b>Come ready to chat tonight</b> and let us know if your player's interested.</p>
    <div style="background:#f3f4f6;border-radius:8px;padding:12px 14px;margin:16px 0">
      <p style="margin:0 0 4px;font-weight:800">💵 Please pay the $150 by Wednesday (Nov 4)</p>
      <p style="margin:0">To lock in league fees + uniform, send the <b>$150</b> balance by <b>next Wednesday</b> — <b>Venmo @Albert-Tipp</b> (player's name in the note).</p>
    </div>
    <div style="background:#f3f4f6;border-radius:8px;padding:12px 14px;margin:16px 0">
      <p style="margin:0 0 4px;font-weight:800">👕 Uniforms order in a few days — update your size NOW</p>
      <p style="margin:0">We're ordering kits <b>this week</b>, so please open the app and <b>confirm your jersey size &amp; number</b> today so your player gets the right fit.</p>
    </div>
    <p style="text-align:center;margin:22px 0"><a href="${app}" style="background:#e6cd87;color:#0b1a33;font-weight:800;text-decoration:none;padding:13px 24px;border-radius:10px;display:inline-block">Open the app — RSVP &amp; update size →</a></p>
    <p>See you tonight at Rock Valley — let's set the tone. 💪</p>
    <p style="font-weight:800;color:#0b1a33;margin:18px 0 6px">📍 Rock Valley College — parking &amp; fields</p>
    <img src="${map}" alt="Rock Valley College campus map — Parking Lot 10 and athletic fields" style="width:100%;max-width:560px;border-radius:10px;border:1px solid #e5e7eb" />
    <p style="color:#6b7280;margin-top:16px">— Albert &amp; the Rock City FC coaches</p>
  </div>
</div>`;
}
function tonightText(): string {
  return `Questions? Text or call Albert anytime — 847.338.7700.

Rock City FC — it's here. First practice is TONIGHT and the season is right around the corner!

TONIGHT — Thursday, Oct 29 — 5:00-6:00 PM — OUTDOORS
Rock Valley College, 3301 N. Mulford Rd, Rockford, IL 61114.
Park in Lot 10 (northwest corner, just inside the Mulford Rd entrance) — the athletic fields are right there. Dress for the weather. (Campus map attached.)

Please update your status for tonight in the app — tap the practice on the calendar and mark Going / Can't Make It. We're moving all communication to the app.

The next few weeks:
- Tonight (10/29): Practice — RVC, outdoors, 5-6 PM
- Thu 11/5: Practice — RVC, indoors on the gym floor, 5:30-7:00 PM (bring indoor/flat shoes)
- Next week: Getting player cards sorted for everyone on the U12 International team — main roster + backups (more details coming)
- Sat 11/7: FIRST U12 International GAME!
- Sat 11/14: Elite Tournament (U13)
- Sat 11/21: Elite League season starts (U13)

Friday-night futsal? Let's talk tonight. There's a chance to add Raptors Futsal on Friday nights — we'd swap our weekly practice most weekends so the kids can play futsal. Come ready to chat tonight and let us know if your player's interested.

Please pay the $150 by Wednesday (Nov 4) — Venmo @Albert-Tipp (player's name in the note).

Uniforms order in a few days — please open the app and confirm your jersey size & number today.

Open the app: https://firefcapp.com

See you tonight at Rock Valley — let's set the tone.
— Albert & the Rock City FC coaches`;
}

function loginHelpHtml(email: string, pw: string, player: string): string {
  const app = 'https://firefcapp.com';
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;line-height:1.55">
  <div style="background:#0b1a33;color:#fff;padding:14px 20px;border-radius:12px 12px 0 0;font-weight:800;letter-spacing:1px;font-size:18px;text-transform:uppercase">⚽ Rock City FC — Winter</div>
  <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:20px">
    <p style="background:#fff7e6;border:1px solid #e6cd87;border-radius:8px;padding:10px 12px;margin:0 0 16px;font-weight:700">📱 Any trouble? Text or call Albert — 847.338.7700.</p>
    <p>Hi! I got your login squared away${player ? ` for <b>${player}</b>` : ''}. Here's how to get into the Rock City FC app:</p>
    <div style="background:#f3f4f6;border-radius:8px;padding:14px 16px;margin:14px 0">
      <p style="margin:0 0 6px">1️⃣ Go to <b><a href="${app}" style="color:#0b1a33">firefcapp.com</a></b></p>
      <p style="margin:0 0 6px">2️⃣ Tap <b>“Log In”</b> (not Sign Up)</p>
      <p style="margin:0 0 6px">3️⃣ Email: <b>${email}</b></p>
      <p style="margin:0">4️⃣ Password: <b>${pw}</b></p>
    </div>
    <p style="background:#eef6ef;border:1px solid #cfe8cf;border-radius:8px;padding:12px 14px"><b>Important:</b> please use the <b>password</b> above to log in. <b>Don't</b> tap “email me a link” or “forgot password” — those aren't working right now and will just say “too many attempts.” The password gets you straight in.</p>
    <p>Once you're in you can see the team roster, schedule (practice tonight!), chat, your player's card, sign the waiver, and RSVP. You can change the password anytime in the app.</p>
    <p style="text-align:center;margin:22px 0"><a href="${app}" style="background:#e6cd87;color:#0b1a33;font-weight:800;text-decoration:none;padding:13px 24px;border-radius:10px;display:inline-block">Open the app →</a></p>
    <p style="color:#6b7280;margin-top:16px">— Albert &amp; the Rock City FC coaches</p>
  </div>
</div>`;
}
function loginHelpText(email: string, pw: string, player: string): string {
  return `Any trouble? Text or call Albert — 847.338.7700.

Hi! I got your login squared away${player ? ` for ${player}` : ''}. Here's how to get into the Rock City FC app:

1) Go to firefcapp.com
2) Tap "Log In" (not Sign Up)
3) Email: ${email}
4) Password: ${pw}

Important: please use the PASSWORD above to log in. Don't tap "email me a link" or "forgot password" — those aren't working right now and will just say "too many attempts." The password gets you straight in.

Once you're in you can see the roster, schedule (practice tonight!), chat, your player's card, sign the waiver, and RSVP. You can change the password anytime in the app.

Open the app: https://firefcapp.com
— Albert & the Rock City FC coaches`;
}

function tournamentHtml(): string {
  const app = 'https://firefcapp.com';
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;line-height:1.55">
  <div style="background:#0b1a33;color:#fff;padding:14px 20px;border-radius:12px 12px 0 0;font-weight:800;letter-spacing:1px;font-size:18px;text-transform:uppercase">⚽ Rock City FC — U13</div>
  <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:20px">
    <p style="background:#fff7e6;border:1px solid #e6cd87;border-radius:8px;padding:10px 12px;margin:0 0 16px;font-weight:700">📱 Questions? Text or call Albert — 847.338.7700.</p>
    <p><b>U13 families — who wants in on a tournament?</b> 🏆</p>
    <p>We're putting together a squad for the tournament at <b>Elite Sports Center on Saturday, Nov 14</b>. A few details:</p>
    <ul>
      <li>📅 <b>All-day event</b> (exact schedule TBD)</li>
      <li>🏟️ <b>Elite Sports Center</b></li>
      <li>🧩 We'll <b>likely enter as a U12</b> team</li>
      <li>💵 <b>Team entry is $390</b> — split among the players who play, so the more kids who join, the lower the cost per player</li>
    </ul>
    <p>We're aiming for about <b>10 players</b>. If your player wants in:</p>
    <p style="background:#eef6ef;border:1px solid #cfe8cf;border-radius:8px;padding:12px 14px;font-weight:700">👉 Open the app → <b>Calendar</b> → <b>“Elite Tournament — who's in?”</b> → tap <b>GOING</b>.</p>
    <p style="text-align:center;margin:22px 0"><a href="${app}" style="background:#e6cd87;color:#0b1a33;font-weight:800;text-decoration:none;padding:13px 24px;border-radius:10px;display:inline-block">Open the app &amp; tap Going →</a></p>
    <p>Please respond soon so we can lock in the roster and register. Thanks!</p>
    <p style="color:#6b7280;margin-top:16px">— Albert &amp; the Rock City FC coaches</p>
  </div>
</div>`;
}
function tournamentText(): string {
  return `Questions? Text or call Albert — 847.338.7700.

U13 families — who wants in on a tournament?

We're putting together a squad for the tournament at Elite Sports Center on Saturday, Nov 14. Details:
- All-day event (exact schedule TBD)
- Elite Sports Center
- We'll likely enter as a U12 team
- Team entry is $390 — split among the players who play, so the more kids who join, the lower the cost per player

We're aiming for about 10 players. If your player wants in:
Open the app -> Calendar -> "Elite Tournament — who's in?" -> tap GOING.

Open the app: https://firefcapp.com

Please respond soon so we can lock in the roster and register. Thanks!
— Albert & the Rock City FC coaches`;
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

    if (mode === 'reminders') {
      if (body.confirm !== 'SEND-REMINDERS') return json({ ok: false, error: 'confirm token required' }, 400);
      const { data: un, error: e2 } = await supa.rpc('list_winter_unsigned_recipients');
      if (e2) return json({ ok: false, error: e2.message }, 500);
      const rows = (un || []) as { first_name: string; guardian_code: string; email: string }[];
      let sent = 0;
      const errors: unknown[] = [];
      for (const r of rows) {
        const link = linkFor(r.guardian_code);
        const res = await sendRaw(r.email, `Rock City FC — a quick nudge to get ${r.first_name} set up`, reminderHtml(r.first_name, link), reminderText(r.first_name, link));
        if (res.ok) sent++;
        else errors.push({ email: r.email, ...res });
        await new Promise((x) => setTimeout(x, 120));
      }
      return json({ ok: true, mode: 'reminders', total: rows.length, sent, errors });
    }

    if (mode === 'checklist') {
      const subject = '⚽ Rock City FC — jersey, waiver & deposit before we order uniforms';
      if (body.test_email) {
        const s = list[0] || { first_name: 'Bo' };
        const res = await sendRaw(body.test_email, '[TEST] ' + subject, checklistHtml(s.first_name), checklistText(s.first_name));
        return json({ ok: res.ok, mode: 'checklist', dry: true, recipients_total: list.length, send: res });
      }
      if (body.confirm !== 'SEND-CHECKLIST') return json({ ok: false, error: 'confirm token required' }, 400);
      let sent = 0;
      const errors: unknown[] = [];
      for (const r of list) {
        const res = await sendRaw(r.email, subject, checklistHtml(r.first_name), checklistText(r.first_name));
        if (res.ok) sent++;
        else errors.push({ email: r.email, ...res });
        await new Promise((x) => setTimeout(x, 120));
      }
      return json({ ok: true, mode: 'checklist', total: list.length, sent, errors });
    }

    if (mode === 'practice') {
      const subject = '⚽ Rock City FC — First Practice Thursday + We\'re Moving to the App';
      if (body.test_email) {
        const res = await sendRaw(body.test_email, '[TEST] ' + subject, practiceHtml(), practiceText());
        return json({ ok: res.ok, mode: 'practice', dry: true, recipients_total: list.length, send: res });
      }
      if (body.confirm !== 'SEND-PRACTICE') return json({ ok: false, error: 'confirm token required' }, 400);
      let sent = 0;
      const errors: unknown[] = [];
      for (const r of list) {
        const res = await sendRaw(r.email, subject, practiceHtml(), practiceText());
        if (res.ok) sent++;
        else errors.push({ email: r.email, ...res });
        await new Promise((x) => setTimeout(x, 120));
      }
      return json({ ok: true, mode: 'practice', total: list.length, sent, errors });
    }

    if (mode === 'tonight') {
      const subject = '⚽ Rock City FC — Practice TONIGHT 🔥 + Games, Cards & Uniforms Ahead';
      // Fetch the campus map once and attach it to every email.
      let attachments: unknown[] = [];
      try {
        const mres = await fetch('https://firefcapp.com/docs/rvc-campus-map.jpg');
        if (mres.ok) {
          const bytes = new Uint8Array(await mres.arrayBuffer());
          let bin = '';
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          attachments = [{ filename: 'RockValleyCollege-Map.jpg', content: btoa(bin) }];
        }
      } catch (_) { /* map optional */ }

      if (body.test_email) {
        const res = await sendRawAtt(body.test_email, '[TEST] ' + subject, tonightHtml(), tonightText(), attachments);
        return json({ ok: res.ok, mode: 'tonight', dry: true, recipients_total: list.length, map_attached: attachments.length > 0, send: res });
      }
      if (body.confirm !== 'SEND-TONIGHT') return json({ ok: false, error: 'confirm token required' }, 400);
      let sent = 0;
      const errors: unknown[] = [];
      for (const r of list) {
        const res = await sendRawAtt(r.email, subject, tonightHtml(), tonightText(), attachments);
        if (res.ok) sent++;
        else errors.push({ email: r.email, ...res });
        await new Promise((x) => setTimeout(x, 150));
      }
      return json({ ok: true, mode: 'tonight', total: list.length, sent, map_attached: attachments.length > 0, errors });
    }

    if (mode === 'tournament') {
      const U13 = '545cc936-ad24-4068-bd55-feaca1640f45';
      const { data: rows, error: e3 } = await supa.rpc('list_team_guardian_emails', { p_team_id: U13 });
      if (e3) return json({ ok: false, error: e3.message }, 500);
      const emails = (rows || []).map((r: { email: string }) => r.email);
      const subject = "⚽ Rock City FC U13 — Who's in for the Nov 14 Tournament?";
      if (body.test_email) {
        const res = await sendRaw(body.test_email, '[TEST] ' + subject, tournamentHtml(), tournamentText());
        return json({ ok: res.ok, mode: 'tournament', dry: true, recipients_total: emails.length, send: res });
      }
      if (body.confirm !== 'SEND-TOURNAMENT') return json({ ok: false, error: 'confirm token required' }, 400);
      let sent = 0;
      const errors: unknown[] = [];
      for (const em of emails) {
        const res = await sendRaw(em, subject, tournamentHtml(), tournamentText());
        if (res.ok) sent++;
        else errors.push({ email: em, ...res });
        await new Promise((x) => setTimeout(x, 150));
      }
      return json({ ok: true, mode: 'tournament', total: emails.length, sent, errors });
    }

    if (mode === 'loginhelp') {
      if (!body.email || !body.password) return json({ ok: false, error: 'email + password required' }, 400);
      const subject = 'Your Rock City FC app login';
      const res = await sendRaw(body.email, subject, loginHelpHtml(body.email, body.password, body.player_first || ''), loginHelpText(body.email, body.password, body.player_first || ''));
      return json({ ok: res.ok, mode: 'loginhelp', email: body.email, send: res });
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
