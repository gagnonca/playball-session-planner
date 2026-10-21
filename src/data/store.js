import { useSyncExternalStore } from 'react';
import { request, identityKey, isSignedIn, readLegacyIdentity, setAuthSession, currentUser } from './api';
import { supabase } from './supabaseClient';
import { COACH_IDENTITY_KEY } from '../constants/storage';
import { readCachedSnapshot, writeCachedSnapshot } from './cache';
import { toast } from '../utils/helpers';

// =============================================================================
// PlayBall data store — the server is the source of truth.
//
// • State is whatever the last GET /api/v2/snapshot returned, replaced
//   wholesale on every load. No client-side merging of server data, ever.
// • Writes go straight to the server as compare-and-set on each row's
//   `version`. While a write is in flight its entity is held in `overrides`
//   so a snapshot landing mid-write can't flash the old value back.
// • A 409 (someone saved first) is rebased: the fields *this* tab changed are
//   re-applied on top of the live row and resent. Session builder edits don't
//   go through here at all — they live in `drafts` until the coach hits Save,
//   and a conflict there is surfaced to the coach instead of auto-resolved.
// • Other tabs hear about every successful write over BroadcastChannel and
//   reload the snapshot; focus / visibility / coming online reload too.
// • The IndexedDB cache (./cache) only paints the first frame and keeps the
//   app readable offline. It is never written back.
// =============================================================================

const EMPTY = {
  status: 'idle',          // idle | signed-out | loading | ready | error
  demo: false,             // sample data, nothing is sent to the server
  source: null,            // cache | server
  error: null,
  lastLoadedAt: null,
  pendingWrites: 0,
  teamsData: null,         // { version, teams: [{ ...team, sessions, games }], defaultTeamId }
  library: { exercises: { version: 1, items: [] }, sessions: { version: 1, items: [] } },
  hidden: { exercises: [], sessions: [] },
  diagrams: [],
  templates: [],           // [{ id, name, exerciseIds, version }]
  favorites: { sessions: [], exercises: [], diagrams: [] },
  isAdmin: false,          // Community moderator (server decides, see api/_lib/auth.js)
  published: [],           // my Community items: [{ id, kind, sourceId, title, hidden, updatedAt }]
  drafts: {},              // sessionId → { teamId, base, value }
};

let state = EMPTY;
const listeners = new Set();

function setState(patch) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function getState() { return state; }

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// React binding. Select a field that keeps its identity between renders
// (e.g. s => s.teamsData), not a freshly built object.
export function useStore(selector) {
  return useSyncExternalStore(subscribe, () => selector(state));
}

// ---------------------------------------------------------------------------
// Entity kinds
// ---------------------------------------------------------------------------

const enc = encodeURIComponent;

function stripBase64(diagram) {
  if (diagram?.dataUrl && String(diagram.dataUrl).startsWith('data:')) {
    const { dataUrl: _d, ...rest } = diagram;
    return rest;
  }
  return diagram;
}

// Everything on a session object that isn't a row column goes in `summary`.
export function sessionBody(session, teamId) {
  const { id: _i, sections, isTemplate, version: _v, updatedAt: _u, ...summary } = session;
  return { teamId, summary, sections: sections ?? [], isTemplate: !!isTemplate };
}

const KINDS = {
  team: {
    path: (id) => `/api/v2/teams/${enc(id)}`,
    resKey: 'team',
    body: (t) => ({
      name: t.name || 'Untitled Team',
      ageGroup: t.ageGroup ?? null,
      defaultDuration: t.defaultDuration ?? null,
      sharing: t.sharing ?? { isShared: false },
      archived: !!t.archived,
    }),
  },
  session: {
    path: (id) => `/api/v2/sessions/${enc(id)}`,
    resKey: 'session',
    body: (s, ctx) => sessionBody(s, ctx.teamId),
  },
  exercise: {
    path: (id) => `/api/v2/library/exercises/${enc(id)}`,
    resKey: 'item',
    body: (x) => ({ name: x.name || 'Untitled', type: x.type ?? null, tags: x.tags ?? {}, payload: x.payload ?? {} }),
  },
  libsession: {
    path: (id) => `/api/v2/library/sessions/${enc(id)}`,
    resKey: 'item',
    body: (x) => ({ name: x.name || 'Untitled', tags: x.tags ?? {}, payload: x.payload ?? {} }),
  },
  diagram: {
    path: (id) => `/api/v2/diagrams/${enc(id)}`,
    resKey: 'diagram',
    body: (d) => ({ name: d.name || null, payload: stripBase64(d) }),
  },
  template: {
    path: (id) => `/api/v2/templates/${enc(id)}`,
    resKey: 'template',
    body: (t) => ({ name: t.name || 'Untitled template', exerciseIds: t.exerciseIds || [] }),
  },
};

