import { put } from '@vercel/blob';
import { supabase } from './_lib/supabase.js';
import { authenticate, resolveUser, verifyDevice, sendError } from './_lib/auth.js';
import { redis } from './_lib/redis.js';
import { mirrorTeamsBlob, mirrorLibraryBlob } from './_lib/dualWrite.js';
import { versionedWrite, softDelete, readBaseVersion } from './_lib/versioned.js';
import { sanitizePublic, safeTags } from './_lib/publicContent.js';
import { teamFromRow, sessionFromRow, gameFromRow, libraryItemFromRow, diagramFromRow, templateFromRow } from './_lib/shapes.js';

// Routed via vercel.json rewrite: /api/v2/:slug* → /api/v2?slug=:slug*

// Single catch-all router for all new per-entity endpoints (Hobby plan: 12
// function limit). Replaces what would otherwise be ~15 separate route files.
//
// Every PUT is compare-and-set on the row's `version` (see _lib/versioned.js):
// the body carries `baseVersion` — null to create, else the version the
// client last read. Stale writes get 409 + the live row; never a silent
// overwrite. Responses return the written entity in client shape.
//
// Routes (all under /api/v2):
//   GET    /account                          signed-in user + whether they have data
//   POST   /account/claim                    attach (or create) this account's coach
//                                            body: { legacyCoachId?, legacyDeviceId? }
//   DELETE /account                          delete the account and all its data
//   GET    /public                           Community listing (no sign-in) ?kind=&q=&ageGroup=&moment=
//   GET    /public/:id                       one Community item, full (no sign-in)
//   POST   /public                           publish / update   body: { kind, sourceId, title, tags, payload }
//   DELETE /public/:id                       unpublish (owner)
//   POST   /public/:id/add                   count an "add to my team/library"
//   POST   /public/:id/report                report an item     body: { reason }
//   POST   /admin/public-moderate            Bearer MIGRATION_SECRET  body: { id, hidden }
//   GET    /snapshot                         everything the web app renders
//   GET    /coaches/:coachId                 bootstrap
//   GET    /teams                            list
//   PUT    /teams/:id                        upsert
//   DELETE /teams/:id
//   POST   /teams/:id/link-ios               body: { shareCode } — attach an
//                                            iOS-shared (anon) team's games
//                                            to the caller's web team.
//   GET    /sessions                         list (optionally ?teamId=)
//   PUT    /sessions/:id                     upsert
//   DELETE /sessions/:id
//   GET    /games                            list (requires ?teamId=)
//   PUT    /games/:id                        upsert
//   DELETE /games/:id
//   GET    /library/exercises                list
//   PUT    /library/exercises/:id            upsert
//   DELETE /library/exercises/:id
//   GET    /library/sessions                 list
//   PUT    /library/sessions/:id             upsert
//   DELETE /library/sessions/:id
//   GET    /library/hidden                   list
//   POST   /library/hidden                   add   body: { kind, id }
//   DELETE /library/hidden/:kind/:id
//   PUT    /templates/:id                    upsert a session template
//   DELETE /templates/:id
//   POST   /favorites                        body: { kind, key, favorite: bool }
//   GET    /diagrams                         list
//   PUT    /diagrams/:id                     upsert
//   DELETE /diagrams/:id
//   POST   /admin/migrate                    Bearer MIGRATION_SECRET
//   POST   /admin/import-backup              ?coachId=…  Bearer MIGRATION_SECRET
//   POST   /admin/migrate-images             Bearer MIGRATION_SECRET  (one-time base64→CDN)

async function touchCoach(coachId) {
  try {
    await supabase.from('coaches')
      .update({ updated_at: new Date().toISOString() })
      .eq('coach_id', coachId);
  } catch (e) {
    console.warn('[touchCoach]', e);
  }
}

export default async function handler(req, res) {
  const raw = req.query.slug;
  const slug = Array.isArray(raw)
    ? raw
    : typeof raw === 'string' && raw.length
      ? raw.split('/')
      : [];
  const [root, a, b, c] = slug;

  try {
    // Admin routes (Bearer auth, not device auth)
    if (root === 'admin') return routeAdmin(a, req, res);

    if (root === 'account') return routeAccount(a, req, res);
    if (root === 'public') return routePublic(a, b, req, res);

    const auth = await authenticate(req);
    if (!auth.ok) return res.status(auth.status).json(auth.body);

    if (root === 'snapshot') return routeSnapshot(req, res, auth);
    if (root === 'coaches') return routeCoach(a, req, res, auth);
    if (root === 'teams') return routeTeams(a, b, req, res, auth);
    if (root === 'sessions') return routeSessions(a, req, res, auth);
    if (root === 'games') return routeGames(a, req, res, auth);
    if (root === 'diagrams') return routeDiagrams(a, req, res, auth);
    if (root === 'library') return routeLibrary(a, b, c, req, res, auth);
    if (root === 'templates') return routeTemplates(a, req, res, auth);
    if (root === 'favorites') return routeFavorites(req, res, auth);

    return sendError(res, 404, 'not_found');
  } catch (e) {
    console.error('[v2 router]', slug, e);
    return sendError(res, 500, 'server_error', e.message);
  }
}

// ---------- coaches ----------

