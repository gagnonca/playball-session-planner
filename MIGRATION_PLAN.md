# Migration plan: Redis JSON blob → Supabase (Postgres) with per-entity rows

## Why this change

Today the web app stores one giant JSON blob per coach in Upstash Redis:

- `coach:{coachId}` → `{ teams: { teams: [...], version, defaultTeamId }, devices, lastUpdatedAt }`
- `library:{coachId}` → `{ library: { exercises, sessions }, ... }`
- `team-share:{CODE}` → `{ team: {...} }`

Every write rewrites the full blob. This causes all the complexity we've been layering on: version numbers, conflict detection, merge-and-retry, cross-tab broadcast guards, pagehide flushes, timeouts that lose writes on tab close. Concurrent edits to unrelated data still conflict because they share the blob.

With per-entity rows in Postgres, tab A saving session X and tab B saving session Y don't conflict. Deletes are real deletes. Multi-device becomes trivially correct. Almost every workaround in `useSync.js` and `AppShell.jsx` goes away.

## Target stack

- **Supabase (hosted Postgres)** — best Vercel DX, free tier generous, Row Level Security available if we ever add auth, REST + client libs, SQL editor, automatic backups.
- **`@supabase/supabase-js`** on both server (API routes) and, if later desired, client. For this migration we only call it from server routes — keeps the client thin.
- **Vercel Blob stays.** Images already live on CDN; don't touch them.
- **Upstash Redis stays only for pairing codes** (short-TTL throwaway data). Everything else leaves Redis.

## Schema

All tables keyed by the coach's stable `coach_id` so existing identities carry over. No user accounts needed; `coach_id` is the tenant.

```sql
-- Each coach. devices is a JSONB array of linked deviceIds.
create table coaches (
  coach_id          text primary key,
  devices           jsonb not null default '[]'::jsonb,
  default_team_id   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table teams (
  id                text primary key,
  coach_id          text not null references coaches(coach_id) on delete cascade,
  name              text not null,
  age_group         text,
  default_duration  text,
  sharing           jsonb not null default '{"isShared":false}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index teams_coach_idx on teams (coach_id);
create index teams_share_token_idx on teams ((sharing->>'shareToken'))
  where sharing->>'shareToken' is not null;

create table sessions (
  id                text primary key,
  team_id           text not null references teams(id) on delete cascade,
  coach_id          text not null,                -- denormalized for query perf
  summary           jsonb not null,               -- title, date, duration, ageGroup, moment, etc.
  sections          jsonb not null default '[]'::jsonb,  -- array of full section objects
  is_template       boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index sessions_team_idx on sessions (team_id);
create index sessions_coach_idx on sessions (coach_id);

create table library_exercises (
  id                text primary key,
  coach_id          text not null references coaches(coach_id) on delete cascade,
  name              text not null,
  type              text,
  tags              jsonb not null default '{}'::jsonb,
  payload           jsonb not null,
  updated_at        timestamptz not null default now()
);
create index library_exercises_coach_idx on library_exercises (coach_id);

create table library_sessions (
  id                text primary key,
  coach_id          text not null references coaches(coach_id) on delete cascade,
  name              text not null,
  tags              jsonb not null default '{}'::jsonb,
  payload           jsonb not null,
  updated_at        timestamptz not null default now()
);
create index library_sessions_coach_idx on library_sessions (coach_id);

create table library_hidden (
  coach_id          text not null references coaches(coach_id) on delete cascade,
  entity_kind       text not null,   -- 'exercise' | 'session'
  entity_id         text not null,
  primary key (coach_id, entity_kind, entity_id)
);

create table diagrams (
  id                text primary key,
  coach_id          text not null references coaches(coach_id) on delete cascade,
  name              text,
  payload           jsonb not null,
  updated_at        timestamptz not null default now()
);
create index diagrams_coach_idx on diagrams (coach_id);
```

**Decision: sessions keep `sections` as JSONB rather than splitting into its own table.**
A session's sections are always loaded and saved together in the UI. Making them their own table adds joins and doesn't help concurrency — two users don't edit the same session's sections from different tabs in practice. If we ever hit that case we can split later.

## New API surface

Replace blob endpoints with per-entity REST. All endpoints require `coachId` + `deviceId` headers for auth (unchanged from today). Each endpoint is tiny — no merge logic, no version numbers.

