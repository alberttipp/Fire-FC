// Nightly pull of ECNL/TGS data into our cache, powering scouting reports.
// Source: api.athleteone.com (public JSON, no auth). Pulls GAMES (richer + has
// current-season data) from get-schedules-by-flight, and division STANDINGS when
// available. Writes via the service role. Run by pg_cron nightly; also invokable
// with { teamId } to refresh one team on demand.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STANDINGS = 'https://api.athleteone.com/api/Event/get-standings-by-div-and-flight';
const GAMES = 'https://api.athleteone.com/api/Event/get-schedules-by-flight';

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
    const out: Record<string, unknown> = { source: s.id, season: s.season_label };
    try {
      // GAMES (preferred) — have current-season scores even when standings are empty.
      if (s.schedule_group_id) {
        const res = await fetch(`${GAMES}/${s.event_id}/${s.schedule_group_id}/0`, { headers: { accept: 'application/json' } });
        const body = await res.json();
        const games = Array.isArray(body?.data) ? body.data : [];
        for (const g of games) {
          await supabase.from('league_games').upsert({
            source_id: s.id,
            match_id: String(g.matchID ?? ''),
            game_date: g.gameDate ?? null,
            home_team_id: String(g.hometeamID ?? ''), home_team_name: g.homeTeam ?? null, home_score: g.hometeamscore ?? null,
            away_team_id: String(g.awayteamID ?? ''), away_team_name: g.awayTeam ?? null, away_score: g.awayteamscore ?? null,
            status: g.status ?? null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'source_id,match_id' });
        }
        out.games = games.length;
      }

      // STANDINGS (when the division table exists) — teams are nested in teamStandings.
      if (s.div_id && s.flight_id) {
        const res = await fetch(`${STANDINGS}/${s.div_id}/${s.flight_id}/${s.event_id}`, { headers: { accept: 'application/json' } });
        const body = await res.json();
        const rows = Array.isArray(body?.data)
          ? body.data.flatMap((g: any) => Array.isArray(g?.teamStandings) ? g.teamStandings : [])
          : [];
        for (const t of rows) {
          await supabase.from('league_standings').upsert({
            source_id: s.id, external_team_id: String(t.teamID ?? ''),
            team_name: t.name ?? null, club_name: t.clubName ?? null, club_logo: t.clublogo ?? null,
            games_played: t.totalgames ?? null, wins: t.wins ?? null, losses: t.losses ?? null, draws: t.draws ?? null,
            goals_for: t.goalsfor ?? null, goals_against: t.goalsagainst ?? null, goal_diff: t.goaldifferential ?? null,
            points: t.standingpoints ?? null, rank: t.rank ?? null, ppg: t.ppg ?? null, win_pct: t.winpercent ?? null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'source_id,external_team_id' });
        }
        out.standings = rows.length;
      }

      await supabase.from('league_sources')
        .update({ last_pulled_at: new Date().toISOString(), last_error: null }).eq('id', s.id);
    } catch (e) {
      out.error = String(e);
      await supabase.from('league_sources')
        .update({ last_error: String(e), last_pulled_at: new Date().toISOString() }).eq('id', s.id);
    }
    results.push(out);
  }
  return json({ ok: true, results });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}
