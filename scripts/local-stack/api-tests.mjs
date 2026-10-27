// End-to-end account tests against the LOCAL stack only: local Supabase
// (127.0.0.1:54321) + the API adapter on :3000. Test users are created here.
// Usage: node api-tests.mjs <planner repo dir>
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const repo = process.argv[2];
const { createClient } = await import(pathToFileURL(path.join(repo, 'node_modules/@supabase/supabase-js/dist/main/index.js')).href);

const SB = 'http://127.0.0.1:54321';
const API = 'http://localhost:3000/api/v2';
const ANON = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
if (!SB.includes('127.0.0.1')) throw new Error('local only');

const admin = createClient(SB, SERVICE, { auth: { persistSession: false } });
const run = crypto.randomBytes(3).toString('hex');
const password = crypto.randomBytes(12).toString('base64url'); // throwaway, local stack only

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${detail !== undefined ? ` — ${JSON.stringify(detail).slice(0, 300)}` : ''}`); }
}
const section = (t) => console.log(`\n${t}`);

async function makeCoach(label, fullName) {
  const email = `${label}-${run}@test.local`;
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: fullName ? { full_name: fullName } : {} });
  if (error) throw error;
  return signIn(email);
}
async function signIn(email) {
  const c = createClient(SB, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { email, token: data.session.access_token, userId: data.user.id, client: c };
}
async function api(who, method, p, body) {
  const res = await fetch(`${API}/${p}`, {
    method,
    headers: { ...(who ? { Authorization: `Bearer ${who.token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null; try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, json: json || {} };
}
const uuid = () => crypto.randomUUID().toUpperCase();

// ---------------------------------------------------------------------------
section('1. New account: name is asked for once');
const head = await makeCoach('head');
let r = await api(head, 'POST', 'account/claim', {});
check('claim creates the coach', r.status === 200, r);
r = await api(head, 'GET', 'account');
check('new account has no name', r.status === 200 && r.json.name === null, r.json);
r = await api(head, 'POST', 'setup', { localTeams: [] });
check('setup reports name missing', r.status === 200 && r.json.name === null, r.json);
r = await api(head, 'PUT', 'account', { name: 'Coach Head' });
check('name saved', r.status === 200 && r.json.name === 'Coach Head', r.json);
r = await api(head, 'POST', 'setup', { localTeams: [] });
check('setup now has the name (no prompt next time)', r.json.name === 'Coach Head', r.json);
const named = await makeCoach('google', 'Pat Google');
await api(named, 'POST', 'account/claim', {});
r = await api(named, 'GET', 'account');
check('Google/Apple name offered as the suggestion', r.json.suggestedName === 'Pat Google' && r.json.name === null, r.json);

// ---------------------------------------------------------------------------
section('2. iPhone team + web sessions team → merge');
const appTeam = uuid(), webTeam = `web-${run}`, game1 = uuid(), session1 = `s-${run}`;
r = await api(head, 'PUT', `teams/${appTeam}/ios`, { name: 'Thunder', players: [{ id: 'p1', name: 'Ava' }, { id: 'p2', name: 'Ben' }], ios: { format: '7v7' }, baseVersion: null });
check('iPhone team uploaded', r.status === 200, r);
r = await api(head, 'PUT', `games/${game1}`, { teamId: appTeam, name: 'vs Rockets', date: '2026-11-01', isHome: true, payload: {}, baseVersion: null });
check('iPhone game uploaded', r.status === 200, r);
r = await api(head, 'PUT', `teams/${webTeam}`, { name: 'Thunder', baseVersion: null });
check('web team created', r.status === 200, r);
r = await api(head, 'PUT', `sessions/${session1}`, { teamId: webTeam, summary: { title: 'Passing', date: '2026-11-03' }, sections: [], baseVersion: null });
check('web session created', r.status === 200, r);
r = await api(head, 'POST', 'setup', { localTeams: [{ id: appTeam, name: 'Thunder' }, { id: uuid(), name: 'Thunder' }] });
const appRow = r.json.teams?.find(t => t.id === appTeam), webRow = r.json.teams?.find(t => t.id === webTeam);
check('setup counts: app team has 2 players · 1 game', appRow?.fromApp && appRow.players === 2 && appRow.games === 1, appRow);
check('setup counts: web team has 1 session', webRow && !webRow.fromApp && webRow.sessions === 1, webRow);
check('device team already on account is matched', r.json.localTeams?.[0]?.status === 'onAccount', r.json.localTeams?.[0]);
check('unknown device team named Thunder → suggested merge into the web team', r.json.localTeams?.[1]?.suggestMerge === webTeam, r.json.localTeams?.[1]);
r = await api(head, 'POST', `teams/${appTeam}/merge`, { into: webTeam, name: 'Thunder' });
check('merge succeeds', r.status === 200, r);
r = await api(head, 'GET', 'snapshot');
const merged = r.json.teams?.find(t => t.id === webTeam);
check('merged team has the game, roster and session', merged?.games?.length === 1 && merged.players?.length === 2 && merged.sessions?.length === 1, merged && { games: merged.games?.length, players: merged.players?.length, sessions: merged.sessions?.length });
check('app team gone, left as a pointer for devices', !r.json.teams?.some(t => t.id === appTeam) && JSON.stringify(r.json.mergedTeams || {}).includes(webTeam), r.json.mergedTeams);
r = await api(head, 'POST', 'setup', { localTeams: [{ id: appTeam }] });
check('the iPhone (old team id) is pointed at the merged team', r.json.localTeams?.[0]?.status === 'onAccount' && r.json.localTeams[0].teamId === webTeam, r.json.localTeams?.[0]);

