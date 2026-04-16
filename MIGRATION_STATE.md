# Migration State — pick up here

## Where we are

Migrating from Redis blob sync → Supabase Postgres per-entity rows. Plan in `MIGRATION_PLAN.md`.

Steps 1–5 done (schema, per-entity API, dual-write, one-time migration, read-bridge). Step 5B (client rewrite) in progress. Steps 6–8 not started.

## Recent code changes (uncommitted / recently shipped)

- `api/_lib/dualWrite.js` — bulk upsert + delete-not-in-incoming reconcile (was timing out with sequential upserts).
- `api/sync/teams.js` POST — version check removed, last-write-wins.
- `api/v2.js` — all DELETE handlers now tombstone (`deleted_at = now`, `updated_at = now`) and call `touchCoach()` to bump `coaches.updated_at` so the read-bridge sees Postgres as newer. All GETs and bootstrap filter `deleted_at is null`.
- `api/_lib/pgToBlob.js` — read-bridge filters `deleted_at is null`.
- `supabase/migrations/0002_tombstones.sql` — **USER MUST RUN THIS IN SUPABASE SQL EDITOR BEFORE DEPLOY**. Adds `deleted_at` column + partial indexes to teams, sessions, library_exercises, library_sessions, diagrams.
- `src/hooks/useTeams.js` — added `syncHeaders`, `pgDelete`, `pgPut`, `putTeam`, `putSession` helpers. `createTeam`, `updateTeam`, `deleteTeam`, `createSession`, `updateSession`, `deleteSession` now fire per-entity PUT/DELETE to `/api/v2/teams/:id` and `/api/v2/sessions/:id` alongside local `setTeamsData`.
- `src/hooks/useLibrary.js` — same helpers; `saveExercise`, `deleteExercise`, `saveSession`, `deleteSession`, `importLibrary` fire per-entity PUT/DELETE.
- `src/components/AppShell.jsx` — removed blob push useEffects for teams and library (the old `pushTeams` / `pushLibrary` calls). Pulls still run via the read-bridge.

## Additional change shipped after state was first saved

- `api/sync/teams.js` and `api/sync/library.js`: GET now reads ONLY from Postgres (via `buildTeamsBlob` / `buildLibraryBlob`). No Redis read, no freshness comparison. POST returns 410 Gone. Keeps iOS working on GET; iOS writes will break until iOS is updated (Step 8). Expected to fix the "deleted item reappears" and "team name not saved" bugs — the stale Redis blob is no longer served.

## Active bugs (user-reported, NOT YET FIXED)

### Bug A: deleted teams still reappear immediately
Happens even after tombstone migration + deploy. Possible causes to investigate:
- Has the user run `0002_tombstones.sql` in Supabase? If not, the server `.update({ deleted_at })` writes to a nonexistent column and silently fails, and the old hard-delete branch is gone.
- Is the read-bridge actually being hit? `api/sync/teams.js` GET has a try/catch that falls back to Redis on any error. If `buildTeamsBlob` throws (e.g., on the `.is('deleted_at', null)` filter with missing column), it silently returns Redis's stale blob.
- `loadTeamsFromServer` in `useTeams.js` replaces local teamsData with server data. After delete → push (none, disabled) → next pull returns... still-present item? Verify Redis blob has already been overwritten to match Postgres, OR that read-bridge triggers.
- Browser still running old bundle? Check bundle hash in console errors.

### Bug B: team name changes don't persist
`updateTeam(teamId, updates)` now fires `putTeam(updated)` which PUTs `/api/v2/teams/:id` with `{name, ageGroup, defaultDuration, sharing}`. Possible causes:
- The PUT succeeds but next pull returns Redis's stale blob (same read-bridge concern as Bug A — Redis still has the old name, Postgres has the new one, but `lastUpdatedAt` comparison chooses Redis).
- `touchCoach` is only called on DELETE, not on PUT. So after updateTeam, Postgres has a fresher `teams.updated_at` for this row but `coaches.updated_at` may still be older than Redis's `lastUpdatedAt`. Then in `buildTeamsBlob`, `lastUpdatedAt = max(coach, teams, sessions) → teams row wins → newer than Redis → rebuilds`. Should work... unless Redis `lastUpdatedAt` is even newer (e.g., from a prior blob push that's no longer happening now).

