import { request } from './api';

// The account "Your teams" setup screen's data (components/YourTeamsSetup.jsx).

const SEEN_KEY = (userId) => `ppp_setup_seen_${userId}`;

export function setupSeen(userId) {
  try { return Boolean(localStorage.getItem(SEEN_KEY(userId))); } catch { return true; }
}

export function markSetupSeen(userId) {
  try { localStorage.setItem(SEEN_KEY(userId), new Date().toISOString()); } catch { /* ignore */ }
}

const normalizeName = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Each team made in the app paired with a web team of the same name.
function findPairs(teams) {
  const used = new Set();
  const pairs = [];
  for (const app of teams.filter(t => t.fromApp)) {
    const match = teams.find(t => !t.fromApp && !used.has(t.id) && normalizeName(t.name) === normalizeName(app.name));
    if (match) { used.add(match.id); pairs.push({ app, web: match }); }
  }
  return pairs;
}

// POST /setup with no device teams: the account's teams with their data counts.
export async function fetchSetup() {
  const data = await request('POST', '/api/v2/setup', { localTeams: [] });
  return { ...data, pairs: findPairs(data.teams || []) };
}

export function setupNeeded(info) {
  return !info.name || info.pairs.length > 0;
}
