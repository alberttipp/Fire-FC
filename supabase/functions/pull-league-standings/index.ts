// Nightly pull of ECNL/TGS division standings into our cache (league_standings),
// powering the in-app standings + scouting reports. Source: api.athleteone.com
// (public JSON, no auth). Writes via the service role. Run by pg_cron nightly;
// also invokable with { teamId } to refresh one team on demand.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STANDINGS = 'https://api.athleteone.com/api/Event/get-standings-by-div-and-flight';

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let teamId: string | null = null;
  try { const b = await req.json(); teamId = b?.teamId ?? null; } catch { /* no body */ }

  let q = supabase.from('league_sources').select('*');
  if (teamId) q = q.eq('team_id', teamId);
  const { data: sources, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const results: unknown[] = [];
  for (const s of sources ?? []) {
    try {
      const url = `${STANDINGS}/${s.div_id}/${s.flight_id}/${s.event_id}`;
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      const body = await res.json();
      // data is an array of flight groups; the team rows live in group.teamStandings.
      const rows = Array.isArray(body?.data)
        ? body.data.flatMap((g: any) => Array.isArray(g?.teamStandings) ? g.teamStandings : [])
        : [];
      let upserted = 0;
      for (const t of rows) {
        const { error: ue } = await supabase.from('league_standings').upsert({
          source_id: s.id,
          external_team_id: String(t.teamID ?? ''),
          team_name: t.name ?? null,
          club_name: t.clubName ?? null,
          club_logo: t.clublogo ?? null,
          games_played: t.totalgames ?? null,
          wins: t.wins ?? null, losses: t.losses ?? null, draws: t.draws ?? null,
          goals_for: t.goalsfor ?? null, goals_against: t.goalsagainst ?? null,
          goal_diff: t.goaldifferential ?? null,
          points: t.standingpoints ?? null, rank: t.rank ?? null,
          ppg: t.ppg ?? null, win_pct: t.winpercent ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'source_id,external_team_id' });
        if (!ue) upserted++;
      }
      await supabase.from('league_sources')
        .update({ last_pulled_at: new Date().toISOString(), last_error: null }).eq('id', s.id);
      results.push({ source: s.id, season: s.season_label, teams: rows.length, upserted });
    } catch (e) {
      await supabase.from('league_sources')
        .update({ last_error: String(e), last_pulled_at: new Date().toISOString() }).eq('id', s.id);
      results.push({ source: s.id, error: String(e) });
    }
  }
  return json({ ok: true, results });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}
