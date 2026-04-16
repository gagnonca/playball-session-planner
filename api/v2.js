import { put } from '@vercel/blob';
import { supabase } from './_lib/supabase.js';
import { verifyDevice, sendError } from './_lib/auth.js';
import { redis } from './_lib/redis.js';
import { mirrorTeamsBlob, mirrorLibraryBlob } from './_lib/dualWrite.js';

// Routed via vercel.json rewrite: /api/v2/:slug* → /api/v2?slug=:slug*

// Single catch-all router for all new per-entity endpoints (Hobby plan: 12
// function limit). Replaces what would otherwise be ~15 separate route files.
//
// Routes (all under /api/v2):
//   GET    /coaches/:coachId                 bootstrap
//   GET    /teams                            list
//   PUT    /teams/:id                        upsert
//   DELETE /teams/:id
//   GET    /sessions                         list (optionally ?teamId=)
//   PUT    /sessions/:id                     upsert
//   DELETE /sessions/:id
//   GET    /library/exercises                list
//   PUT    /library/exercises/:id            upsert
//   DELETE /library/exercises/:id
//   GET    /library/sessions                 list
//   PUT    /library/sessions/:id             upsert
//   DELETE /library/sessions/:id
//   GET    /library/hidden                   list
//   POST   /library/hidden                   add   body: { kind, id }
//   DELETE /library/hidden/:kind/:id
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

    const auth = await verifyDevice(req);
    if (!auth.ok) return res.status(auth.status).json(auth.body);

    if (root === 'coaches') return routeCoach(a, req, res, auth);
    if (root === 'teams') return routeTeams(a, req, res, auth);
    if (root === 'sessions') return routeSessions(a, req, res, auth);
    if (root === 'diagrams') return routeDiagrams(a, req, res, auth);
    if (root === 'library') return routeLibrary(a, b, c, req, res, auth);

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

// ---------- teams ----------

async function routeTeams(id, req, res, auth) {
  if (!id) {
    if (req.method !== 'GET') return sendError(res, 405, 'method_not_allowed');
    const { data, error } = await supabase
      .from('teams').select('*').eq('coach_id', auth.coachId).is('deleted_at', null);
    if (error) return sendError(res, 500, 'server_error');
    return res.status(200).json({ success: true, teams: data });
  }

  if (req.method === 'PUT') {
    const { name, ageGroup, defaultDuration, sharing } = req.body || {};
    if (!name) return sendError(res, 400, 'missing_name');
    const { data, error } = await supabase.from('teams').upsert({
      id,
      coach_id: auth.coachId,
      name,
      age_group: ageGroup ?? null,
      default_duration: defaultDuration ?? null,
      sharing: sharing ?? { isShared: false },
      updated_at: new Date().toISOString(),
    }).select().single();
    if (error) { console.error('[teams.put]', error); return sendError(res, 500, 'server_error'); }
    return res.status(200).json({ success: true, team: data });
  }

  if (req.method === 'DELETE') {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('teams')
      .update({ deleted_at: now, updated_at: now })
      .eq('id', id).eq('coach_id', auth.coachId);
    if (error) return sendError(res, 500, 'server_error');
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
    return res.status(200).json({ success: true, sessions: data });
  }

  if (req.method === 'PUT') {
    const { teamId, summary, sections, isTemplate } = req.body || {};
    if (!teamId || !summary) return sendError(res, 400, 'missing_fields');

    const { data: team, error: teamErr } = await supabase
      .from('teams').select('id')
      .eq('id', teamId).eq('coach_id', auth.coachId)
      .maybeSingle();
    if (teamErr) return sendError(res, 500, 'server_error');
    if (!team) return sendError(res, 403, 'team_not_owned');

    // Upload any inline base64 diagram images to CDN before persisting
    const cleanSections = await stripBase64FromSections(sections ?? []);

    const { data, error } = await supabase.from('sessions').upsert({
      id,
      team_id: teamId,
      coach_id: auth.coachId,
      summary,
      sections: cleanSections,
      is_template: !!isTemplate,
      updated_at: new Date().toISOString(),
    }).select().single();
    if (error) { console.error('[sessions.put]', error); return sendError(res, 500, 'server_error'); }
    return res.status(200).json({ success: true, session: data });
  }

  if (req.method === 'DELETE') {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('sessions')
      .update({ deleted_at: now, updated_at: now })
      .eq('id', id).eq('coach_id', auth.coachId);
    if (error) return sendError(res, 500, 'server_error');
    await touchCoach(auth.coachId);
    return res.status(200).json({ success: true });
  }

  return sendError(res, 405, 'method_not_allowed');
}

// ---------- diagrams ----------

async function routeDiagrams(id, req, res, auth) {
  if (!id) {
    if (req.method !== 'GET') return sendError(res, 405, 'method_not_allowed');
    const { data, error } = await supabase
      .from('diagrams').select('*').eq('coach_id', auth.coachId).is('deleted_at', null);
    if (error) return sendError(res, 500, 'server_error');
    return res.status(200).json({ success: true, diagrams: data });
  }

  if (req.method === 'PUT') {
    const { name, payload } = req.body || {};
    if (!payload) return sendError(res, 400, 'missing_payload');
    const { data, error } = await supabase.from('diagrams').upsert({
      id,
      coach_id: auth.coachId,
      name: name ?? null,
      payload,
      updated_at: new Date().toISOString(),
    }).select().single();
    if (error) { console.error('[diagrams.put]', error); return sendError(res, 500, 'server_error'); }
    return res.status(200).json({ success: true, diagram: data });
  }

  if (req.method === 'DELETE') {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('diagrams')
      .update({ deleted_at: now, updated_at: now })
      .eq('id', id).eq('coach_id', auth.coachId);
    if (error) return sendError(res, 500, 'server_error');
    await touchCoach(auth.coachId);
    return res.status(200).json({ success: true });
  }

  return sendError(res, 405, 'method_not_allowed');
}

// ---------- library ----------

async function routeLibrary(kind, a, b, req, res, auth) {
  if (kind === 'exercises') return libraryItemRoute('library_exercises', 'exercise', a, req, res, auth);
  if (kind === 'sessions') return libraryItemRoute('library_sessions', 'session', a, req, res, auth);
  if (kind === 'hidden') return libraryHiddenRoute(a, b, req, res, auth);
  return sendError(res, 404, 'not_found');
}

async function libraryItemRoute(table, tag, id, req, res, auth) {
  if (!id) {
    if (req.method !== 'GET') return sendError(res, 405, 'method_not_allowed');
    const { data, error } = await supabase
      .from(table).select('*').eq('coach_id', auth.coachId).is('deleted_at', null);
    if (error) return sendError(res, 500, 'server_error');
    return res.status(200).json({ success: true, items: data });
  }

  if (req.method === 'PUT') {
    const { name, type, tags, payload } = req.body || {};
    if (!name || !payload) return sendError(res, 400, 'missing_fields');
    const row = {
      id, coach_id: auth.coachId,
      name,
      tags: tags ?? {},
      payload,
      updated_at: new Date().toISOString(),
    };
    if (table === 'library_exercises') row.type = type ?? null;
    const { data, error } = await supabase.from(table).upsert(row).select().single();
    if (error) { console.error(`[${tag}.put]`, error); return sendError(res, 500, 'server_error'); }
    return res.status(200).json({ success: true, item: data });
  }

  if (req.method === 'DELETE') {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from(table)
      .update({ deleted_at: now, updated_at: now })
      .eq('id', id).eq('coach_id', auth.coachId);
    if (error) return sendError(res, 500, 'server_error');
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
