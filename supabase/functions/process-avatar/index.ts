// process-avatar — upload a player photo, auto-remove the background, store the
// transparent cutout, and set players.avatar_url. So the FIFA card photo looks
// like a real cutout instead of a rectangle with a background.
//
// Auth: standard JWT (verify_jwt=true). The caller must be STAFF on the
// player's team, a GUARDIAN (family_members), or the PLAYER themselves —
// checked here with the service-role client, so parents/kids can upload too
// without any broad players/storage RLS grant.
//
// Background removal: remove.bg, 'preview' size (free tier, ~0.25MP — more than
// enough for the small card avatar). If REMOVEBG_API_KEY isn't set OR the call
// fails, we gracefully fall back to storing the original image (cutout:false),
// so uploads always work — the cutout just activates once the key is added.
//
// Secret to enable cutouts (set once):
//   supabase secrets set REMOVEBG_API_KEY=... --project-ref bcfemytoburctssnemwn
//
// Request:  { playerId, imageBase64, contentType }   (image already resized client-side)
// Response: { url, cutout }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const REMOVEBG_KEY = Deno.env.get('REMOVEBG_API_KEY') ?? ''

const STAFF_ROLES = ['coach', 'head_coach', 'assistant_coach', 'manager', 'team_manager', 'director', 'admin']

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(',') ? b64.split(',')[1] : b64
  const bin = atob(clean)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function canEditPlayer(admin: any, playerId: string, uid: string): Promise<boolean> {
  // self
  const { data: self } = await admin.from('players').select('id').eq('id', playerId).eq('user_id', uid).maybeSingle()
  if (self) return true
  // guardian
  const { data: guardian } = await admin.from('family_members').select('id').eq('player_id', playerId).eq('user_id', uid).maybeSingle()
  if (guardian) return true
  // staff on a team the player is active on
  const { data: pts } = await admin.from('player_teams').select('team_id').eq('player_id', playerId).eq('status', 'active')
  const teamIds = (pts ?? []).map((r: any) => r.team_id)
  if (teamIds.length === 0) return false
  const { data: tms } = await admin.from('team_memberships').select('id').eq('user_id', uid).in('team_id', teamIds).in('role', STAFF_ROLES)
  return (tms ?? []).length > 0
}

async function removeBg(bytes: Uint8Array, contentType: string): Promise<Uint8Array> {
  const fd = new FormData()
  fd.append('image_file', new Blob([bytes], { type: contentType }), 'photo')
  fd.append('size', 'preview')   // free tier resolution — fine for a card avatar
  fd.append('type', 'person')
  const res = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST', headers: { 'X-Api-Key': REMOVEBG_KEY }, body: fd,
  })
  if (!res.ok) throw new Error(`remove.bg ${res.status}: ${await res.text()}`)
  return new Uint8Array(await res.arrayBuffer())
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json(401, { error: 'missing auth' })
    const token = authHeader.replace('Bearer ', '')

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: { user: caller } } = await userClient.auth.getUser()
    if (!caller) return json(401, { error: 'unauthenticated' })

    const { playerId, imageBase64, contentType } = await req.json()
    if (!playerId || !imageBase64) return json(400, { error: 'missing playerId or image' })

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

    if (!(await canEditPlayer(admin, playerId, caller.id))) {
      return json(403, { error: 'not allowed to edit this player' })
    }

    const inputBytes = base64ToBytes(imageBase64)
    const inType = contentType || 'image/jpeg'

    let outBytes = inputBytes
    let outType = inType
    let cutout = false
    if (REMOVEBG_KEY) {
      try {
        outBytes = await removeBg(inputBytes, inType)
        outType = 'image/png'
        cutout = true
      } catch (e) {
        console.warn('[process-avatar] remove.bg failed, storing original:', (e as any)?.message)
      }
    }

    const ts = Date.now()
    const ext = cutout ? 'png' : (inType === 'image/png' ? 'png' : 'jpg')
    const path = `players/${playerId}/avatar-${ts}.${ext}`

    const { error: upErr } = await admin.storage.from('media').upload(path, outBytes, {
      contentType: outType, cacheControl: '3600', upsert: false,
    })
    if (upErr) return json(500, { error: `upload failed: ${upErr.message}` })

    const { data: pub } = admin.storage.from('media').getPublicUrl(path)
    const publicUrl = `${pub.publicUrl}?v=${ts}`

    const { error: updErr } = await admin.from('players').update({ avatar_url: publicUrl }).eq('id', playerId)
    if (updErr) return json(500, { error: `avatar_url update failed: ${updErr.message}` })

    // NOTE: we intentionally DO NOT delete prior avatars — keeping them lets a
    // photo be reverted and avoids destroying the previous image on every swap.
    // (Files are small; prune very old ones with a retention sweep if ever needed.)

    return json(200, { url: publicUrl, cutout })
  } catch (e) {
    return json(500, { error: (e as any)?.message ?? String(e) })
  }
})
