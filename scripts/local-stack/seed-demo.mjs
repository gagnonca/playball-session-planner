// Wipes the LOCAL stack and seeds a small demo to click through by hand.
// Sign in with any of these emails (code arrives in Mailpit, :54324):
//   head@test.local       Coach Head — web team "Thunder" with practice sessions
//   assistant@test.local  Coach Assistant — assistant on Thunder
//   cocoach@test.local    no name yet (first-login name prompt), no teams
// Usage: node scripts/local-stack/seed-demo.mjs "$PWD"   (local API on :3000)
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const { createClient } = await import(pathToFileURL(path.join(process.argv[2], 'node_modules/@supabase/supabase-js/dist/main/index.js')).href);
const SB = 'http://127.0.0.1:54321';
const ANON = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
// `supabase start`'s standard local service key (local stack only).
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const admin = createClient(SB, SERVICE, { auth: { persistSession: false } });

// 1. Wipe (local database container only).
const db = execSync("docker ps --format '{{.Names}}' | grep supabase_db").toString().trim();
if (!db) throw new Error('local supabase_db container not found');
execSync(`docker exec ${db} psql -U postgres -d postgres -q -c "
  truncate coaches, teams, sessions, games, diagrams, library_exercises, library_sessions, library_hidden,
           favorites, session_templates, public_items, public_reports, team_members, team_invites, team_requests cascade;
  delete from auth.users;"`);
await fetch('http://127.0.0.1:54324/api/v1/messages', { method: 'DELETE' });

// 2. Accounts (a random password only this script uses; you sign in by email code).
const password = crypto.randomBytes(12).toString('base64url');
async function coach(email, name) {
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const c = createClient(SB, ANON, { auth: { persistSession: false } });
  const { data, error: e } = await c.auth.signInWithPassword({ email, password });
  if (e) throw e;
  const who = { token: data.session.access_token, userId: data.user.id };
  await api(who, 'POST', 'account/claim', {});
  if (name) await api(who, 'PUT', 'account', { name });
  await c.auth.signOut({ scope: 'local' });
  return who;
}
async function api(who, method, p, body) {
  const res = await fetch(`http://localhost:3000/api/v2/${p}`, {
    method,
    headers: { Authorization: `Bearer ${who.token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status} ${JSON.stringify(json)}`);
  return json;
}

const head = await coach('head@test.local', 'Coach Head');
const assistant = await coach('assistant@test.local', 'Coach Assistant');
await coach('cocoach@test.local', null);

// 3. Head coach's web team with two practice sessions.
const team = `thunder-${Date.now()}`;
await api(head, 'PUT', `teams/${team}`, { name: 'Thunder', ageGroup: 'U10', baseVersion: null });
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
for (const [title, n] of [['Passing triangles', 2], ['1v1 attacking', 5]]) {
  await api(head, 'PUT', `sessions/s-${crypto.randomUUID()}`, {
    teamId: team, summary: { summary: { title, date: day(n), duration: '60' } }, sections: [], baseVersion: null,
  });
}

// 4. Assistant joins Thunder through a real invite.
const { url } = await api(head, 'POST', `teams/${team}/invites`, { role: 'assistant' });
await api(assistant, 'POST', `invites/${new URL(url).searchParams.get('t')}/accept`, {});

console.log('Seeded: head@test.local (Coach Head, owns Thunder), assistant@test.local (assistant on Thunder), cocoach@test.local (new, no name)');
