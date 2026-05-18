import { supabase } from './supabase.js';

// Best-effort mirrors from the Redis blob world into the per-entity Postgres
// tables. Every function swallows errors and logs — dual-write must never
// break a legacy write.

export async function mirrorCoachInit({ coachId, deviceId }) {
  try {
    const { error } = await supabase.from('coaches').upsert({
      coach_id: coachId,
      devices: [deviceId],
      updated_at: new Date().toISOString(),
    });
    if (error) console.error('[dualWrite.mirrorCoachInit]', error);
  } catch (e) {
    console.error('[dualWrite.mirrorCoachInit] threw', e);
  }
}

// Add a device to an existing coach's Postgres devices array. Used by pair
// confirm — without this, the newly-paired device fails verifyDevice (which
// reads from Postgres) on its very next API call.
export async function mirrorDeviceLink({ coachId, deviceId }) {
  try {
    const { data, error } = await supabase
      .from('coaches').select('devices').eq('coach_id', coachId).maybeSingle();
    if (error) { console.error('[dualWrite.mirrorDeviceLink.read]', error); return; }
    const current = Array.isArray(data?.devices) ? data.devices : [];
    if (current.includes(deviceId)) return;
    const next = [...current, deviceId];
    const { error: upErr } = await supabase.from('coaches').upsert({
      coach_id: coachId,
      devices: next,
      updated_at: new Date().toISOString(),
    });
    if (upErr) console.error('[dualWrite.mirrorDeviceLink.upsert]', upErr);
  } catch (e) {
    console.error('[dualWrite.mirrorDeviceLink] threw', e);
  }
}

// Remove a device from a coach's Postgres devices array. Used by unlink.
// Returns the number of devices remaining post-unlink (best-effort).
export async function mirrorDeviceUnlink({ coachId, deviceId }) {
  try {
    const { data, error } = await supabase
      .from('coaches').select('devices').eq('coach_id', coachId).maybeSingle();
    if (error) { console.error('[dualWrite.mirrorDeviceUnlink.read]', error); return null; }
    const current = Array.isArray(data?.devices) ? data.devices : [];
    const next = current.filter(d => d !== deviceId);
    const { error: upErr } = await supabase.from('coaches').upsert({
      coach_id: coachId,
      devices: next,
      updated_at: new Date().toISOString(),
    });
    if (upErr) { console.error('[dualWrite.mirrorDeviceUnlink.upsert]', upErr); return null; }
    return next.length;
  } catch (e) {
    console.error('[dualWrite.mirrorDeviceUnlink] threw', e);
    return null;
  }
}