```
GET    /api/coaches/:coachId                → { coach, teams, sessions } (bootstrap)
POST   /api/coaches                          → create coach identity (replaces /api/sync/init)

GET    /api/teams?coachId=…                  → list of teams (for a coach)
PUT    /api/teams/:id                        → upsert single team
DELETE /api/teams/:id

GET    /api/sessions?teamId=…                → list for a team
PUT    /api/sessions/:id                     → upsert single session
DELETE /api/sessions/:id

GET    /api/library/exercises?coachId=…      → list
PUT    /api/library/exercises/:id            → upsert
DELETE /api/library/exercises/:id

GET    /api/library/sessions?coachId=…       → list
PUT    /api/library/sessions/:id             → upsert
DELETE /api/library/sessions/:id

POST   /api/library/hidden                   → { coachId, kind, id }  (add)
DELETE /api/library/hidden/:kind/:id         → remove

GET    /api/diagrams?coachId=…
PUT    /api/diagrams/:id
DELETE /api/diagrams/:id

GET    /api/share/:code                      → { team, sessions }  (reads via teams.sharing->>'shareToken')
# writes no longer needed — shared views read live from Postgres by token.
# /api/share/push, /api/team-share/* all deleted.

POST   /api/pair/request                     → unchanged (Redis short-TTL code)
POST   /api/pair/confirm                     → unchanged
POST   /api/unlink                           → updates coaches.devices
```

Delete entirely:
- `api/sync/teams.js` (blob GET/POST)
- `api/sync/library.js` (blob GET/POST)
- `api/share/push.js` (no push needed; shared reads are live from DB)
- `api/team-share/*.js` (legacy path, unused once share endpoints read from DB)

Keep:
- `api/session-library/upload-image.js` (Blob CDN uploads for diagrams)
- Pairing endpoints (short-TTL Redis)

## Client-side changes

### `src/hooks/useSync.js` — drastically simplified

Everything around versioning, `pushTeams` / `pullTeams` / `pushLibrary` / merge-retry is deleted. Replace with tiny per-entity upserts:

```js
// new signature / responsibilities
{
  saveTeam(team),          // PUT /api/teams/:id
  deleteTeam(id),
  saveSession(session),    // PUT /api/sessions/:id
  deleteSession(id),
  saveExercise(ex),
  deleteExercise(id),
  saveSessionLibrary(s),
  deleteSessionLibrary(id),
  hideLibraryItem(kind, id),
  unhideLibraryItem(kind, id),
  saveDiagram(d),
  deleteDiagram(id),
  bootstrap(),             // GET /api/coaches/:coachId → seed state
}
```

