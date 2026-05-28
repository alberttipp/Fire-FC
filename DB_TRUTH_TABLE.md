# Fire FC — Parent/Player Data Truth Table

Canonical reference for where parent/player data lives. Hand this to any
human or AI working on onboarding/auth so there's no reinterpretation.
Verified against live prod 2026-05-28.

## Source-of-truth order (do not drift)

| # | Table | Owns | Notes |
|---|---|---|---|
| 1 | `auth.users` | login identity | email, password, `raw_user_meta_data.role`* |
| 2 | `profiles` | contact/display | `full_name`, `email`, `phone`, quiet-hours. **NO `role`, NO `team_id` columns.** |
| 3 | `family_members` | parent→child link | `user_id → player_id`, `relationship` (category), `relationship_label` (Mom/Dad/…), `full_name`, `phone`. **SOURCE OF TRUTH for "is this parent linked to this kid".** |
| 4 | `team_memberships` | team access + role | `user_id → team_id`, `role`. **SOURCE OF TRUTH for role** (parent/coach/manager). |
| 5 | `players` | the child account | `id`, `display_name`, `first_name`, `last_name`, `team_id`, `guardian_code`, `user_id` (=kid login) |
| 6 | `player_guardians` | **LEGACY — do not rely on** | 0 rows in practice. Not written by current flow. One `messages` RLS policy still references it (latent, grants nothing today). |

\* `metadata.role` is used ONLY for first-login dashboard routing. The
authoritative role is `team_memberships.role`.

## Rules

- **Do not infer role from `profiles`** — it has no role column. Read `team_memberships.role`.
- **Do not infer child linkage from `team_memberships` alone** — team membership only means "on the team." The parent→child link is `family_members`.
- **Never delete:** `auth.users`, `players`, coach/manager `team_memberships`, `teams`.
- **A stale parent link** = an incorrect `family_members` row + its matching `parent`/`fan` `team_memberships` row. Remove only those, only when clearly wrong, and only after reporting the exact rows first.

## What onboarding actually writes

```
Signup (Login.jsx)
  → auth.users (email/password + metadata.role='parent')
  → profiles (full_name, email)         [via trigger]

Family setup (GuardianCodeEntry.jsx):
  Parent flow (no code typing):
    1. profile step — relationship (Mom/Dad/…), full_name, phone
    2. children step — PICK your kid(s) from the team roster
       (roster loaded via get_public_team_roster_invites; each row
        carries the kid's guardian_code, used internally)
    → for each picked kid: join_player_family RPC
       → family_members (user_id→player_id, relationship='guardian',
                         relationship_label='Dad'/'Mom'/…, full_name, phone)
       → team_memberships (user_id→team_id, role='parent')
  Manual-code path = fallback only (kid not on the public roster).

player_guardians  → NOT written. Legacy.
```

## Golden-path shape (verified on Juan Grajales → Esteban, 2026-05-28)

```
1 auth.users(parent)
  → 1 profiles
  → 1 family_members(relationship=guardian, relationship_label=Dad, player_id=X)
  → 1 team_memberships(role=parent, team_id=T)
  → players(id=X, team_id=T)        # kid on the SAME team
  → 0 player_guardians
All foreign keys line up:
  family_members.player_id == players.id
  players.team_id == team_memberships.team_id
```

## Known issues / cleanup backlog

1. **`full_name` lives in 3 places** (auth metadata, `profiles.full_name`,
   `family_members.full_name`) — can drift. Signup name should pre-fill the
   guardian-entry name to avoid double entry.
2. **`player_guardians` is dead but load-bearing** — the messages RLS policy
   "Guardians can view player DM messages" references it. Either wire the flow
   to write it, or rewrite that policy against `family_members`. Latent, not
   breaking today.
3. **Chat sender name** — parents now send as "{Kid}'s {Dad/Mom}" (2026-05-28)
   composed from `family_members.relationship_label` + linked player first
   name, so it's obvious who's talking in chat.