const LABEL = { team: 'team', session: 'session', exercise: 'exercise', libsession: 'library session', diagram: 'diagram', template: 'template' };

// ---------------------------------------------------------------------------
// Pure state helpers
// ---------------------------------------------------------------------------

function findTeam(s, teamId) {
  return s.teamsData?.teams.find(t => t.id === teamId) || null;
}

export function findSession(s, teamId, sessionId) {
  return findTeam(s, teamId)?.sessions.find(x => x.id === sessionId) || null;
}

function getLocal(s, kind, id, ctx) {
  switch (kind) {
    case 'team': return findTeam(s, id);
    case 'session': return findSession(s, ctx.teamId, id);
    case 'exercise': return s.library.exercises.items.find(x => x.id === id) || null;
    case 'libsession': return s.library.sessions.items.find(x => x.id === id) || null;
    case 'diagram': return s.diagrams.find(x => x.id === id) || null;
    case 'template': return s.templates.find(x => x.id === id) || null;
    default: return null;
  }
}

function replaceOrAdd(list, item, prepend = false) {
  const i = list.findIndex(x => x.id === item.id);
  if (i === -1) return prepend ? [item, ...list] : [...list, item];
  const next = list.slice();
  next[i] = item;
  return next;
}

function withTeams(s, mapTeams) {
  if (!s.teamsData) return s;
  return { ...s, teamsData: { ...s.teamsData, teams: mapTeams(s.teamsData.teams) } };
}

function withPut(s, kind, entity, ctx) {
  switch (kind) {
    case 'team': {
      const { sessions, games, ...fields } = entity;
      return withTeams(s, teams => {
        const existing = teams.find(t => t.id === entity.id);
        const team = {
          ...(existing || {}),
          ...fields,
          sessions: existing?.sessions ?? sessions ?? [],
          games: existing?.games ?? games ?? [],
        };
        return replaceOrAdd(teams, team);
      });
    }
    case 'session':
      return withTeams(s, teams => teams.map(t =>
        t.id === ctx.teamId ? { ...t, sessions: replaceOrAdd(t.sessions || [], entity) } : t
      ));
    case 'exercise':
      return { ...s, library: { ...s.library, exercises: { ...s.library.exercises, items: replaceOrAdd(s.library.exercises.items, entity, true) } } };
    case 'libsession':
      return { ...s, library: { ...s.library, sessions: { ...s.library.sessions, items: replaceOrAdd(s.library.sessions.items, entity, true) } } };
    case 'diagram':
      return { ...s, diagrams: replaceOrAdd(s.diagrams, entity, true) };
    case 'template':
      return { ...s, templates: replaceOrAdd(s.templates, entity) };
    default:
      return s;
  }
}

function withRemove(s, kind, id, ctx) {
  switch (kind) {
    case 'team': {
      const next = withTeams(s, teams => teams.filter(t => t.id !== id));
      if (next.teamsData?.defaultTeamId === id) {
        next.teamsData = { ...next.teamsData, defaultTeamId: next.teamsData.teams[0]?.id || null };
      }
      return next;
    }
    case 'session':
      return withTeams(s, teams => teams.map(t =>
        t.id === ctx.teamId ? { ...t, sessions: (t.sessions || []).filter(x => x.id !== id) } : t
      ));
    case 'exercise':
      return { ...s, library: { ...s.library, exercises: { ...s.library.exercises, items: s.library.exercises.items.filter(x => x.id !== id) } } };
    case 'libsession':
      return { ...s, library: { ...s.library, sessions: { ...s.library.sessions, items: s.library.sessions.items.filter(x => x.id !== id) } } };
    case 'diagram':
      return { ...s, diagrams: s.diagrams.filter(x => x.id !== id) };
    case 'template':
      return { ...s, templates: s.templates.filter(x => x.id !== id) };
    default:
      return s;
  }
}