**Likely root cause for both bugs:** Redis still has a stale blob from before the client stopped pushing. Its `lastUpdatedAt` is "now-ish" from the last blob write. Postgres per-entity updates from the new client have `updated_at` that may be *earlier* than Redis's cached `lastUpdatedAt`, so the read-bridge's `isPostgresNewer()` check returns false, and the stale Redis blob is served — resurrecting every deleted/edited thing.

**Fix candidates:**
1. Nuke the Redis blob. After the tombstone migration, run `redis.del('coach:<coachId>')` and `redis.del('library:<coachId>')` for this coach. Next GET has no Redis data → read-bridge returns Postgres fresh.
2. In the read-bridge, make Postgres *always* win when the client is on the new code path (e.g., ignore Redis entirely, or delete Redis blob on successful read-bridge back-write).
3. Stop calling `/api/sync/teams` GET from the client entirely; switch pulls to `/api/v2/coaches/:coachId` bootstrap. Kills Redis from the read path too.

## Sync logic — audit priorities

Key files for the deep audit the user asked for:

- `src/hooks/useSync.js` — still has pushTeams/pullTeams/pushLibrary/pullLibrary/forcePush/mergeTeamsData retry logic. Pushes are no longer *triggered* from AppShell but the code is dead-alive; confirm nothing else calls them.
- `src/hooks/useTeams.js` — verify every setTeamsData mutation has a matching per-entity PUT. Hot spots beyond what we wired:
  - `duplicateSession` — calls `createSession` which now PUTs, OK.
  - Any drag-reorder, sharing toggle, team-defaults update — check they go through `updateTeam`/`updateSession`, not a direct `setTeamsData`.
- `src/hooks/useLibrary.js` — verify `clearExercises`, `clearSessions` also push deletions. Currently they only clear locally.
- `src/components/AppShell.jsx` — still has:
  - BroadcastChannel that fires `loadTeamsFromServer` from another tab (line ~315). Can overwrite fresh local state with a peer's stale copy if tabs are out of sync.
  - Visibility/focus pull + initial auto-pull (lines ~258–309). These call `pullTeams` → read-bridge → `loadTeamsFromServer(result.teams)`. This is the replay path that resurrects stale state when Redis is ahead of Postgres.
  - Share team auto-push + pagehide sendBeacon (lines ~373+). Still uses legacy `/api/share/push`. User hit "Beacon 64KB" errors in console — unrelated to teams/library bugs but worth cleaning up during Step 7.
- `src/utils/helpers.js` — `mergeTeamsData` exists, called from `useSync.pushTeams` 409 retry. Dead under new code (no 409 path) but confirm.
- `api/sync/teams.js` and `api/sync/library.js` — still alive, still called on initial pull. Consider switching pull to `/api/v2/coaches/:coachId` and deleting these.

## Suggested next session plan

1. Verify user ran `0002_tombstones.sql`. Confirm column exists.
2. Decide: nuke Redis blobs for this coach (fastest), OR switch pulls to per-entity bootstrap (cleanest). Recommend #2 — it removes the whole Redis read path for teams/library and eliminates the `isPostgresNewer` freshness guessing game.
3. Replace `useSync.pullTeams`/`pullLibrary` with a `bootstrap()` that calls `GET /api/v2/coaches/:coachId` + `GET /api/v2/library/exercises` + `GET /api/v2/library/sessions` and reassembles a teamsData shape.
4. Remove visibility/focus pull + BroadcastChannel, or rewrite them on top of bootstrap().
5. Delete `api/sync/teams.js`, `api/sync/library.js`, `api/_lib/dualWrite.js`, `api/_lib/pgToBlob.js`. Remove `pushTeams`/`pullTeams`/`pushLibrary`/`pullLibrary` from `useSync.js`. Delete `mergeTeamsData` from `helpers.js`.
6. Re-test delete and update flows.

## Environment / deploy notes

- Vercel Hobby 12-function limit is tight. Consolidated routes under `/api/v2.js` and `/api/share-router.js`. Don't split these back out without checking function count.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MIGRATION_SECRET` live in Vercel envs.
- Coach id for the owner: `c_qUwFYog8YDdiPjwRZ0u8ocLP`.
- Local backup files: `/Users/cgagnon/Desktop/Playball/playball-backup-2026-04-15.json` (older, stale) and `/Users/cgagnon/Desktop/Playball/ppp-library.json` (recovered 1 exercise + 3 sessions from).
- One-time data recovery: `recover-library.mjs` (local Node script, needs SUPABASE env vars).