export async function mirrorTeamsBlob({ coachId, coachData }) {
  try {
    const devices = Array.isArray(coachData.devices) ? coachData.devices : [];
    const defaultTeamId = coachData.teams?.defaultTeamId ?? null;
    const teams = Array.isArray(coachData.teams?.teams) ? coachData.teams.teams : [];
    const now = new Date().toISOString();

    const teamRows = [];
    const sessionRows = [];
    for (const team of teams) {
      if (!team?.id) continue;
      teamRows.push({
        id: team.id,
        coach_id: coachId,
        name: team.name ?? 'Untitled Team',
        age_group: team.ageGroup ?? null,
        default_duration: team.defaultDuration ?? null,
        sharing: team.sharing ?? { isShared: false },
        updated_at: now,
      });
      const sessions = Array.isArray(team.sessions) ? team.sessions : [];
      for (const session of sessions) {
        if (!session?.id) continue;
        const { id, sections, isTemplate, ...summary } = session;
        sessionRows.push({
          id,
          team_id: team.id,
          coach_id: coachId,
          summary,
          sections: sections ?? [],
          is_template: !!isTemplate,
          updated_at: now,
        });
      }
    }

    const keepTeamIds = teamRows.map(t => t.id);
    const keepSessionIds = sessionRows.map(s => s.id);

    const delTeams = keepTeamIds.length
      ? supabase.from('teams').delete().eq('coach_id', coachId).not('id', 'in', `(${keepTeamIds.join(',')})`)
      : supabase.from('teams').delete().eq('coach_id', coachId);
    const delSessions = keepSessionIds.length
      ? supabase.from('sessions').delete().eq('coach_id', coachId).not('id', 'in', `(${keepSessionIds.join(',')})`)
      : supabase.from('sessions').delete().eq('coach_id', coachId);

    const [coachRes, teamsRes, sessionsRes, delTeamsRes, delSessionsRes] = await Promise.all([
      supabase.from('coaches').upsert({
        coach_id: coachId,
        devices,
        default_team_id: defaultTeamId,
        updated_at: now,
      }),
      teamRows.length ? supabase.from('teams').upsert(teamRows) : Promise.resolve({ error: null }),
      sessionRows.length ? supabase.from('sessions').upsert(sessionRows) : Promise.resolve({ error: null }),
      delTeams,
      delSessions,
    ]);
    if (coachRes.error) console.error('[dualWrite.coaches]', coachRes.error);
    if (teamsRes.error) console.error('[dualWrite.teams]', teamsRes.error);
    if (sessionsRes.error) console.error('[dualWrite.sessions]', sessionsRes.error);
    if (delTeamsRes.error) console.error('[dualWrite.teams.delete]', delTeamsRes.error);
    if (delSessionsRes.error) console.error('[dualWrite.sessions.delete]', delSessionsRes.error);
  } catch (e) {
    console.error('[dualWrite.mirrorTeamsBlob] threw', e);
  }
}

export async function mirrorLibraryBlob({ coachId, library }) {
  try {
    const now = new Date().toISOString();
    const exercises = library?.exercises?.items || [];
    const sessions = library?.sessions?.items || [];

    const exRows = exercises
      .filter(ex => ex?.id)
      .map(ex => ({
        id: ex.id,
        coach_id: coachId,
        name: ex.name ?? 'Untitled',
        type: ex.type ?? null,
        tags: ex.tags ?? {},
        payload: ex,
        updated_at: now,
      }));
    const sessRows = sessions
      .filter(s => s?.id)
      .map(s => ({
        id: s.id,
        coach_id: coachId,
        name: s.name ?? 'Untitled',
        tags: s.tags ?? {},
        payload: s,
        updated_at: now,
      }));

    const keepExIds = exRows.map(r => r.id);
    const keepSessIds = sessRows.map(r => r.id);

    const delEx = keepExIds.length
      ? supabase.from('library_exercises').delete().eq('coach_id', coachId).not('id', 'in', `(${keepExIds.join(',')})`)
      : supabase.from('library_exercises').delete().eq('coach_id', coachId);
    const delSess = keepSessIds.length
      ? supabase.from('library_sessions').delete().eq('coach_id', coachId).not('id', 'in', `(${keepSessIds.join(',')})`)
      : supabase.from('library_sessions').delete().eq('coach_id', coachId);

    const [exRes, sessRes, delExRes, delSessRes] = await Promise.all([
      exRows.length ? supabase.from('library_exercises').upsert(exRows) : Promise.resolve({ error: null }),
      sessRows.length ? supabase.from('library_sessions').upsert(sessRows) : Promise.resolve({ error: null }),
      delEx,
      delSess,
    ]);
    if (exRes.error) console.error('[dualWrite.library_exercises]', exRes.error);
    if (sessRes.error) console.error('[dualWrite.library_sessions]', sessRes.error);
    if (delExRes.error) console.error('[dualWrite.library_exercises.delete]', delExRes.error);
    if (delSessRes.error) console.error('[dualWrite.library_sessions.delete]', delSessRes.error);
  } catch (e) {
    console.error('[dualWrite.mirrorLibraryBlob] threw', e);
  }
}