// ---------------------------------------------------------------------------
// Snapshot load
// ---------------------------------------------------------------------------

// key → { kind, ctx, op: 'put' | 'delete', entity } for writes not yet acked.
const overrides = new Map();

const byCreated = (a, b) => (a.createdAt || '').localeCompare(b.createdAt || '');
const byUpdatedDesc = (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '');

function stateFromSnapshot(snap) {
  const teams = (snap.teams || []).map(t => ({
    ...t,
    sessions: (t.sessions || []).slice().sort(byCreated),
    games: t.games || [],
  })).sort(byCreated);
  let next = {
    ...state,
    teamsData: {
      version: 1,
      teams,
      defaultTeamId: snap.coach?.defaultTeamId && teams.some(t => t.id === snap.coach.defaultTeamId)
        ? snap.coach.defaultTeamId
        : teams[0]?.id || null,
    },
    library: {
      exercises: { version: 1, items: (snap.library?.exercises || []).slice().sort(byUpdatedDesc) },
      sessions: { version: 1, items: (snap.library?.sessions || []).slice().sort(byUpdatedDesc) },
    },
    hidden: {
      exercises: snap.hidden?.exercises || [],
      sessions: snap.hidden?.sessions || [],
    },
    diagrams: (snap.diagrams || []).slice().sort(byUpdatedDesc),
    templates: (snap.templates || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    favorites: {
      sessions: snap.favorites?.sessions || [],
      exercises: snap.favorites?.exercises || [],
      diagrams: snap.favorites?.diagrams || [],
    },
    published: snap.published || [],
    isAdmin: Boolean(snap.coach?.isAdmin),
  };
  // Re-apply writes still in flight so they don't visibly revert.
  for (const o of overrides.values()) {
    next = o.op === 'delete'
      ? withRemove(next, o.kind, o.entity?.id ?? o.id, o.ctx)
      : withPut(next, o.kind, o.entity, o.ctx);
  }
  return next;
}

// First sign-in: give this account its coach. If this browser was linked to
// a coach before accounts existed, that coach (and its data) is adopted.
async function claimAccount() {
  const legacy = readLegacyIdentity();
  await request('POST', '/api/v2/account/claim',
    legacy ? { legacyCoachId: legacy.coachId, legacyDeviceId: legacy.deviceId } : {});
  if (legacy) {
    try {
      localStorage.setItem('ppp_coach_identity_backup_v1', JSON.stringify(legacy));
      localStorage.removeItem(COACH_IDENTITY_KEY);
    } catch { /* ignore */ }
  }
}

let loadPromise = null;
let cacheTimer = null;
// Bumped on every sign-in / sign-out (resetStore): a load that started under
// the previous account finishes into the void instead of overwriting state.
let generation = 0;

export function load() {
  if (loadPromise) return loadPromise;
  const myGen = generation;
  const stale = () => myGen !== generation;
  loadPromise = (async () => {
    if (state.demo) return;
    if (!isSignedIn()) {
      setState({ ...EMPTY, status: 'signed-out', drafts: state.drafts });
      return;
    }
    const userKey = identityKey();
    if (!state.teamsData) {
      const cached = await readCachedSnapshot(userKey);
      if (stale()) return;
      if (cached && !state.teamsData) {
        setState({ ...stateFromSnapshot(cached), status: 'ready', source: 'cache' });
      } else if (!cached) {
        setState({ status: 'loading' });
      }
    }
    try {
      let snap;
      // A browser still linked to a pre-account coach always offers it at
      // sign-in (the server adopts it if the account has none, or only an
      // empty one), so seasons of data never end up stranded.
      if (readLegacyIdentity()) await claimAccount();
      try {
        snap = await request('GET', '/api/v2/snapshot');
      } catch (e) {
        if (e.status !== 409 || e.body?.error !== 'no_coach') throw e;
        await claimAccount();
        snap = await request('GET', '/api/v2/snapshot');
      }
      if (stale()) return;
      setState({ ...stateFromSnapshot(snap), status: 'ready', source: 'server', error: null, lastLoadedAt: Date.now() });
      writeCachedSnapshot(userKey, snap);
    } catch (e) {
      if (stale()) return;
      // Signed out (or the session ended) mid-load: that's the sign-in page,
      // not a server problem.
      if (e.status === 401 && !isSignedIn()) {
        setState({ ...EMPTY, status: 'signed-out', drafts: state.drafts });
        return;
      }
      console.error('[store] snapshot failed', e);
      setState({ status: state.teamsData ? 'ready' : 'error', error: e });
    }
  })().finally(() => { if (!stale()) loadPromise = null; });
  return loadPromise;
}

let reloadTimer = null;
function scheduleReload(ms = 300) {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => { load(); }, ms);
}