// ---------------------------------------------------------------------------
section('3. Invite an assistant');
const assistant = await makeCoach('assistant');
await api(assistant, 'POST', 'account/claim', {});
await api(assistant, 'PUT', 'account', { name: 'Coach Assistant' });
r = await api(head, 'POST', `teams/${webTeam}/invites`, { role: 'assistant' });
const aToken = r.json.url && new URL(r.json.url).searchParams.get('t');
check('owner creates an assistant invite link', r.status === 200 && aToken, r.json);
r = await api(null, 'GET', `invites/${aToken}`);
check('invite preview works signed out (team, role, who invited)', r.json.teamName === 'Thunder' && r.json.role === 'assistant' && r.json.invitedBy === 'Coach Head', r.json);
r = await api(assistant, 'POST', `invites/${aToken}/accept`, {});
check('assistant accepts', r.status === 200, r);
r = await api(assistant, 'GET', 'snapshot');
check('team appears for the assistant as shared, role assistant', r.json.sharedTeams?.some(t => t.id === webTeam && t.role === 'assistant'), r.json.sharedTeams?.map(t => ({ id: t.id, role: t.role })));
r = await api(assistant, 'PUT', `games/${uuid()}`, { teamId: webTeam, name: 'Assistant edit', payload: {}, baseVersion: null });
check('assistant cannot add/change team games (read-only)', r.status === 403 && r.json.error === 'read_only', r);
r = await api(assistant, 'PUT', `games/${game1}`, { teamId: webTeam, name: 'Hacked', payload: {}, baseVersion: 1 });
check("assistant cannot edit the head coach's game", r.status === 403 || r.status === 409, r);
const privateGame = uuid();
r = await api(assistant, 'PUT', `games/${privateGame}`, { teamId: webTeam, name: 'My lineup idea', payload: {}, private: true, baseVersion: null });
check('assistant can keep a private copy of a game', r.status === 200, r);
r = await api(head, 'GET', `games?teamId=${webTeam}`);
check("assistant's private copy is not shown to the head coach", r.json.games?.length === 1 && !r.json.games.some(g => g.id === privateGame), r.json.games?.map(g => g.name));
r = await api(assistant, 'GET', `sessions/${session1}/app`);
check('assistant can open the practice session', r.status === 200, r.status);
r = await api(assistant, 'POST', `teams/${webTeam}/invites`, { role: 'assistant' });
check('assistant cannot invite others', r.status === 403, r);
r = await api(assistant, 'POST', `invites/${aToken}/accept`, {});
const outsider = await makeCoach('outsider');
await api(outsider, 'POST', 'account/claim', {});
r = await api(outsider, 'POST', `invites/${aToken}/accept`, {});
check('a used invite link cannot be reused by someone else', r.status !== 200 && r.json.error === 'used', r);
r = await api(outsider, 'GET', `sessions/${session1}/app`);
check('non-members cannot read the session', r.status === 403 || r.status === 404, r.status);