async function routeCoach(coachId, req, res, auth) {
  if (req.method !== 'GET') return sendError(res, 405, 'method_not_allowed');
  if (coachId && coachId !== auth.coachId) return sendError(res, 403, 'forbidden');

  const [teamsRes, sessionsRes] = await Promise.all([
    supabase.from('teams').select('*').eq('coach_id', auth.coachId).is('deleted_at', null),
    supabase.from('sessions').select('*').eq('coach_id', auth.coachId).is('deleted_at', null),
  ]);
  if (teamsRes.error || sessionsRes.error) {
    console.error('[bootstrap]', teamsRes.error || sessionsRes.error);
    return sendError(res, 500, 'server_error');
  }
  return res.status(200).json({
    success: true,
    coach: {
      coachId: auth.coach.coach_id,
      devices: auth.coach.devices,
      defaultTeamId: auth.coach.default_team_id,
    },
    teams: teamsRes.data,
    sessions: sessionsRes.data,
  });
}

// ---------- account ----------

const COACH_TABLES = ['public_reports', 'public_items', 'games', 'sessions', 'teams', 'library_exercises', 'library_sessions', 'library_hidden', 'diagrams', 'session_templates', 'favorites'];

async function routeAccount(action, req, res) {
  const user = await resolveUser(req);
  if (!user || user.invalid) return sendError(res, 401, 'not_signed_in', 'Sign in to PlayBall');

  const { data: mine, error } = await supabase
    .from('coaches').select('coach_id').eq('user_id', user.id).maybeSingle();
  if (error) return sendError(res, 500, 'server_error');

  if (!action && req.method === 'GET') {
    return res.status(200).json({
      success: true,
      user: { id: user.id, email: user.email ?? null },
      coachId: mine?.coach_id ?? null,
    });
  }

  if (action === 'claim' && req.method === 'POST') {
    if (mine) return res.status(200).json({ success: true, coachId: mine.coach_id, claimed: false });

    const now = new Date().toISOString();
    const { legacyCoachId, legacyDeviceId } = req.body || {};

    // This browser was device-linked before accounts existed: adopt that
    // coach (and all its data) — but only if no account owns it yet.
    if (legacyCoachId && legacyDeviceId) {
      const legacy = await verifyDevice({ headers: { 'x-coach-id': legacyCoachId, 'x-device-id': legacyDeviceId }, query: {} });
      if (legacy.ok) {
        const { data, error: claimErr } = await supabase
          .from('coaches')
          .update({ user_id: user.id, claimed_at: now, updated_at: now })
          .eq('coach_id', legacyCoachId)
          .is('user_id', null)
          .select('coach_id');
        if (claimErr) return sendError(res, 500, 'server_error');
        if (data?.length === 1) return res.status(200).json({ success: true, coachId: legacyCoachId, claimed: true });
      }
    }

    const coachId = `u:${user.id}`;
    const { error: insErr } = await supabase.from('coaches').insert({
      coach_id: coachId, user_id: user.id, devices: [], claimed_at: now, updated_at: now,
    });
    if (insErr && insErr.code !== '23505') { console.error('[account.claim]', insErr); return sendError(res, 500, 'server_error'); }
    return res.status(200).json({ success: true, coachId, claimed: false, created: true });
  }

  // Delete the account: every row the coach owns, the coach, the auth user.
  if (!action && req.method === 'DELETE') {
    if ((req.body || {}).confirm !== 'DELETE') return sendError(res, 400, 'confirm_required');
    if (mine) {
      for (const table of COACH_TABLES) {
        const { error: delErr } = await supabase.from(table).delete().eq('coach_id', mine.coach_id);
        if (delErr) { console.error('[account.delete]', table, delErr); return sendError(res, 500, 'server_error'); }
      }
      await supabase.from('coaches').delete().eq('coach_id', mine.coach_id);
    }
    const { error: userErr } = await supabase.auth.admin.deleteUser(user.id);
    if (userErr) { console.error('[account.delete.user]', userErr); return sendError(res, 500, 'server_error'); }
    return res.status(200).json({ success: true });
  }

  return sendError(res, 405, 'method_not_allowed');
}

// ---------- public Community ----------

const PUBLIC_KINDS = new Set(['session', 'exercise', 'diagram']);
const AUTO_HIDE_REPORTS = 3;

// Card-sized view of an item: enough to list and preview it.
function publicCard(r) {
  const p = r.payload || {};
  let preview = null;
  if (r.kind === 'diagram') preview = p;
  else if (r.kind === 'exercise') preview = p.diagramData || (p.variations || []).map(v => v.diagramData).find(Boolean) || null;
  else preview = (p.sections || []).map(s => s.diagramData || (s.variations || []).map(v => v.diagramData).find(Boolean)).find(Boolean) || null;
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    tags: r.tags || {},
    preview,
    sectionNames: r.kind === 'session' ? (p.sections || []).map(s => s.name).filter(Boolean).slice(0, 8) : undefined,
    sectionCount: r.kind === 'session' ? (p.sections || []).length : undefined,
    objective: r.kind === 'exercise' ? p.objective : undefined,
    addCount: r.add_count,
    updatedAt: r.updated_at,
  };
}