// Keep the offline cache roughly current between full loads.
function scheduleCacheWrite() {
  clearTimeout(cacheTimer);
  cacheTimer = setTimeout(() => {
    const s = state;
    if (!s.teamsData) return;
    writeCachedSnapshot(identityKey(), {
      coach: { defaultTeamId: s.teamsData.defaultTeamId },
      teams: s.teamsData.teams,
      library: { exercises: s.library.exercises.items, sessions: s.library.sessions.items },
      hidden: s.hidden,
      diagrams: s.diagrams,
      templates: s.templates,
      favorites: s.favorites,
      published: s.published,
    });
  }, 1500);
}

// ---------------------------------------------------------------------------
// Cross-tab + lifecycle
// ---------------------------------------------------------------------------

const TAB_ID = Math.random().toString(36).slice(2);
let channel = null;

function announceChange() {
  scheduleCacheWrite();
  try { channel?.postMessage({ type: 'changed', from: TAB_ID }); } catch { /* closed */ }
}

let started = false;
let lastFocusLoad = 0;

// The sign-in email's link points at PlayBall itself
// (/auth/confirm?token_hash=…&type=email) rather than at Supabase's domain —
// a link to an unrelated domain is a strong spam signal. Finish that sign-in
// here, then tidy the URL.
async function finishEmailLinkSignIn() {
  const url = new URL(window.location.href);
  const tokenHash = url.searchParams.get('token_hash');
  if (!tokenHash) return;
  const type = url.searchParams.get('type') || 'email';
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  window.history.replaceState({}, '', '/');
  if (error) toast(`That sign-in link didn't work (${error.message}). Request a new code.`, 5000);
}

