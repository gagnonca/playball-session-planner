# Local stack for account testing

Test accounts and data on this Mac only — nothing touches production.
The manual test checklist, environments and accounts live in the iOS repo's `TESTING.md`.

1. `supabase start` with this folder's `supabase/` (8-digit codes like production,
   an email template that includes the code). Copy `supabase/migrations/*.sql`
   into `supabase/migrations/` first (skip 0013, it locks prod-only backup tables).
   Sign-in emails land in Mailpit: http://127.0.0.1:54324
2. API on :3000 against local Supabase only (not `vercel dev`, which loads
   production env including Redis):

       env -i HOME=$HOME PATH=$PATH SUPABASE_URL=http://127.0.0.1:54321 \
         SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from supabase status> \
         KV_REST_API_URL=http://127.0.0.1:9 KV_REST_API_TOKEN=none \
         node scripts/local-stack/api-server.mjs "$PWD" 3000

3. Web: `VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=<PUBLISHABLE_KEY> npm run dev`
   (Vite proxies /api to :3000).
4. iPhone simulator (Debug): Account → Developer → Server → "Local + test accounts".
   `PlayBallUITests/AccountFlowUITests` runs sign-in → name → sign-out against it.
5. API end-to-end suite: `node scripts/local-stack/api-tests.mjs "$PWD"`

## Demo accounts

`node scripts/local-stack/seed-demo.mjs "$PWD"` wipes the local database and
creates head@test.local (owns Thunder, with sessions), assistant@test.local
(assistant on Thunder) and cocoach@test.local (new, no name). Sign in with the
email; the code is in Mailpit. Any other @test.local email makes a new account.

Invite links on a second simulator: copy the link from the share sheet, then

    xcrun simctl openurl <device id> "$(pbpaste | sed 's#https://www.getplayball.app/join#playball://join#')"