Each save is fire-and-forget debounced per-entity (200–500ms is plenty — we're only pushing the one thing that changed, not 1MB blobs).

### `useTeams.js` / `useLibrary.js` / `useDiagramLibrary.js`

- On mount when sync is enabled: call `syncContext.bootstrap()` and hydrate state.
- Every mutation already calls a reducer/setter — add a single line that fires the corresponding per-entity PUT/DELETE.
- `version`, `localVersion`, `loadTeamsFromServer` merge-on-pull, conflict handling: **all deleted**.

### Delete outright

- Cross-tab `BroadcastChannel` is no longer critical — each tab is reading from the same DB. Optional keep for instant in-memory sync but strictly a nice-to-have.
- `pagehide` flush via `sendBeacon`: unneeded if per-entity saves fire with a short debounce. Keep a simple 200ms debounce per entity; on pagehide, just don't bother — server already has the data from earlier keystrokes. The data loss window shrinks from "anything since the last idle 3s" to "last 200ms of typing."
- `mergeTeamsData` helper: delete.
- Version conflict retry loop: delete.
- `hasCheckedForUpdates` ref, visibility pull logic: optional to keep; each tab can re-bootstrap on visibility change to stay fresh.

### iOS app

The iOS sync calls today use the blob endpoints. Update the Swift client to call the same per-entity endpoints. Keep the iOS app's local SQLite store; the sync layer is the only thing that changes. **Ship the web migration first**; the iOS app keeps working because we keep a compatibility shim endpoint alive (see cutover).

## One-time data migration

Goal: copy every `coach:*` and `library:*` key from Upstash Redis into Postgres, no data lost, coaches don't need to do anything.

### Strategy: one-shot script run from a secured API route

Create a temporary protected endpoint that runs the migration. Triggered manually (curl with an admin secret), not by users.

```
POST /api/admin/migrate   (Authorization: Bearer <MIGRATION_SECRET>)
```

The endpoint does:

1. `SCAN` all Redis keys matching `coach:*`. For each:
   - Parse `coachData = { teams: { teams, version, defaultTeamId }, devices, lastUpdatedAt }`.
   - Upsert `coaches` row: `(coach_id, devices, default_team_id, updated_at)`.
   - For each team in `coachData.teams.teams`:
     - Upsert `teams` row.
     - For each session in `team.sessions`:
       - Upsert `sessions` row: `sections` goes as-is into JSONB.
2. `SCAN` all Redis keys matching `library:*`. For each:
   - Parse `{ library: { exercises: {items}, sessions: {items} } }`.
   - Upsert each item into `library_exercises` / `library_sessions`.
3. If the existing code stores `ppp_library_hidden_v1` server-side, migrate those too. (Currently it's client-only in localStorage; OK to leave for now — hidden state rebuilds as coaches open the app.)
4. Diagrams: currently client-only in localStorage. Not in Redis. **Skip in server migration.** Client-side migration on first load after deploy pushes each local diagram to the new `PUT /api/diagrams/:id` endpoint.

### Script skeleton

```js
// api/admin/migrate.js (protected, delete after successful cutover)
import { redis } from '../_lib/redis.js';
import { supabase } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.MIGRATION_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const report = { coaches: 0, teams: 0, sessions: 0, exercises: 0, sessionLibrary: 0, errors: [] };

  let cursor = 0;
  do {
    const [nextCursor, keys] = await redis.scan(cursor, { match: 'coach:*', count: 100 });
    cursor = Number(nextCursor);
    for (const key of keys) {
      try {
        const raw = await redis.get(key);
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const coachId = key.replace('coach:', '');
        await migrateCoach(coachId, data, report);
      } catch (e) {
        report.errors.push({ key, message: e.message });
      }
    }
  } while (cursor !== 0);

  cursor = 0;
  do {
    const [nextCursor, keys] = await redis.scan(cursor, { match: 'library:*', count: 100 });
    cursor = Number(nextCursor);
    for (const key of keys) {
      try {
        const raw = await redis.get(key);
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const coachId = key.replace('library:', '');
        await migrateLibrary(coachId, data, report);
      } catch (e) {
        report.errors.push({ key, message: e.message });
      }
    }
  } while (cursor !== 0);

  return res.status(200).json(report);
}
```

`migrateCoach` and `migrateLibrary` use Supabase `upsert` — idempotent, so the endpoint is safe to re-run (useful if it times out halfway).

### Runtime

Vercel serverless functions have a 10s hobby / 60s pro timeout. If you have <100 coaches, the whole migration runs in seconds. If it approaches the limit, the script can process in batches and be re-invoked — upserts make it safe.

### Also: one-time import of the owner's local backup file

In addition to the Redis→Postgres migration, the owner has a hand-exported JSON backup taken from a browser tab whose local changes never reached the server. This file **must also be imported into Postgres** so that work isn't lost.

**File shape** (produced by the console snippet used during recovery):

```json
{
  "teams":    { "version": 1, "teams": [...], "defaultTeamId": "..." },
  "exLib":    { "version": 1, "items": [...] },
  "sessLib":  { "version": 1, "items": [...] },
  "diagrams": { ... },
  "hidden":   { "exercises": [...], "sessions": [...] }
}
```

**Mechanism**: add a second protected endpoint alongside the Redis migration:

```
POST /api/admin/import-backup
  Authorization: Bearer <MIGRATION_SECRET>
  Query: ?coachId=<coachId>     # the coach this backup belongs to
  Body: the raw backup JSON
```

Handler:

1. Upsert `coaches` row for `coachId` if not already present.
2. For each team in `teams.teams`: upsert `teams` row (scoped to this `coachId`).
3. For each session inside each team: upsert `sessions` row.
4. For each `exLib.items`: upsert `library_exercises` row with `coach_id = coachId`.
5. For each `sessLib.items`: upsert `library_sessions` row.
6. For each diagram in `diagrams`: upsert `diagrams` row.
7. For each hidden id: upsert `library_hidden` row.

**Upserts are keyed by the entity's own id**, so this import is safe to run:
- Before the Redis migration (rows get created, then Redis migration leaves them alone if its data is older by `updated_at` — OR the Redis data overwrites them if it's newer).
- After the Redis migration (the backup fills in anything Redis didn't have — the lost sessions).
- Multiple times (idempotent).

**Conflict rule**: when both the backup and Redis contain the same entity id, **the one with the newer `updated_at` wins**. Implement in the importers by reading the existing row's `updated_at` before writing and only upserting if the incoming `updated_at` is `>=`. This protects against the backup accidentally stomping newer edits that landed from another device after the backup was taken.

**Order of operations in the cutover**:
- Step 4 (migration) becomes: run Redis migration, then run backup import for the owner's `coachId`. Both are idempotent, both report what they wrote.

**Sanity check before running**: diff the backup file against what Redis has for that coach to see exactly which sessions/exercises exist only in the backup. If nothing's unique to the backup, no-op; if there are new entities, they get inserted with their original ids.

### Verification

After running, the endpoint returns a report:
```json
{ "coaches": 12, "teams": 18, "sessions": 84, "exercises": 207, "sessionLibrary": 14, "errors": [] }
```
Spot-check 2–3 coaches in the Supabase SQL editor before cutover.

## Cutover strategy — zero data loss

Step-by-step, each step deployable independently:

**Step 1. Add Supabase. No client change.**
- Create Supabase project. Run schema SQL.
- Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MIGRATION_SECRET` to Vercel envs.
- Add `api/_lib/supabase.js` wrapper. Deploy.

**Step 2. Add new per-entity API endpoints alongside existing blob endpoints.**
- All new endpoints write to Postgres only.
- Deploy. Nothing on the client calls them yet.

**Step 3. Dual-write from existing blob endpoints (the safety net).**
- In `api/sync/teams.js` POST handler: after the Redis write succeeds, also upsert rows into Postgres (best-effort, catch + log). This keeps Postgres warm even if some coach is still using an old client cached in their browser.
- Same for `api/sync/library.js`.
- Deploy.

**Step 4. Run the one-time migration.**
- `curl -X POST -H "Authorization: Bearer $MIGRATION_SECRET" https://getplayball.app/api/admin/migrate`
- Verify report and spot-check.

**Step 5. Flip the client to per-entity endpoints.**
- Rewrite `useSync.js`, `useTeams.js`, `useLibrary.js` to use the new API.
- On first load after deploy: client calls `bootstrap()` which reads from Postgres. The dual-write in Step 3 guarantees Postgres is at least as fresh as Redis.
- Diagrams migrate from localStorage to Postgres on first load (client pushes each one).
- Deploy.

**Step 6. Let it bake for ~1 week.**
- Watch error logs. Keep dual-write running so rollback is possible.
- Browser caches of old clients still write to Redis; dual-write mirrors them forward.

**Step 7. Remove the blob endpoints and dual-write.**
- Delete `api/sync/teams.js`, `api/sync/library.js`, the dual-write helpers.
- Delete `api/admin/migrate.js`.
- Delete `mergeTeamsData`, `loadTeamsFromServer`, version fields.

**Step 8. iOS app update.**
- Point iOS sync client at new per-entity endpoints. Ship app update.
- Until iOS is updated, keep one compatibility endpoint: `GET /api/sync/teams` reading from Postgres and returning the old blob shape. iOS doesn't notice any change. Remove after app is rolled out to all users.

## Rollback plan

- Dual-write stays active through Step 6. If anything goes wrong in Step 5, revert the client deploy — Redis still has fresh data because dual-write back-mirrored it.
- After Step 7, rollback requires code revert + reading from the Postgres snapshot to restore Redis. Only remove dual-write once you're confident.

## What gets deleted (the payoff)

- `src/hooks/useSync.js` shrinks from ~425 lines to ~80.
- `src/utils/helpers.js`: `mergeTeamsData` goes.
- `src/components/AppShell.jsx`: version-conflict handling, broadcast receive/send, pagehide flush, max-age push logic — all gone or optional.
- `api/sync/teams.js`, `api/sync/library.js`, `api/share/push.js`, `api/team-share/*` — deleted.
- Version numbers on every entity, `localVersion` tracking on identity, 409 conflict responses — all gone.

## Risks / caveats

- **Supabase free tier has a 500MB DB limit.** Plenty for structured session data, but diagrams stored as base64 payloads could blow it up. Current design keeps diagram images on Vercel Blob (CDN) with only metadata in Postgres — verify nothing is stuffing full-resolution data URLs into JSONB columns. If a diagram's `payload` is >100KB, move its image to Blob before upsert.
- **`sections` as JSONB** means searching inside sections requires JSONB operators. Fine for current needs; if later we need "find all sessions that use exercise X," either a GIN index on `sections` or a real `sections` table.
- **Migration endpoint security**. `MIGRATION_SECRET` must be a long random string, set only in Vercel env. Delete the endpoint after cutover.
- **Upstash SCAN cursor**. `@upstash/redis` returns cursor as string; coerce to number and loop until `0`.
- **Timezone/updated_at**. Existing JSON has `updatedAt` as ISO strings. Migration converts to `timestamptz`. Preserve original values so per-entity LWW logic (if ever needed again) still works.
- **iOS lag**. Between Step 7 and Step 8, the iOS compatibility endpoint must reconstruct the old blob shape from Postgres on each read. It's a little glue code (~40 lines) but essential.

## Estimated scope

- Schema + Supabase wiring: 1–2 hours.
- New API endpoints (8 resources × GET/PUT/DELETE): 3–4 hours — mostly identical shape.
- Migration endpoint + testing: 1–2 hours.
- Client rewrite (`useSync.js`, wiring into `useTeams`/`useLibrary`/`useDiagramLibrary`, delete cruft): 4–6 hours.
- iOS compatibility endpoint: 1 hour.
- iOS app update: separate track.

Total: ~2 days for the web side.
