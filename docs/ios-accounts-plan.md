# iOS app: moving to PlayBall accounts

Status: planned, not started. Written 2026-10-21 alongside the web v3 work
(branch `v3-server-data`).

The web app now keeps every coach's data in their account (Supabase Auth +
Postgres) and saves through versioned API calls. The iOS app still keeps its
data on the device. This file is what the iOS app has to do to join that
model, and the compatibility it must keep while it does.

## What must keep working (frozen contract)

Older iOS builds will stay in people's hands for a long time. These endpoints
keep their current request/response shapes and stay unauthenticated:

| Endpoint | Used for | Notes |
| --- | --- | --- |
| `GET /api/share/{code}/sessions` | List a web team's sessions in the iOS app | `{ success, teamName, ageGroup, sessions: [{ id, title, date }] }` |
| `GET /api/share/{code}/sessions/{id}` | One session, full detail | Send `X-PlayBall-Version: 1` → CDN images are inlined as base64 |
| `POST /api/team-share/push` | iOS shares a team (roster + games) | Mirrored into Postgres (`mirrorTeamSharePush`) |
| `GET /api/team-share/{code}` | Import an iOS-shared team | Redis-backed |
| `DELETE /api/team-share/{code}` | Revoke an iOS share | Redis-backed |

`{code}` for the session endpoints is the web team's share token (the "iOS app
code" in the web Share dialog). Getting sessions onto iOS with a code is now
**only for sessions**: it carries no rosters, games or account.

Covered by the v3 test harness ("iOS list" / "iOS detail" checks). Don't
change these shapes; add new endpoints instead.

## Where the new iOS app should end up

1. **Sign in once, same account as the web.**
   - Sign in with Apple, natively (`ASAuthorizationAppleIDProvider` →
     `supabase.auth.signInWithIdToken(provider: .apple, idToken:)` in
     supabase-swift). Add the app's bundle ID to Supabase → Apple → Client IDs.
   - Sign in with Google (Google Sign-In SDK → `signInWithIdToken`, or the
     OAuth web flow with a `playball://login-callback` redirect added to
     Supabase's redirect URLs).
   - Email code (`signInWithOTP` + `verifyOTP(type: .email)`), the same as the web.
2. **Read from the server.** `GET /api/v2/snapshot` with
   `Authorization: Bearer <access token>` returns teams (with sessions and
   games), the library, templates, favorites and diagrams. Keep it on the
   device as a read cache for the field (offline viewing). Replace it whole
   on every load; never merge it.
3. **Write like the web.** `PUT /api/v2/{teams|sessions|games|…}/{id}` with
   `baseVersion` (null to create). A `409` returns the live row in `current`.
   For small edits, re-apply the changed fields and resend. For the session
   editor, ask the coach (overwrite / discard), the same as the web. A `428`
   means the client sent no `baseVersion`.
4. **First sign-in on a device with local data.** Upload what isn't on the
   server (teams, players, games), or let the coach choose. The web's
   `src/data/legacyImport.js` is the pattern.
5. **Games and rosters.** Once a team is on an account, the iOS app writes
   games through `/api/v2/games` (versioned), not `team-share/push`. Stop the
   push-mirror's "soft-delete every game missing from the push" for accounted
   teams, or web-created games get deleted.

## Session syncing in the new app (keeping a fallback)

- **Signed in:** sessions for all of the coach's teams come from the account
  automatically. No code needed.
- **Not signed in, or an assistant coach:** keep "Get sessions with a code" in
  the app, using the same endpoints as today. The first time a signed-out coach
  opens session sync, show **"Sign in to sync your sessions"** with a secondary
  **"Use a code instead"**, so nobody is forced to sign in to keep working.
- Never remove the code flow while older builds are still in use.

## App Store requirements to plan for

- **Sign in with Apple is required** if Google sign-in is offered
  (Guideline 4.8).
- **Account deletion inside the app** (Guideline 5.1.1(v)):
  `DELETE /api/v2/account` with body `{ "confirm": "DELETE" }` deletes the
  account and everything it owns. The web already has this.
- **Privacy nutrition label:** add Email Address and User Content (linked to
  the user, used for app functionality only, not for tracking). The policy at
  `/privacy` already covers accounts and the iOS app.

## Work list

- [ ] Add supabase-swift; configure the URL and anon key per build configuration
- [ ] Sign-in screen: Apple, Google, email code; "Look around first" if useful
- [ ] Snapshot fetch + on-device read cache; reload on foreground
- [ ] Versioned writes for teams, players, games, sessions; conflict handling
- [ ] First-sign-in upload of on-device data
- [ ] Session sync screen: account first, "Use a code instead" fallback
- [ ] Account screen: sign out, delete account
- [ ] Stop relying on `team-share/push` for signed-in teams; keep it for old builds
- [ ] Privacy label update; TestFlight with a web account side by side

## Open questions

- Do players/rosters get their own API, or stay a column on `teams` (written
  today by the iOS push only)?
- Should the iOS app read the web library and diagrams, or just sessions?
- How long do builds without accounts stay supported, before the
  `team-share/*` endpoints can be retired?