// ---------------------------------------------------------------------------
section('4. Invite a co-coach');
const cocoach = await makeCoach('cocoach');
await api(cocoach, 'POST', 'account/claim', {});
r = await api(head, 'POST', `teams/${webTeam}/invites`, { role: 'cocoach' });
const cToken = new URL(r.json.url).searchParams.get('t');
r = await api(cocoach, 'POST', `invites/${cToken}/accept`, {});
check('co-coach accepts', r.status === 200, r);
r = await api(cocoach, 'GET', `games?teamId=${webTeam}`);
const g = r.json.games?.find(x => x.id === game1);
r = await api(cocoach, 'PUT', `games/${game1}`, { teamId: webTeam, name: 'vs Rockets (moved)', date: '2026-11-02', payload: {}, baseVersion: g?.version });
check('co-coach can edit team games', r.status === 200, r);
r = await api(head, 'GET', `games?teamId=${webTeam}`);
check('head coach sees the co-coach edit', r.json.games?.find(x => x.id === game1)?.name === 'vs Rockets (moved)', r.json.games?.map(x => x.name));
r = await api(head, 'GET', `teams/${webTeam}/members`);
check('owner sees both coaches with roles and names', r.json.members?.some(m => m.role === 'assistant' && m.name === 'Coach Assistant') && r.json.members?.some(m => m.role === 'cocoach'), r.json.members);
r = await api(head, 'DELETE', `teams/${webTeam}/members/${cocoach.userId}`);
check('owner removes the co-coach', r.status === 200, r);
r = await api(cocoach, 'GET', 'snapshot');
check('removed co-coach no longer sees the team', !r.json.sharedTeams?.some(t => t.id === webTeam), r.json.sharedTeams);

// ---------------------------------------------------------------------------
section('5. Old share code: assistant held it, head coach claims, assistant requests access');
const anonCoach = `anon:${run}`, codeTeam = uuid(), code = `T${run}`.slice(0, 6).toUpperCase();
let e = (await admin.from('coaches').insert({ coach_id: anonCoach })).error
  || (await admin.from('teams').insert({ id: codeTeam, coach_id: anonCoach, name: 'Lightning', ios_share_code: code, players: [{ id: 'q1', name: 'Cy' }] })).error
  || (await admin.from('games').insert({ id: uuid(), team_id: codeTeam, coach_id: anonCoach, name: 'Opening day', payload: {} })).error;
check('seeded an anonymous share-code team with a game', !e, e);
r = await api(head, 'POST', 'setup', { localTeams: [{ id: codeTeam, shareCode: code }] });
check('before claiming: setup says claimable', r.json.localTeams?.[0]?.status === 'claimable', r.json.localTeams?.[0]);
r = await api(head, 'POST', `teams/${codeTeam}/claim-ios`, { shareCode: code });
check('head coach claims it (games come along)', r.status === 200 && r.json.claimed, r);
r = await api(head, 'GET', `games?teamId=${r.json.teamId || codeTeam}`);
check('claimed team kept its game', r.json.games?.length === 1, r.json);
r = await api(assistant, 'POST', `teams/${codeTeam}/claim-ios`, { shareCode: code });
check('second claimer is refused, told who manages it', r.status === 409 && r.json.managedBy === 'Coach Head', r);
r = await api(assistant, 'POST', 'setup', { localTeams: [{ id: codeTeam, shareCode: code }] });
check("assistant's setup shows Managed by Coach Head", r.json.localTeams?.[0]?.status === 'managedByOther' && r.json.localTeams[0].managedBy === 'Coach Head', r.json.localTeams?.[0]);
r = await api(assistant, 'POST', `teams/${codeTeam}/requests`, { shareCode: 'WRONG1' });
check('request needs the real code', r.status === 404, r);
r = await api(assistant, 'POST', `teams/${codeTeam}/requests`, { shareCode: code });
check('assistant requests access', r.status === 200 && r.json.requested, r);
r = await api(assistant, 'POST', 'setup', { localTeams: [{ id: codeTeam, shareCode: code }] });
check('request shows as pending', r.json.localTeams?.[0]?.requested === true, r.json.localTeams?.[0]);
r = await api(head, 'GET', `teams/${codeTeam}/members`);
check('owner sees the request', r.json.requests?.some(x => x.userId === assistant.userId && x.name === 'Coach Assistant'), r.json.requests);
r = await api(head, 'POST', `teams/${codeTeam}/requests/${assistant.userId}`, { decision: 'cocoach' });
check('owner approves as co-coach', r.status === 200, r);
r = await api(assistant, 'GET', 'snapshot');
check('approved coach now has the team as co-coach', r.json.sharedTeams?.some(t => t.id === codeTeam && t.role === 'cocoach'), r.json.sharedTeams?.map(t => ({ id: t.id, role: t.role })));