async function routePublic(id, action, req, res) {
  // Browsing needs no account.
  if (req.method === 'GET' && !id) {
    const { kind, q, ageGroup, moment } = req.query || {};
    let query = supabase.from('public_items').select('*')
      .is('unpublished_at', null).eq('hidden', false)
      .order('updated_at', { ascending: false }).limit(60);
    if (PUBLIC_KINDS.has(kind)) query = query.eq('kind', kind);
    if (ageGroup) query = query.eq('tags->>ageGroup', String(ageGroup));
    if (moment) query = query.eq('tags->>moment', String(moment));
    if (q) query = query.ilike('title', `%${String(q).replace(/[%_]/g, '').slice(0, 60)}%`);
    const { data, error } = await query;
    if (error) { console.error('[public.list]', error); return sendError(res, 500, 'server_error'); }
    return res.status(200).json({ success: true, items: data.map(publicCard) });
  }
  if (req.method === 'GET' && id && !action) {
    const { data, error } = await supabase.from('public_items').select('*')
      .eq('id', id).is('unpublished_at', null).eq('hidden', false).maybeSingle();
    if (error) return sendError(res, 500, 'server_error');
    if (!data) return sendError(res, 404, 'not_found', 'This item is no longer in the Community.');
    return res.status(200).json({ success: true, item: { ...publicCard(data), payload: data.payload } });
  }

  // Everything else needs a signed-in coach.
  const auth = await authenticate(req);
  if (!auth.ok) return res.status(auth.status).json(auth.body);

  if (req.method === 'POST' && !id) {
    const { kind, sourceId, title, tags, payload } = req.body || {};
    if (!PUBLIC_KINDS.has(kind) || !sourceId) return sendError(res, 400, 'missing_fields');
    const clean = sanitizePublic(kind, payload);
    if (!clean) return sendError(res, 400, 'nothing_to_publish', 'Only diagrams drawn in the PlayBall editor can be published.');
    const name = String(title || clean.summary?.title || clean.name || '').trim().slice(0, 120);
    if (!name) return sendError(res, 400, 'missing_title', 'Give it a name before publishing.');
    const now = new Date().toISOString();
    // Re-publishing the same source updates its public copy (same id). A
    // moderator's hide stays in place.
    const { data: existing } = await supabase.from('public_items').select('id')
      .eq('coach_id', auth.coachId).eq('kind', kind).eq('source_id', String(sourceId)).maybeSingle();
    const row = {
      id: existing?.id || `pub_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
      coach_id: auth.coachId, kind, source_id: String(sourceId),
      title: name, tags: safeTags(tags), payload: clean,
      updated_at: now, unpublished_at: null,
      ...(existing ? {} : { published_at: now }),
    };
    const { data, error } = await supabase.from('public_items').upsert(row).select().single();
    if (error) { console.error('[public.publish]', error); return sendError(res, 500, 'server_error'); }
    return res.status(200).json({ success: true, item: { id: data.id, kind, sourceId: data.source_id, title: data.title, hidden: data.hidden, updatedAt: data.updated_at, addCount: data.add_count } });
  }

  if (req.method === 'DELETE' && id && !action) {
    const { error } = await supabase.from('public_items')
      .update({ unpublished_at: new Date().toISOString() })
      .eq('id', id).eq('coach_id', auth.coachId);
    if (error) return sendError(res, 500, 'server_error');
    return res.status(200).json({ success: true });
  }

  if (req.method === 'POST' && id && action === 'add') {
    const { data: item } = await supabase.from('public_items').select('add_count')
      .eq('id', id).is('unpublished_at', null).eq('hidden', false).maybeSingle();
    if (item) await supabase.from('public_items').update({ add_count: (item.add_count || 0) + 1 }).eq('id', id);
    return res.status(200).json({ success: true });
  }

  if (req.method === 'POST' && id && action === 'report') {
    const reason = String(req.body?.reason || '').slice(0, 500);
    const { error } = await supabase.from('public_reports').insert({ item_id: id, coach_id: auth.coachId, reason });
    if (error && error.code !== '23505') { console.error('[public.report]', error); return sendError(res, 500, 'server_error'); }
    if (!error) {
      const { count } = await supabase.from('public_reports').select('id', { count: 'exact', head: true }).eq('item_id', id);
      const reports = count || 0;
      await supabase.from('public_items')
        .update({ report_count: reports, ...(reports >= AUTO_HIDE_REPORTS ? { hidden: true } : {}) })
        .eq('id', id);
    }
    return res.status(200).json({ success: true });
  }

  return sendError(res, 405, 'method_not_allowed');
}

async function adminPublicModerate(req, res) {
  const { id, hidden } = req.body || {};
  if (!id || typeof hidden !== 'boolean') return sendError(res, 400, 'missing_fields');
  const { data, error } = await supabase.from('public_items')
    .update({ hidden, ...(hidden ? {} : { report_count: 0 }) }).eq('id', id).select('id, title, hidden');
  if (error) return sendError(res, 500, 'server_error');
  if (!hidden) await supabase.from('public_reports').delete().eq('item_id', id);
  return res.status(200).json({ success: true, item: data?.[0] || null });
}

// ---------- snapshot ----------

// One round-trip for the whole app: teams (with sessions + games nested the
// way the UI reads them), library, hidden ids, diagrams. The client replaces
// its state with this wholesale — there is no client-side merge.
async function routeSnapshot(req, res, auth) {
  if (req.method !== 'GET') return sendError(res, 405, 'method_not_allowed');
  const c = auth.coachId;
  const live = (table) => supabase.from(table).select('*').eq('coach_id', c).is('deleted_at', null);
  const [teamsR, sessionsR, gamesR, exR, libSessR, hiddenR, diagramsR, templatesR, favoritesR, publishedR] = await Promise.all([
    live('teams'), live('sessions'), live('games'),
    live('library_exercises'), live('library_sessions'),
    supabase.from('library_hidden').select('*').eq('coach_id', c),
    live('diagrams'),
    live('session_templates'),
    supabase.from('favorites').select('*').eq('coach_id', c),
    supabase.from('public_items').select('id, kind, source_id, title, hidden, updated_at, add_count').eq('coach_id', c).is('unpublished_at', null),
  ]);
  const failed = [teamsR, sessionsR, gamesR, exR, libSessR, hiddenR, diagramsR, templatesR, favoritesR, publishedR].find(r => r.error);
  if (failed) { console.error('[snapshot]', failed.error); return sendError(res, 500, 'server_error'); }

  const sessionsByTeam = groupBy(sessionsR.data, 'team_id', sessionFromRow);
  const gamesByTeam = groupBy(gamesR.data, 'team_id', gameFromRow);
  const teams = teamsR.data.map(t => ({
    ...teamFromRow(t),
    sessions: sessionsByTeam.get(t.id) || [],
    games: gamesByTeam.get(t.id) || [],
  }));

  const hidden = { exercises: [], sessions: [] };
  for (const h of hiddenR.data) {
    if (h.entity_kind === 'exercise') hidden.exercises.push(h.entity_id);
    else if (h.entity_kind === 'session') hidden.sessions.push(h.entity_id);
  }

  const favorites = { sessions: [], exercises: [], diagrams: [] };
  for (const f of favoritesR.data) {
    const list = favorites[`${f.kind}s`];
    if (list) list.push(f.key);
  }

  return res.status(200).json({
    success: true,
    coach: { coachId: c, defaultTeamId: auth.coach.default_team_id || null },
    teams,
    library: {
      exercises: exR.data.map(libraryItemFromRow),
      sessions: libSessR.data.map(libraryItemFromRow),
    },
    hidden,
    diagrams: diagramsR.data.map(diagramFromRow),
    templates: templatesR.data.map(templateFromRow),
    favorites,
    published: publishedR.data.map(r => ({
      id: r.id, kind: r.kind, sourceId: r.source_id, title: r.title,
      hidden: r.hidden, updatedAt: r.updated_at, addCount: r.add_count,
    })),
    serverTime: new Date().toISOString(),
  });
}

function groupBy(rows, key, map) {
  const out = new Map();
  for (const r of rows) {
    const list = out.get(r[key]) || [];
    list.push(map(r));
    out.set(r[key], list);
  }
  return out;
}

// Send a versionedWrite result, mapping any returned row to client shape.
function sendWrite(res, result, map, key) {
  const { status, body } = result;
  if (body.row) return res.status(status).json({ success: true, [key]: map(body.row) });
  if (body.current) return res.status(status).json({ ...body, current: map(body.current) });
  return res.status(status).json(body);
}

async function teamOwned(teamId, coachId) {
  const { data, error } = await supabase
    .from('teams').select('id')
    .eq('id', teamId).eq('coach_id', coachId).is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

// ---------- teams ----------

async function routeTeams(id, action, req, res, auth) {
  if (!id) {
    if (req.method !== 'GET') return sendError(res, 405, 'method_not_allowed');
    const { data, error } = await supabase
      .from('teams').select('*').eq('coach_id', auth.coachId).is('deleted_at', null);
    if (error) return sendError(res, 500, 'server_error');
    return res.status(200).json({ success: true, teams: data.map(teamFromRow) });
  }

  if (action === 'link-ios') return linkIosShareToTeam(id, req, res, auth);

  if (req.method === 'PUT') {
    const { name, ageGroup, defaultDuration, sharing, archived } = req.body || {};
    if (!name) return sendError(res, 400, 'missing_name');
    // Web-owned columns only. players / ios_share_code belong to the iOS
    // mirror and link-ios and are never sent from here.
    const result = await versionedWrite('teams', {
      id,
      coachId: auth.coachId,
      baseVersion: readBaseVersion(req.body),
      fields: {
        name,
        age_group: ageGroup ?? null,
        default_duration: defaultDuration ?? null,
        sharing: sharing ?? { isShared: false },
        archived: !!archived,
      },
    });
    return sendWrite(res, result, teamFromRow, 'team');
  }

  if (req.method === 'DELETE') {
    await softDelete('teams', { id, coachId: auth.coachId });
    await touchCoach(auth.coachId);
    return res.status(200).json({ success: true });
  }

  return sendError(res, 405, 'method_not_allowed');
}

// ---------- sessions ----------

async function routeSessions(id, req, res, auth) {
  if (!id) {
    if (req.method !== 'GET') return sendError(res, 405, 'method_not_allowed');
    let q = supabase.from('sessions').select('*').eq('coach_id', auth.coachId).is('deleted_at', null);
    if (req.query.teamId) q = q.eq('team_id', req.query.teamId);
    const { data, error } = await q;
    if (error) return sendError(res, 500, 'server_error');
    return res.status(200).json({ success: true, sessions: data.map(sessionFromRow) });
  }

  if (req.method === 'PUT') {
    const { teamId, summary, sections, isTemplate } = req.body || {};
    if (!teamId || !summary) return sendError(res, 400, 'missing_fields');
    if (!(await teamOwned(teamId, auth.coachId))) return sendError(res, 403, 'team_not_owned');

    // Upload any inline base64 diagram images to CDN before persisting
    const cleanSections = await stripBase64FromSections(sections ?? []);
    const { id: _i, version: _v, updatedAt: _u, sections: _s, isTemplate: _t, ...cleanSummary } = summary;

    const result = await versionedWrite('sessions', {
      id,
      coachId: auth.coachId,
      baseVersion: readBaseVersion(req.body),
      fields: {
        team_id: teamId,
        summary: cleanSummary,
        sections: cleanSections,
        is_template: !!isTemplate,
      },
    });
    return sendWrite(res, result, sessionFromRow, 'session');
  }

  if (req.method === 'DELETE') {
    await softDelete('sessions', { id, coachId: auth.coachId });
    await touchCoach(auth.coachId);
    return res.status(200).json({ success: true });
  }

  return sendError(res, 405, 'method_not_allowed');
}

// ---------- games ----------

async function routeGames(id, req, res, auth) {
  if (!id) {
    if (req.method !== 'GET') return sendError(res, 405, 'method_not_allowed');
    const teamId = req.query.teamId;
    if (!teamId) return sendError(res, 400, 'missing_teamId');
    // Confirm the team belongs to the caller before returning any games.
    if (!(await teamOwned(teamId, auth.coachId))) return sendError(res, 403, 'team_not_owned');

    const { data, error } = await supabase
      .from('games').select('*')
      .eq('team_id', teamId).eq('coach_id', auth.coachId).is('deleted_at', null);
    if (error) return sendError(res, 500, 'server_error');
    return res.status(200).json({ success: true, games: data });
  }

  if (req.method === 'PUT') {
    const { teamId, name, date, isHome, payload } = req.body || {};
    if (!teamId || !name) return sendError(res, 400, 'missing_fields');
    if (!(await teamOwned(teamId, auth.coachId))) return sendError(res, 403, 'team_not_owned');

    const result = await versionedWrite('games', {
      id,
      coachId: auth.coachId,
      baseVersion: readBaseVersion(req.body),
      fields: {
        team_id: teamId,
        name,
        date: date ?? null,
        is_home: !!isHome,
        payload: payload ?? {},
      },
    });
    // Games keep their raw row shape on the wire (TeamGames/GameEditorModal read it).
    return sendWrite(res, result, (row) => row, 'game');
  }

  if (req.method === 'DELETE') {
    await softDelete('games', { id, coachId: auth.coachId });
    await touchCoach(auth.coachId);
    return res.status(200).json({ success: true });
  }

  return sendError(res, 405, 'method_not_allowed');
}

// ---------- link iOS share to an existing web team ----------

// POST /teams/:id/link-ios — body: { shareCode }
// Attach an iOS-shared (anon) team's games to the caller's existing web
// team. Games are reparented to the web team and the share code is stamped
// onto the web team so subsequent team-share/push calls land directly on it.
//
// Refuses if:
//  - the share code doesn't exist
//  - the share code is already owned by a different real coach
//  - the caller's team is already linked to a different share code
async function linkIosShareToTeam(webTeamId, req, res, auth) {
  if (req.method !== 'POST') return sendError(res, 405, 'method_not_allowed');
  const { shareCode } = req.body || {};
  if (!shareCode || typeof shareCode !== 'string') return sendError(res, 400, 'missing_shareCode');

  // Confirm caller owns the target web team.
  const { data: webTeam, error: webErr } = await supabase
    .from('teams').select('id, coach_id, ios_share_code')
    .eq('id', webTeamId).eq('coach_id', auth.coachId).is('deleted_at', null)
    .maybeSingle();
  if (webErr) return sendError(res, 500, 'server_error');
  if (!webTeam) return sendError(res, 404, 'team_not_found');
  if (webTeam.ios_share_code && webTeam.ios_share_code !== shareCode) {
    return sendError(res, 409, 'already_linked', 'This team is already linked to a different iOS share code.');
  }

  // Find the iOS-side team carrying this share code.
  const { data: iosTeam, error: iosErr } = await supabase
    .from('teams').select('id, coach_id')
    .eq('ios_share_code', shareCode).is('deleted_at', null)
    .maybeSingle();
  if (iosErr) return sendError(res, 500, 'server_error');

  const now = new Date().toISOString();

  // No prior team-share/push has landed for this code yet (or its row was
  // deleted). Just stamp the code onto the web team — the next iOS push
  // will land directly here via the mirror.
  if (!iosTeam) {
    const { error: stampErr } = await supabase
      .from('teams')
      .update({ ios_share_code: shareCode, updated_at: now })
      .eq('id', webTeamId).eq('coach_id', auth.coachId);
    if (stampErr) return sendError(res, 500, 'server_error');
    await touchCoach(auth.coachId);
    return res.status(200).json({ success: true, linkedTeamId: webTeamId, gamesTransferred: 0 });
  }

  // Same row already — idempotent.
  if (iosTeam.id === webTeamId) {
    return res.status(200).json({ success: true, linkedTeamId: webTeamId, gamesTransferred: 0 });
  }

  // Owned by another real coach — refuse.
  if (!iosTeam.coach_id.startsWith('anon:')) {
    return sendError(res, 409, 'already_claimed', 'This share code is owned by another coach.');
  }

  const oldCoachId = iosTeam.coach_id;
  const oldTeamId = iosTeam.id;

  // Reparent games from the anon team to the caller's web team. Guard on
  // the old coach_id so a concurrent link cannot double-process.
  const { data: movedGames, error: gamesErr } = await supabase
    .from('games')
    .update({ team_id: webTeamId, coach_id: auth.coachId, updated_at: now })
    .eq('team_id', oldTeamId).eq('coach_id', oldCoachId)
    .select('id');
  if (gamesErr) { console.error('[link-ios.games]', gamesErr); return sendError(res, 500, 'server_error'); }

  // Stamp the share code onto the web team. Clear it from the anon team
  // first so the unique index doesn't collide on the same value.
  const { error: clearErr } = await supabase
    .from('teams')
    .update({ ios_share_code: null, updated_at: now })
    .eq('id', oldTeamId).eq('coach_id', oldCoachId);
  if (clearErr) { console.error('[link-ios.clear]', clearErr); return sendError(res, 500, 'server_error'); }

  const { error: stampErr } = await supabase
    .from('teams')
    .update({ ios_share_code: shareCode, updated_at: now })
    .eq('id', webTeamId).eq('coach_id', auth.coachId);
  if (stampErr) { console.error('[link-ios.stamp]', stampErr); return sendError(res, 500, 'server_error'); }

  // Soft-delete the now-empty anon team and drop the orphaned anon coach.
  await supabase.from('teams')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', oldTeamId).eq('coach_id', oldCoachId);
  await supabase.from('coaches').delete().eq('coach_id', oldCoachId);

  await touchCoach(auth.coachId);
  return res.status(200).json({
    success: true,
    linkedTeamId: webTeamId,
    gamesTransferred: movedGames?.length || 0,
  });
}

// ---------- diagrams ----------

async function routeDiagrams(id, req, res, auth) {
  if (!id) {
    if (req.method !== 'GET') return sendError(res, 405, 'method_not_allowed');
    const { data, error } = await supabase
      .from('diagrams').select('*').eq('coach_id', auth.coachId).is('deleted_at', null);
    if (error) return sendError(res, 500, 'server_error');
    return res.status(200).json({ success: true, diagrams: data.map(diagramFromRow) });
  }

  if (req.method === 'PUT') {
    const { name, payload } = req.body || {};
    if (!payload) return sendError(res, 400, 'missing_payload');
    const { version: _v, updatedAt: _u, ...cleanPayload } = payload;
    const result = await versionedWrite('diagrams', {
      id,
      coachId: auth.coachId,
      baseVersion: readBaseVersion(req.body),
      fields: { name: name ?? null, payload: cleanPayload },
    });
    return sendWrite(res, result, diagramFromRow, 'diagram');
  }

  if (req.method === 'DELETE') {
    await softDelete('diagrams', { id, coachId: auth.coachId });
    await touchCoach(auth.coachId);
    return res.status(200).json({ success: true });
  }

  return sendError(res, 405, 'method_not_allowed');
}

// ---------- session templates ----------

async function routeTemplates(id, req, res, auth) {
  if (!id) return sendError(res, 405, 'method_not_allowed');
  if (req.method === 'PUT') {
    const { name, exerciseIds } = req.body || {};
    if (!name) return sendError(res, 400, 'missing_name');
    const result = await versionedWrite('session_templates', {
      id,
      coachId: auth.coachId,
      baseVersion: readBaseVersion(req.body),
      fields: { name, exercise_ids: Array.isArray(exerciseIds) ? exerciseIds : [] },
    });
    return sendWrite(res, result, templateFromRow, 'template');
  }
  if (req.method === 'DELETE') {
    await softDelete('session_templates', { id, coachId: auth.coachId });
    return res.status(200).json({ success: true });
  }
  return sendError(res, 405, 'method_not_allowed');
}

// ---------- favorites ----------

const FAVORITE_KINDS = new Set(['session', 'exercise', 'diagram']);

// Keys are names (may contain '/'), so they travel in the body, not the path.
async function routeFavorites(req, res, auth) {
  if (req.method !== 'POST') return sendError(res, 405, 'method_not_allowed');
  const { kind, key, favorite } = req.body || {};
  if (!FAVORITE_KINDS.has(kind) || !key) return sendError(res, 400, 'missing_fields');
  const { error } = favorite === false
    ? await supabase.from('favorites').delete().eq('coach_id', auth.coachId).eq('kind', kind).eq('key', String(key))
    : await supabase.from('favorites').upsert({ coach_id: auth.coachId, kind, key: String(key) });
  if (error) return sendError(res, 500, 'server_error');
  return res.status(200).json({ success: true });
}

// ---------- library ----------

async function routeLibrary(kind, a, b, req, res, auth) {
  if (kind === 'exercises') return libraryItemRoute('library_exercises', a, req, res, auth);
  if (kind === 'sessions') return libraryItemRoute('library_sessions', a, req, res, auth);
  if (kind === 'hidden') return libraryHiddenRoute(a, b, req, res, auth);
  return sendError(res, 404, 'not_found');
}

async function libraryItemRoute(table, id, req, res, auth) {
  if (!id) {
    if (req.method !== 'GET') return sendError(res, 405, 'method_not_allowed');
    const { data, error } = await supabase
      .from(table).select('*').eq('coach_id', auth.coachId).is('deleted_at', null);
    if (error) return sendError(res, 500, 'server_error');
    return res.status(200).json({ success: true, items: data.map(libraryItemFromRow) });
  }

  if (req.method === 'PUT') {
    const { name, type, tags, payload } = req.body || {};
    if (!name || !payload) return sendError(res, 400, 'missing_fields');
    const fields = { name, tags: tags ?? {}, payload };
    if (table === 'library_exercises') fields.type = type ?? null;
    const result = await versionedWrite(table, {
      id,
      coachId: auth.coachId,
      baseVersion: readBaseVersion(req.body),
      fields,
    });
    return sendWrite(res, result, libraryItemFromRow, 'item');
  }

  if (req.method === 'DELETE') {
    await softDelete(table, { id, coachId: auth.coachId });
    await touchCoach(auth.coachId);
    return res.status(200).json({ success: true });
  }

  return sendError(res, 405, 'method_not_allowed');
}

async function libraryHiddenRoute(kindOrEmpty, id, req, res, auth) {
  // GET /library/hidden
  if (req.method === 'GET' && !kindOrEmpty) {
    const { data, error } = await supabase
      .from('library_hidden').select('*').eq('coach_id', auth.coachId);
    if (error) return sendError(res, 500, 'server_error');
    return res.status(200).json({ success: true, hidden: data });
  }
  // POST /library/hidden  body: { kind, id }
  if (req.method === 'POST' && !kindOrEmpty) {
    const { kind, id: entityId } = req.body || {};
    if (!kind || !entityId) return sendError(res, 400, 'missing_fields');
    const { error } = await supabase.from('library_hidden').upsert({
      coach_id: auth.coachId, entity_kind: kind, entity_id: entityId,
    });
    if (error) return sendError(res, 500, 'server_error');
    return res.status(200).json({ success: true });
  }
  // DELETE /library/hidden/:kind/:id
  if (req.method === 'DELETE' && kindOrEmpty && id) {
    const { error } = await supabase.from('library_hidden')
      .delete()
      .eq('coach_id', auth.coachId)
      .eq('entity_kind', kindOrEmpty)
      .eq('entity_id', id);
    if (error) return sendError(res, 500, 'server_error');
    return res.status(200).json({ success: true });
  }
  return sendError(res, 405, 'method_not_allowed');
}

// ---------- admin ----------

async function routeAdmin(action, req, res) {
  if (req.method !== 'POST') return sendError(res, 405, 'method_not_allowed');
  const secret = process.env.MIGRATION_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return sendError(res, 401, 'unauthorized');
  }

  if (action === 'public-moderate') return adminPublicModerate(req, res);
  if (action === 'migrate') return adminMigrate(req, res);
  if (action === 'import-backup') return adminImportBackup(req, res);
  if (action === 'migrate-images') return adminMigrateImages(req, res);
  return sendError(res, 404, 'not_found');
}

async function adminMigrate(req, res) {
  const report = {
    coaches: 0, teams: 0, sessions: 0,
    libraryExercises: 0, librarySessions: 0, errors: [],
  };

  await scanAndProcess('coach:*', async (key, data) => {
    const coachId = key.slice('coach:'.length);
    await mirrorTeamsBlob({ coachId, coachData: data });
    report.coaches += 1;
    report.teams += data.teams?.teams?.length || 0;
    for (const t of data.teams?.teams || []) {
      report.sessions += t.sessions?.length || 0;
    }
  }, report);

  await scanAndProcess('library:*', async (key, data) => {
    const coachId = key.slice('library:'.length);
    const library = data?.data || data?.library || data;
    await mirrorLibraryBlob({ coachId, library });
    report.libraryExercises += library?.exercises?.items?.length || 0;
    report.librarySessions += library?.sessions?.items?.length || 0;
  }, report);

  return res.status(200).json({ success: true, report });
}

async function scanAndProcess(match, handleOne, report) {
  let cursor = 0;
  do {
    const result = await redis.scan(cursor, { match, count: 100 });
    const [nextCursor, keys] = Array.isArray(result) ? result : [result.cursor, result.keys];
    cursor = Number(nextCursor);
    for (const key of keys) {
      try {
        const raw = await redis.get(key);
        if (raw == null) continue;
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        await handleOne(key, data);
      } catch (e) {
        console.error('[admin.migrate]', key, e);
        report.errors.push({ key, message: e.message });
      }
    }
  } while (cursor !== 0);
}

async function adminImportBackup(req, res) {
  const coachId = req.query?.coachId;
  if (!coachId) return sendError(res, 400, 'missing_coachId');
  const backup = req.body || {};
  const report = {
    coaches: 0, teams: 0, sessions: 0,
    libraryExercises: 0, librarySessions: 0,
    diagrams: 0, hidden: 0, errors: [],
  };

  const existing = await supabase.from('coaches').select('coach_id').eq('coach_id', coachId).maybeSingle();
  if (!existing.data) {
    await supabase.from('coaches').upsert({
      coach_id: coachId,
      devices: [],
      default_team_id: backup.teams?.defaultTeamId ?? null,
    });
  }
  report.coaches = 1;

  if (backup.teams) {
    await mirrorTeamsBlob({ coachId, coachData: { teams: backup.teams, devices: [] } });
    report.teams = backup.teams?.teams?.length || 0;
    for (const t of backup.teams?.teams || []) {
      report.sessions += t.sessions?.length || 0;
    }
  }

  if (backup.exLib || backup.sessLib) {
    const library = {
      exercises: backup.exLib || { items: [] },
      sessions: backup.sessLib || { items: [] },
    };
    await mirrorLibraryBlob({ coachId, library });
    report.libraryExercises = library.exercises?.items?.length || 0;
    report.librarySessions = library.sessions?.items?.length || 0;
  }

  if (backup.diagrams) {
    const items = Array.isArray(backup.diagrams)
      ? backup.diagrams
      : Object.values(backup.diagrams);
    for (const d of items) {
      if (!d?.id) continue;
      const { error } = await supabase.from('diagrams').upsert({
        id: d.id, coach_id: coachId,
        name: d.name ?? null, payload: d,
        updated_at: d.updatedAt || new Date().toISOString(),
      });
      if (error) report.errors.push({ diagram: d.id, message: error.message });
      else report.diagrams += 1;
    }
  }

  if (backup.hidden) {
    const rows = [];
    for (const id of backup.hidden.exercises || []) {
      rows.push({ coach_id: coachId, entity_kind: 'exercise', entity_id: id });
    }
    for (const id of backup.hidden.sessions || []) {
      rows.push({ coach_id: coachId, entity_kind: 'session', entity_id: id });
    }
    if (rows.length) {
      const { error } = await supabase.from('library_hidden').upsert(rows);
      if (error) report.errors.push({ hidden: true, message: error.message });
      else report.hidden = rows.length;
    }
  }

  return res.status(200).json({ success: true, report });
}

// ---------- image CDN helpers ----------

let uploadCounter = 0;

async function uploadBase64ToCDN(base64) {
  if (!base64 || typeof base64 !== 'string' || !base64.startsWith('data:')) return null;
  try {
    const raw = base64.includes(',') ? base64.split(',')[1] : base64;
    const buf = Buffer.from(raw, 'base64');
    const key = `diagram-${Date.now()}-${++uploadCounter}`;
    const blob = await put(`session-library/${key}.png`, buf, {
      access: 'public',
      contentType: 'image/png',
      allowOverwrite: true,
    });
    return blob.url;
  } catch (e) {
    console.warn('[uploadBase64ToCDN]', e.message);
    return null;
  }
}

// Walk sections AND their variations, replace any base64 imageDataUrl with CDN URL
async function stripBase64FromSections(sections) {
  const out = [];
  for (const section of sections) {
    // Process section-level image
    let sectionImageDataUrl = section.imageDataUrl;
    if (sectionImageDataUrl && sectionImageDataUrl.startsWith('data:')) {
      const cdnUrl = await uploadBase64ToCDN(sectionImageDataUrl);
      sectionImageDataUrl = cdnUrl || '';
    }
    // Process variation images
    const vars = [];
    for (const v of section.variations || []) {
      if (v.imageDataUrl && v.imageDataUrl.startsWith('data:')) {
        const cdnUrl = await uploadBase64ToCDN(v.imageDataUrl);
        vars.push({ ...v, imageDataUrl: cdnUrl || '' });
      } else {
        vars.push(v);
      }
    }
    out.push({ ...section, imageDataUrl: sectionImageDataUrl, variations: vars });
  }
  return out;
}

// ---------- admin: migrate-images ----------

async function adminMigrateImages(req, res) {
  const report = { scanned: 0, uploaded: 0, updated: 0, timedOut: false, errors: [] };
  const DEADLINE = Date.now() + 8000; // stop 2s before Hobby 10s timeout
  const PAGE = 20;
  let from = 0;

  // Only fetch sessions that still have base64 (contains "data:image")
  // Use textSearch on the jsonb sections column to narrow candidates
  outer:
  while (Date.now() < DEADLINE) {
    const { data: rows, error } = await supabase
      .from('sessions')
      .select('id, sections')
      .is('deleted_at', null)
      .range(from, from + PAGE - 1);
    if (error) { report.errors.push({ fetch: true, message: error.message }); break; }
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      if (Date.now() >= DEADLINE) { report.timedOut = true; break outer; }
      report.scanned++;
      let changed = false;
      const sections = row.sections || [];

      for (const section of sections) {
        // Migrate section-level image
        if (Date.now() >= DEADLINE) { report.timedOut = true; break outer; }
        if (section.imageDataUrl && section.imageDataUrl.startsWith('data:')) {
          const cdnUrl = await uploadBase64ToCDN(section.imageDataUrl);
          if (cdnUrl) {
            section.imageDataUrl = cdnUrl;
            report.uploaded++;
            changed = true;
          }
        }
        // Migrate variation images
        for (const v of section.variations || []) {
          if (Date.now() >= DEADLINE) { report.timedOut = true; break outer; }
          if (v.imageDataUrl && v.imageDataUrl.startsWith('data:')) {
            const cdnUrl = await uploadBase64ToCDN(v.imageDataUrl);
            if (cdnUrl) {
              v.imageDataUrl = cdnUrl;
              report.uploaded++;
              changed = true;
            }
          }
        }
      }

      if (changed) {
        const { error: upErr } = await supabase
          .from('sessions')
          .update({ sections, updated_at: new Date().toISOString() })
          .eq('id', row.id);
        if (upErr) {
          report.errors.push({ session: row.id, message: upErr.message });
        } else {
          report.updated++;
        }
      }
    }

    from += PAGE;
    if (rows.length < PAGE) break;
  }

  if (Date.now() >= DEADLINE) report.timedOut = true;
  return res.status(200).json({ success: true, report });
}
