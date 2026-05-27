# Fire FC Working Passdown - 2026-05-27

Resume from here if the laptop crashes.

## Recently shipped

1. Personal Plan simplification is live.
   - Coach-assigned individual drills now show in Personal Plan.
   - Team-wide work stays in Coach Challenge.
   - Drill cards show the drill description/how-to and a direct `Mark Done`.
2. Parent dashboards now use `My Training` for family-created or player-created drill work.
3. Drill completion refreshes training stats immediately.
4. Team practice credit now runs automatically through a cron sweep.
5. Player photo support was updated for the uploaded cutout assets.

## Saved but not committed before the crash risk

1. `supabase/migrations/20260526_practice_credit_cron.sql`
   - Adds `process_completed_practices_for_all()`
   - Adds a 5-minute cron job so practice credit does not depend on dashboard loads

## Login / onboarding risk

The current login experience is too split:

1. Family/coach email login lives on `Login`.
2. Player login is separate, using PIN or access-link flow.
3. Parent setup still requires linking kids after signup.
4. This is confusing enough that sending it to all families without simplification is risky.

## Next decision to make

Move toward a family-first setup:

1. Parent logs in once.
2. During setup, they select or link one or two kids.
3. Keep player access-link flows only where needed, but stop making parents jump through a separate code-based child-link step if we can avoid it.

## Files to inspect next

- `src/pages/Login.jsx`
- `src/pages/About.jsx`
- `src/context/AuthContext.jsx`
- `src/pages/ParentDashboard.jsx`
- `src/pages/PlayerAccessPage.jsx`
- `supabase/migrations/20260517_join_player_family_also_inserts_team_membership.sql`
- `supabase/migrations/20260513_family_members_profile_capture.sql`
- `supabase/migrations/20260513_players_auto_guardian_code.sql`

## Immediate next test

1. Verify the current Jameson photo on phone after deploy.
2. Audit the parent login/onboarding path before broad release.
3. Decide whether to collapse the family login flow into one guided setup.