// ---------------------------------------------------------------------------
section('6. Make Owner');
r = await api(assistant, 'POST', `teams/${codeTeam}/transfer`, { userId: assistant.userId });
check('a co-coach cannot take ownership', r.status === 403, r);
r = await api(head, 'POST', `teams/${codeTeam}/transfer`, { userId: assistant.userId });
check('owner hands the team over', r.status === 200, r);
r = await api(assistant, 'GET', 'snapshot');
check('new owner has it as their own team', r.json.teams?.some(t => t.id === codeTeam), r.json.teams?.map(t => t.id));
r = await api(head, 'GET', 'snapshot');
check('old owner stays on as co-coach', r.json.sharedTeams?.some(t => t.id === codeTeam && t.role === 'cocoach'), r.json.sharedTeams?.map(t => ({ id: t.id, role: t.role })));
r = await api(assistant, 'GET', `games?teamId=${codeTeam}`);
check('games moved with the team', r.json.games?.length === 1, r.json.games?.length);

// ---------------------------------------------------------------------------
section('7. Coach is head coach of one team and assistant on another');
r = await api(assistant, 'GET', 'snapshot');
check('same account: owns Lightning, assistant on Thunder', r.json.teams?.some(t => t.id === codeTeam) && r.json.sharedTeams?.some(t => t.id === webTeam && t.role === 'assistant'), { own: r.json.teams?.map(t => t.name), shared: r.json.sharedTeams?.map(t => [t.name, t.role]) });

// ---------------------------------------------------------------------------
section('8. Sign out only signs out that device');
const phone = await signIn(head.email);
const browser = await signIn(head.email);
let lo = await fetch(`${SB}/auth/v1/logout?scope=local`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${phone.token}` } });
check('iPhone signs out (scope=local)', lo.status === 204, lo.status);
r = await api(browser, 'GET', 'account');
check('browser is still signed in', r.status === 200, r);
r = await api(phone, 'GET', 'account');
check("iPhone's old token no longer works", r.status === 401, r.status);
const ref = await phone.client.auth.refreshSession();
check("iPhone's refresh token is dead too", !!ref.error, ref.error?.message);
const { error: soErr } = await browser.client.auth.signOut({ scope: 'local' });
check('browser signs out cleanly', !soErr, soErr?.message);
r = await api(head, 'GET', 'account');
check('the original session (another device) is untouched by both', r.status === 200, r.status);

// ---------------------------------------------------------------------------
section('9. Leaving and access after removal');
r = await api(head, 'DELETE', `teams/${codeTeam}/members/${head.userId}`);
check('a member can leave a team', r.status === 200, r);
r = await api(head, 'GET', 'snapshot');
check('left team is gone from their list', !r.json.sharedTeams?.some(t => t.id === codeTeam), r.json.sharedTeams?.map(t => t.id));

// ---------------------------------------------------------------------------
section('10. One phone, two accounts: teams from the other account');
const second = await makeCoach('second');
await api(second, 'POST', 'account/claim', {});
r = await api(second, 'POST', 'setup', { localTeams: [{ id: webTeam, name: 'Thunder' }] });
check("another account's team (no share code) is managed by them, invite only", r.json.localTeams?.[0]?.status === 'managedByOther' && r.json.localTeams[0].canRequest === false && r.json.localTeams[0].managedBy === 'Coach Head', r.json.localTeams?.[0]);
r = await api(second, 'PUT', `teams/${webTeam}/ios`, { name: 'Thunder', players: [], baseVersion: null });
check("and it can't be taken over by uploading it", r.status === 403 || r.status === 409, r);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
