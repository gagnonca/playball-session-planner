import { getTeamsData } from '../utils/indexedDBHelper';
import { SECTION_LIBRARY_KEY, SESSION_LIBRARY_KEY, DIAGRAMS_KEY, SESSION_TEMPLATES_KEY, LIBRARY_PINS_KEY } from '../constants/storage';
import { getState, teams as teamStore, sessions as sessionStore, library, diagrams as diagramStore, templates as templateStore, setFavorite } from './store';

// Before v3, each browser kept its own copy of everything (IndexedDB blob for
// teams, localStorage for the library and diagrams). v3 never reads or writes
// those again; this module finds anything in them the server doesn't have and
// can upload it. It never deletes the old copies.

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Everything in this browser's old storage whose id the server doesn't know.
export async function findLegacyOnlyData() {
  const s = getState();
  const serverTeams = new Map((s.teamsData?.teams || []).map(t => [t.id, t]));
  const serverSessionIds = new Set((s.teamsData?.teams || []).flatMap(t => t.sessions.map(x => x.id)));
  const serverEx = new Set(s.library.exercises.items.map(x => x.id));
  const serverLibSess = new Set(s.library.sessions.items.map(x => x.id));
  const serverDiagrams = new Set(s.diagrams.map(x => x.id));

  let legacyTeams = null;
  try { legacyTeams = await getTeamsData(); } catch { /* no old DB */ }

  const teams = [];
  const sessions = [];
  for (const t of legacyTeams?.teams || []) {
    if (!t?.id) continue;
    if (!serverTeams.has(t.id)) teams.push(t);
    for (const sess of t.sessions || []) {
      if (sess?.id && !serverSessionIds.has(sess.id)) sessions.push({ teamId: t.id, session: sess });
    }
  }

  const exercises = (readJson(SECTION_LIBRARY_KEY)?.items || []).filter(x => x?.id && !serverEx.has(x.id));
  const librarySessions = (readJson(SESSION_LIBRARY_KEY)?.items || []).filter(x => x?.id && !serverLibSess.has(x.id));
  const diagrams = (readJson(DIAGRAMS_KEY)?.diagrams || []).filter(x => x?.id && !serverDiagrams.has(x.id));

  const serverTemplates = new Set(s.templates.map(x => x.id));
  const templates = (readJson(SESSION_TEMPLATES_KEY)?.items || []).filter(x => x?.id && !serverTemplates.has(x.id));
  const pins = readJson(LIBRARY_PINS_KEY) || {};
  const favorites = ['sessions', 'exercises', 'diagrams'].flatMap(field =>
    (pins[field] || [])
      .filter(key => !(s.favorites[field] || []).includes(key))
      .map(key => ({ kind: field.replace(/s$/, ''), key }))
  );

  return {
    teams, sessions, exercises, librarySessions, diagrams, templates, favorites,
    total: teams.length + sessions.length + exercises.length + librarySessions.length + diagrams.length
      + templates.length + favorites.length,
  };
}

// Upload what findLegacyOnlyData() found. Teams go first; sessions.create
// waits for its team's write, so ordering on the server is safe.
export async function uploadLegacyData(found) {
  for (const t of found.teams) {
    const { sessions: _s, games: _g, ...team } = t;
    teamStore.create({ ...team, sessions: [] });
  }
  const writes = [];
  for (const { teamId, session } of found.sessions) {
    if (!getState().teamsData?.teams.some(t => t.id === teamId)) continue;
    const { version: _v, ...clean } = session;
    writes.push(sessionStore.create(teamId, clean));
  }
  for (const x of found.exercises) library.putExercise({ ...x, version: null });
  for (const x of found.librarySessions) library.putSession({ ...x, version: null });
  for (const d of found.diagrams) diagramStore.put({ ...d, version: null });
  for (const t of found.templates || []) templateStore.put({ ...t, version: null });
  for (const f of found.favorites || []) setFavorite(f.kind, f.key, true);
  await Promise.all(writes);
}
