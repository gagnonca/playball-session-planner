import { getTeamsData } from '../utils/indexedDBHelper';
import { uploadImageToCDN } from '../utils/uploadImage';
import {
  TEAMS_KEY,
  SECTION_LIBRARY_KEY, SESSION_LIBRARY_KEY, DIAGRAMS_KEY, SESSION_TEMPLATES_KEY, LIBRARY_PINS_KEY,
} from '../constants/storage';
import { getState, createIfNew, addFavoriteQuietly, load } from './store';

// Before accounts, every browser kept its own copy of everything: teams and
// sessions in IndexedDB (older builds: localStorage), the library, diagrams,
// templates and pins in localStorage. When a coach signs in, this moves
// whatever this browser has into their account.
//
// Safety rule: an item is uploaded only if the account has NEVER had it.
// Each one is a create-only write (createIfNew), so the server refuses ids it
// already holds — live (the account's copy wins) or deleted (it stays deleted).
// The browser's old copies are never modified or removed.

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Ids the server refused on an earlier run (already there, or deleted) —
// remembered so they don't keep showing up as "not moved".
const SKIPPED_KEY = 'ppp_v3_import_skipped';
function readSkipped() {
  return new Set(readJson(SKIPPED_KEY) || []);
}
function rememberSkipped(ids) {
  if (!ids.length) return;
  try { localStorage.setItem(SKIPPED_KEY, JSON.stringify([...new Set([...readSkipped(), ...ids])])); } catch { /* ignore */ }
}

async function readLegacyTeams() {
  try {
    const idb = await getTeamsData();
    if (idb?.teams?.length) return idb.teams;
  } catch { /* no old database */ }
  // Builds before IndexedDB kept teams in localStorage. (The even older
  // single-session format was converted by the app itself on first load.)
  const ls = readJson(TEAMS_KEY);
  return ls?.teams?.length ? ls.teams : [];
}

// Everything this browser holds, minus ids the account is already showing.
// (Ids the account deleted are filtered by the server, not here.)
export async function findLocalData() {
  const s = getState();
  const skipped = readSkipped();
  const liveTeams = new Set([...(s.teamsData?.teams || []).map(t => t.id), ...skipped]);
  const liveSessions = new Set([...(s.teamsData?.teams || []).flatMap(t => t.sessions.map(x => x.id)), ...skipped]);
  const liveEx = new Set([...s.library.exercises.items.map(x => x.id), ...skipped]);
  const liveLibSess = new Set([...s.library.sessions.items.map(x => x.id), ...skipped]);
  const liveDiagrams = new Set([...s.diagrams.map(x => x.id), ...skipped]);
  const liveTemplates = new Set([...s.templates.map(x => x.id), ...skipped]);

  const teams = [];
  const sessions = [];
  for (const t of await readLegacyTeams()) {
    if (!t?.id) continue;
    if (!liveTeams.has(t.id)) teams.push(t);
    for (const sess of t.sessions || []) {
      if (sess?.id && !liveSessions.has(sess.id)) sessions.push({ teamId: t.id, session: sess });
    }
  }
  const exercises = (readJson(SECTION_LIBRARY_KEY)?.items || []).filter(x => x?.id && !liveEx.has(x.id));
  const librarySessions = (readJson(SESSION_LIBRARY_KEY)?.items || []).filter(x => x?.id && !liveLibSess.has(x.id));
  const diagrams = (readJson(DIAGRAMS_KEY)?.diagrams || []).filter(x => x?.id && !liveDiagrams.has(x.id));
  const templates = (readJson(SESSION_TEMPLATES_KEY)?.items || []).filter(x => x?.id && !liveTemplates.has(x.id));
  const pins = readJson(LIBRARY_PINS_KEY) || {};
  const favorites = ['sessions', 'exercises', 'diagrams'].flatMap(field =>
    (pins[field] || [])
      .filter(key => !(s.favorites[field] || []).includes(key))
      .map(key => ({ kind: field.replace(/s$/, ''), key }))
  );

  return {
    teams, sessions, exercises, librarySessions, diagrams, templates, favorites,
    total: teams.length + sessions.length + exercises.length + librarySessions.length
      + diagrams.length + templates.length + favorites.length,
  };
}

// Old sessions can carry diagram images inline (base64), which can push one
// session past the API's request-size limit. Move them to the CDN first;
// if an upload fails the image stays inline and the server tries again.
async function withImagesOnCdn(session) {
  const out = JSON.parse(JSON.stringify(session));
  for (const sec of out.sections || []) {
    if (sec.imageDataUrl?.startsWith('data:')) sec.imageDataUrl = (await uploadImageToCDN(sec.imageDataUrl)) || sec.imageDataUrl;
    if (sec.diagramData?.dataUrl?.startsWith('data:')) delete sec.diagramData.dataUrl;
    for (const v of sec.variations || []) {
      if (v.imageDataUrl?.startsWith('data:')) v.imageDataUrl = (await uploadImageToCDN(v.imageDataUrl)) || v.imageDataUrl;
      if (v.diagramData?.dataUrl?.startsWith('data:')) delete v.diagramData.dataUrl;
    }
  }
  return out;
}

// Upload `found` (from findLocalData) create-only, then reload the account.
// Returns counts: { created, alreadyThere, deletedBefore, failed, offline }.
export async function importLocalData(found) {
  const tally = { created: 0, alreadyThere: 0, deletedBefore: 0, failed: 0, offline: 0 };
  const skippedIds = [];
  const count = (r, id) => {
    if (r === 'created') tally.created += 1;
    else if (r === 'exists') { tally.alreadyThere += 1; skippedIds.push(id); }
    else if (r === 'deleted' || r === 'forbidden') { tally.deletedBefore += 1; skippedIds.push(id); }
    else if (r === 'network') tally.offline += 1;
    else tally.failed += 1;
  };

  // Teams first: the server only accepts a session for a team it holds.
  for (const t of found.teams) {
    const { sessions: _s, games: _g, version: _v, ...team } = t;
    count(await createIfNew('team', team), team.id);
  }
  for (const { teamId, session } of found.sessions) {
    const { version: _v, ...clean } = await withImagesOnCdn(session);
    count(await createIfNew('session', clean, { teamId }), clean.id);
  }
  for (const x of found.exercises) count(await createIfNew('exercise', x), x.id);
  for (const x of found.librarySessions) count(await createIfNew('libsession', x), x.id);
  for (const d of found.diagrams) {
    const { dataUrl, ...rest } = d;
    count(await createIfNew('diagram', dataUrl?.startsWith('data:') ? { ...rest, dataUrl: (await uploadImageToCDN(dataUrl)) || undefined } : d), d.id);
  }
  for (const t of found.templates) count(await createIfNew('template', t), t.id);
  for (const f of found.favorites) count(await addFavoriteQuietly(f.kind, f.key));

  rememberSkipped(skippedIds);
  if (tally.created > 0) await load();
  return tally;
}