export async function startStore() {
  if (started) return;
  started = true;

  if (supabase) {
    await finishEmailLinkSignIn();
    const { data } = await supabase.auth.getSession();
    setAuthSession(data?.session);
    supabase.auth.onAuthStateChange((event, session) => {
      const prev = currentUser()?.id || null;
      setAuthSession(session);
      const next = session?.user?.id || null;
      if (prev !== next) resetStore(); // signed in, out, or switched account
    });
  }
  restoreDrafts();

  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel('playball-v3');
    channel.onmessage = (e) => {
      if (e.data?.type === 'changed' && e.data.from !== TAB_ID) scheduleReload();
    };
  }

  const refresh = () => {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastFocusLoad < 3000) return;
    lastFocusLoad = Date.now();
    load();
  };
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('focus', refresh);
  window.addEventListener('online', () => load());

  // Unsaved session-builder drafts survive a reload (sessionStorage), but not
  // closing the tab — warn before that.
  window.addEventListener('beforeunload', (e) => {
    if (hasDirtyDrafts() || state.pendingWrites > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  load();
}

// Identity changed (sync turned on, device paired/unpaired): start over.
export function resetStore() {
  generation += 1;
  loadPromise = null;
  clearTimeout(reloadTimer);
  overrides.clear();
  queues.clear();
  setState({ ...EMPTY, drafts: {} });
  persistDrafts();
  return load();
}

// Demo: sample data to click around in before signing up. Edits apply in
// this tab only and vanish on reload; nothing touches the server.
export function startDemo(snapshot) {
  overrides.clear();
  queues.clear();
  setState({ ...EMPTY, ...stateFromSnapshot(snapshot), status: 'ready', source: 'demo', demo: true, drafts: {} });
}

export function endDemo() {
  setState({ ...EMPTY, drafts: {} });
  return load();
}

// ---------------------------------------------------------------------------
// Immediate writes (everything except session-builder drafts)
// ---------------------------------------------------------------------------

// key → { inflight, again, patch, waiters }
const queues = new Map();

function queueFor(key) {
  let q = queues.get(key);
  if (!q) { q = { inflight: false, again: false, patch: {}, waiters: [] }; queues.set(key, q); }
  return q;
}

// Resolves once no write for `key` is in flight.
function settle(key) {
  const q = queues.get(key);
  if (!q || !q.inflight) return Promise.resolve();
  return new Promise(resolve => q.waiters.push(resolve));
}

function bumpPending(delta) {
  setState({ pendingWrites: Math.max(0, state.pendingWrites + delta) });
}

function describe(e) {
  if (e.status === 0) return navigator.onLine ? 'network error' : "you're offline";
  if (e.status === 428) return 'PlayBall was updated — reload the page';
  return e.message || `error ${e.status}`;
}

// Optimistically put `entity` locally and persist it. `patch` is the set of
// fields this call changed; on a 409 those are re-applied over the live row.
// Callers that hand over a whole entity (library items, diagrams, templates)
// changed only the fields that differ from the current copy — rebasing must
// not replay the rest, or a stale field would undo another tab's edit.
function changedFields(before, after) {
  if (!before) return after;
  const out = {};
  for (const k of Object.keys(after)) {
    if (JSON.stringify(after[k]) !== JSON.stringify(before[k])) out[k] = after[k];
  }
  return out;
}

function upsert(kind, entity, ctx = {}, patch = null) {
  const key = `${kind}:${entity.id}`;
  if (state.demo) { setState(withPut(state, kind, { ...entity, version: entity.version ?? 1 }, ctx)); return; }
  if (!patch) patch = changedFields(getLocal(state, kind, entity.id, ctx), entity);
  setState(withPut(state, kind, entity, ctx));
  overrides.set(key, { kind, ctx, op: 'put', entity: getLocal(state, kind, entity.id, ctx) });
  const q = queueFor(key);
  const { sessions: _s, games: _g, version: _v, ...fields } = patch;
  q.patch = { ...q.patch, ...fields };
  pump(key);
}

async function pump(key) {
  const q = queueFor(key);
  if (q.inflight) { q.again = true; return; }
  q.inflight = true;
  bumpPending(1);
  let conflicts = 0;
  let wrote = false;

  for (;;) {
    // The server rejects a session for a team it hasn't stored yet.
    const pending = overrides.get(key);
    if (pending?.kind === 'session') await settle(`team:${pending.ctx.teamId}`);
    q.again = false;
    const o = overrides.get(key);
    if (!o || o.op !== 'put') break;
    const cfg = KINDS[o.kind];
    const local = o.entity;
    const sentPatch = q.patch;
    q.patch = {};
    try {
      const res = await request('PUT', cfg.path(local.id), {
        ...cfg.body(local, o.ctx),
        baseVersion: local.version ?? null,
      });
      wrote = true;
      const saved = res[cfg.resKey];
      // Fields edited while this request was in flight ride on the new version.
      const next = q.again ? { ...saved, ...q.patch, version: saved.version } : saved;
      setState(withPut(state, o.kind, next, o.ctx));
      if (o.kind === 'session') rebaseDraftOnto(local.id, local.version, saved, sentPatch);
      if (!q.again) { overrides.delete(key); break; }
      overrides.set(key, { ...o, entity: getLocal(state, o.kind, local.id, o.ctx) });
    } catch (e) {
      if (e.status === 409 && e.body?.current && conflicts < 3) {
        conflicts += 1;
        const merged = { ...sentPatch, ...q.patch };
        const rebased = { ...e.body.current, ...merged, version: e.body.current.version };
        q.patch = merged;
        setState(withPut(state, o.kind, rebased, o.ctx));
        overrides.set(key, { ...o, entity: getLocal(state, o.kind, local.id, o.ctx) });
        continue;
      }
      overrides.delete(key);
      if (e.status === 410) {
        setState(withRemove(state, o.kind, local.id, o.ctx));
        toast(`That ${LABEL[o.kind]} was deleted somewhere else.`);
      } else {
        toast(`Couldn't save ${LABEL[o.kind]} — ${describe(e)}.`);
        scheduleReload(0); // put the screen back to what the server has
      }
      break;
    }
  }

  q.inflight = false;
  bumpPending(-1);
  if (wrote) announceChange();
  const waiters = q.waiters.splice(0);
  for (const w of waiters) w();
}

async function remove(kind, id, ctx = {}) {
  const key = `${kind}:${id}`;
  const prev = getLocal(state, kind, id, ctx);
  setState(withRemove(state, kind, id, ctx));
  if (state.demo) return;
  overrides.set(key, { kind, ctx, op: 'delete', id, entity: { id } });
  await settle(key);
  bumpPending(1);
  try {
    await request('DELETE', KINDS[kind].path(id));
    announceChange();
  } catch (e) {
    if (prev) setState(withPut(state, kind, prev, ctx));
    toast(`Couldn't delete ${LABEL[kind]} — ${describe(e)}.`);
  } finally {
    overrides.delete(key);
    bumpPending(-1);
  }
}

// ---------------------------------------------------------------------------
// Create-only import (moving a browser's pre-account data into the account)
// ---------------------------------------------------------------------------

// Writes `entity` only if the server has NEVER had a row with this id: an
// existing row (409) is left alone, and a deleted one (410) stays deleted.
// Bypasses the optimistic queue entirely, so nothing is overwritten or
// resurrected and nothing toasts. Call load() afterwards to show results.
// Returns 'created' | 'exists' | 'deleted' | 'forbidden' | 'network' | 'error'.
export async function createIfNew(kind, entity, ctx = {}) {
  const cfg = KINDS[kind];
  try {
    await request('PUT', cfg.path(entity.id), { ...cfg.body(entity, ctx), baseVersion: null });
    return 'created';
  } catch (e) {
    if (e.status === 409) return 'exists';
    if (e.status === 410) return 'deleted';
    if (e.status === 403) return 'forbidden';  // id belongs to another account, or its team is gone
    if (e.status === 0) return 'network';
    console.warn('[import]', kind, entity.id, e);
    return 'error';
  }
}

export async function addFavoriteQuietly(kind, key) {
  try {
    await request('POST', '/api/v2/favorites', { kind, key, favorite: true });
    return 'created';
  } catch (e) {
    return e.status === 0 ? 'network' : 'error';
  }
}

// ---------------------------------------------------------------------------
// Public mutations
// ---------------------------------------------------------------------------

export const teams = {
  create(team) { upsert('team', { ...team, version: null, sessions: team.sessions || [], games: [] }); },
  update(teamId, updates) {
    const cur = findTeam(state, teamId);
    if (!cur) return null;
    const next = { ...cur, ...updates };
    upsert('team', next, {}, updates);
    return next;
  },
  remove(teamId) {
    for (const s of findTeam(state, teamId)?.sessions || []) discardDraft(s.id);
    return remove('team', teamId);
  },
};

export const sessions = {
  // Queued synchronously so an update made right after (template content,
  // a date) coalesces onto the create instead of racing it. The send itself
  // waits for the team's write (see pump).
  create(teamId, session) {
    upsert('session', { ...session, version: null }, { teamId });
  },
  update(teamId, sessionId, updates) {
    const cur = findSession(state, teamId, sessionId);
    if (!cur) return null;
    const next = { ...cur, ...updates };
    upsert('session', next, { teamId }, updates);
    return next;
  },
  remove(teamId, sessionId) {
    discardDraft(sessionId);
    return remove('session', sessionId, { teamId });
  },
};

export const library = {
  putExercise(item) { upsert('exercise', item); },
  removeExercise(id) { return remove('exercise', id); },
  putSession(item) { upsert('libsession', item); },
  removeSession(id) { return remove('libsession', id); },

  async hide(kind, id) {
    const field = kind === 'exercise' ? 'exercises' : 'sessions';
    if (state.hidden[field].includes(id)) return;
    setState({ hidden: { ...state.hidden, [field]: [...state.hidden[field], id] } });
    if (state.demo) return;
    try {
      await request('POST', '/api/v2/library/hidden', { kind, id });
      announceChange();
    } catch (e) {
      setState({ hidden: { ...state.hidden, [field]: state.hidden[field].filter(x => x !== id) } });
      toast(`Couldn't hide that item — ${describe(e)}.`);
    }
  },
  async unhideAll(kind) {
    const field = kind === 'exercise' ? 'exercises' : 'sessions';
    const ids = state.hidden[field];
    setState({ hidden: { ...state.hidden, [field]: [] } });
    if (state.demo) return;
    const results = await Promise.allSettled(ids.map(id =>
      request('DELETE', `/api/v2/library/hidden/${enc(kind)}/${enc(id)}`)
    ));
    if (results.some(r => r.status === 'rejected')) {
      toast("Couldn't unhide everything — reloading.");
      scheduleReload(0);
    } else {
      announceChange();
    }
  },
};

export const diagrams = {
  put(diagram) { upsert('diagram', diagram); },
  remove(id) { return remove('diagram', id); },
};

export const templates = {
  put(template) { upsert('template', template); },
  remove(id) { return remove('template', id); },
};

// ---------------------------------------------------------------------------
// Community publishing (see api/v2.js → routePublic)
// ---------------------------------------------------------------------------

export function findPublished(s, kind, sourceId) {
  return s.published.find(p => p.kind === kind && p.sourceId === sourceId) || null;
}

// Publish (or update the public copy of) one of my items. The server keeps
// only text + vector diagram data from `payload`. Returns { ok } | { error }.
export async function publishItem(kind, sourceId, { title, tags, payload }) {
  if (state.demo) return { error: 'Create a free account to publish to the Community.' };
  try {
    const res = await request('POST', '/api/v2/public', { kind, sourceId, title, tags, payload });
    const others = state.published.filter(p => !(p.kind === kind && p.sourceId === sourceId));
    setState({ published: [...others, res.item] });
    announceChange();
    return { ok: true, item: res.item };
  } catch (e) {
    return { error: e.body?.message || describe(e) };
  }
}

export async function unpublishItem(kind, sourceId) {
  const item = findPublished(state, kind, sourceId);
  if (!item) return { ok: true };
  const before = state.published;
  setState({ published: before.filter(p => p.id !== item.id) });
  try {
    await request('DELETE', `/api/v2/public/${enc(item.id)}`);
    announceChange();
    return { ok: true };
  } catch (e) {
    setState({ published: before });
    return { error: describe(e) };
  }
}

// kind: 'session' | 'exercise' | 'diagram'
export async function setFavorite(kind, key, favorite) {
  const field = `${kind}s`;
  const before = state.favorites[field] || [];
  const after = favorite ? [...new Set([...before, key])] : before.filter(k => k !== key);
  setState({ favorites: { ...state.favorites, [field]: after } });
  if (state.demo) return;
  try {
    await request('POST', '/api/v2/favorites', { kind, key, favorite });
    announceChange();
  } catch (e) {
    setState({ favorites: { ...state.favorites, [field]: before } });
    toast(`Couldn't update favorites — ${describe(e)}.`);
  }
}

// ---------------------------------------------------------------------------
// Session-builder drafts (explicit Save)
// ---------------------------------------------------------------------------

const DRAFTS_KEY = 'ppp_drafts_v3';

function persistDrafts() {
  if (state.demo) return;
  try {
    const keys = Object.keys(state.drafts);
    if (keys.length === 0) sessionStorage.removeItem(DRAFTS_KEY);
    else sessionStorage.setItem(DRAFTS_KEY, JSON.stringify({ owner: identityKey(), drafts: state.drafts }));
  } catch (e) {
    console.warn('[store] could not persist drafts', e);
  }
}

function restoreDrafts() {
  try {
    const raw = sessionStorage.getItem(DRAFTS_KEY);
    if (!raw) return;
    const { owner, drafts } = JSON.parse(raw);
    if (owner && owner === identityKey() && drafts) setState({ drafts });
  } catch { /* ignore */ }
}

// Fields that are view state or server-assigned, not content.
function contentOf(session) {
  const { selectedSectionId: _sel, updatedAt: _u, version: _v, ...rest } = session || {};
  return JSON.stringify(rest);
}

export function getDraft(sessionId) {
  return state.drafts[sessionId] || null;
}

export function isDraftDirty(sessionId) {
  const d = state.drafts[sessionId];
  return Boolean(d) && contentOf(d.value) !== contentOf(d.base);
}

export function hasDirtyDrafts() {
  return Object.keys(state.drafts).some(isDraftDirty);
}

// True when the server copy moved on since this draft was started.
export function isDraftStale(sessionId) {
  const d = state.drafts[sessionId];
  if (!d) return false;
  const live = findSession(state, d.teamId, sessionId);
  return Boolean(live && d.base.version != null && live.version !== d.base.version);
}

export function editDraft(teamId, sessionId, updater) {
  const d = state.drafts[sessionId];
  const base = d?.base ?? findSession(state, teamId, sessionId);
  if (!base) return;
  const cur = d?.value ?? base;
  const value = typeof updater === 'function' ? updater(cur) : { ...cur, ...updater };
  setState({ drafts: { ...state.drafts, [sessionId]: { teamId, base, value } } });
  persistDrafts();
}

export function discardDraft(sessionId) {
  if (!state.drafts[sessionId]) return;
  const { [sessionId]: _gone, ...rest } = state.drafts;
  setState({ drafts: rest });
  persistDrafts();
}

// An immediate session write (e.g. rescheduling from the team page) landed
// while a draft is open on the same session: move the draft's base forward
// and carry the change into it, so Save doesn't report a false conflict.
function rebaseDraftOnto(sessionId, sentVersion, saved, patch) {
  const d = state.drafts[sessionId];
  if (!d || d.base.version !== sentVersion) return;
  setState({ drafts: { ...state.drafts, [sessionId]: { ...d, base: saved, value: { ...d.value, ...patch, version: saved.version } } } });
  persistDrafts();
}

// Write the draft as one compare-and-set. Returns
//   { ok: true } | { conflict: true, current } | { gone: true } | { error }
// `overwrite: true` saves over whatever is on the server now.
export async function saveDraft(sessionId, { overwrite = false } = {}) {
  const d = state.drafts[sessionId];
  if (!d) return { ok: true };
  if (!isDraftDirty(sessionId)) { discardDraft(sessionId); return { ok: true }; }
  if (state.demo) {
    setState(withPut(state, 'session', d.value, { teamId: d.teamId }));
    discardDraft(sessionId);
    return { ok: true };
  }

  await settle(`session:${sessionId}`);
  const live = findSession(state, d.teamId, sessionId);
  if (!live) return { gone: true };
  const baseVersion = overwrite || d.base.version == null ? live.version : d.base.version;

  const latest = state.drafts[sessionId];
  if (!latest) return { ok: true };
  bumpPending(1);
  try {
    const res = await request('PUT', KINDS.session.path(sessionId), {
      ...sessionBody(latest.value, d.teamId),
      baseVersion: baseVersion ?? null,
    });
    setState(withPut(state, 'session', res.session, { teamId: d.teamId }));
    discardDraft(sessionId);
    announceChange();
    return { ok: true };
  } catch (e) {
    if (e.status === 409 && e.body?.current) {
      setState(withPut(state, 'session', e.body.current, { teamId: d.teamId }));
      return { conflict: true, current: e.body.current };
    }
    if (e.status === 410) return { gone: true };
    return { error: describe(e) };
  } finally {
    bumpPending(-1);
  }
}
