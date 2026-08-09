// BYGA schedule sync — pulls a program's public BYGA iCal (.ics) feed and mirrors
// its events into our `events` table for the program's team(s). One-way, no
// partnership/API needed. Idempotent: UPSERTS on (team_id, external_uid) so event
// ids are stable across polls (families' RSVPs survive) and reschedules update in
// place. Run by cron (~every few hours) or ad hoc with {programId}.
// DEPLOY WITH --no-verify-jwt. Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

// Wall-clock time in an IANA tz -> correct UTC Date (handles CST/CDT), 2-pass.
function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, tz: string): Date {
  const asUTC = Date.UTC(y, mo - 1, d, h, mi)
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(asUTC))
  const m: Record<string, string> = {}
  for (const x of p) m[x.type] = x.value
  const asTz = Date.UTC(+m.year, +(m.month) - 1, +m.day, +(m.hour % 24), +m.minute, +m.second)
  return new Date(asUTC - (asTz - asUTC))
}

function parseDt(val: string, params: string, calTz: string): string | null {
  // val like 20260806T170000 or 20260806T220000Z
  const m = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/)
  if (!m) return null
  const [, y, mo, d, h, mi, , z] = m
  if (z === 'Z') return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi)).toISOString()
  const tzid = /TZID=([^;:]+)/.exec(params)?.[1] || calTz || 'America/Chicago'
  return zonedToUtc(+y, +mo, +d, +h, +mi, tzid).toISOString()
}

function inferType(summary: string): string {
  const s = summary.toLowerCase()
  if (/^\s*practice\b|training/.test(s)) return 'practice'
  if (/\bgame\b|\bvs\.?\b|scrimmage|match\b/.test(s)) return 'game'
  if (/tournament/.test(s)) return 'tournament'
  if (/tryout/.test(s)) return 'tryout'
  return 'social'
}

function unescape(v: string): string {
  return v.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim()
}

// Parse VEVENTs from unfolded iCal text.
function parseEvents(ics: string, calTz: string) {
  const unfolded = ics.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '') // RFC5545 line unfolding
  const out: Array<{ uid: string; title: string; type: string; start: string; end: string | null; location: string | null; cancelled: boolean }> = []
  for (const block of unfolded.split('BEGIN:VEVENT').slice(1)) {
    const body = block.split('END:VEVENT')[0]
    const get = (prop: string) => {
      const re = new RegExp(`^${prop}([^:\\n]*):(.*)$`, 'm')
      const mm = re.exec(body)
      return mm ? { params: mm[1] || '', value: mm[2] || '' } : null
    }
    const uid = get('UID')?.value?.trim()
    const dtstart = get('DTSTART')
    const summary = get('SUMMARY')
    if (!uid || !dtstart) continue
    const start = parseDt(dtstart.value.trim(), dtstart.params, calTz)
    if (!start) continue
    const dtend = get('DTEND')
    out.push({
      uid,
      title: unescape(summary?.value || 'Event').slice(0, 200) || 'Event',
      type: inferType(summary?.value || ''),
      start,
      end: dtend ? parseDt(dtend.value.trim(), dtend.params, calTz) : null,
      location: get('LOCATION') ? unescape(get('LOCATION')!.value).slice(0, 200) || null : null,
      cancelled: /^STATUS:CANCELLED$/m.test(body),
    })
  }
  return out
}

async function syncProgram(prog: { id: string; byga_ical_url: string; owner_user_id: string | null }) {
  const res = await fetch(prog.byga_ical_url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`feed ${res.status}`)
  const ics = await res.text()
  const calTz = /X-WR-TIMEZONE:(.+)/.exec(ics)?.[1]?.trim() || 'America/Chicago'
  const events = parseEvents(ics, calTz)

  const { data: teams } = await admin.from('teams').select('id, org_id').eq('program_id', prog.id)
  let upserts = 0
  for (const t of teams || []) {
    for (const e of events) {
      if (e.cancelled) {
        await admin.from('events').delete().eq('team_id', t.id).eq('external_uid', e.uid)
        continue
      }
      const { data: existing } = await admin.from('events')
        .select('id').eq('team_id', t.id).eq('external_uid', e.uid).maybeSingle()
      const row = {
        team_id: t.id, org_id: t.org_id, title: e.title, type: e.type,
        start_time: e.start, location_name: e.location,
        external_uid: e.uid, external_source: 'byga', created_by: prog.owner_user_id,
      }
      if (existing) await admin.from('events').update(row).eq('id', existing.id)
      else await admin.from('events').insert(row)
      upserts++
    }
  }
  return { program: prog.id, teams: (teams || []).length, events: events.length, upserts }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json().catch(() => ({}))
    let q = admin.from('programs').select('id, byga_ical_url, owner_user_id').not('byga_ical_url', 'is', null)
    if (body?.programId) q = q.eq('id', body.programId)
    const { data: progs } = await q
    const results = []
    for (const p of progs || []) {
      try { results.push(await syncProgram(p as any)) }
      catch (e) { results.push({ program: (p as any).id, error: (e as Error).message }) }
    }
    return new Response(JSON.stringify({ ok: true, synced: results }), {
      headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('[byga-ical-sync]', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
