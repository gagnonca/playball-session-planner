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

// Mirror an iOS team-share push into Postgres. Source of truth for iOS
// stays in Redis during the transition; this is best-effort additive.
//
// Behavior:
//  - Look up an existing teams row by ios_share_code. If found, keep its
//    coach_id (anon or claimed) — never silently rewrite coach ownership here.
//  - If no row exists yet, create an anon coach (`anon:{code}`) and a new team
//    under it. The web "Link iOS team" flow rewrites coach_id later.
//  - Upsert each incoming game; soft-delete games that disappeared from the push.
export async function mirrorTeamSharePush({ shareCode, team }) {
  try {
    if (!shareCode || !team?.id) return;
    const now = new Date().toISOString();

    // Resolve coach_id: existing team's coach wins; otherwise anon.
    const { data: existingTeam, error: lookupErr } = await supabase
      .from('teams')
      .select('id, coach_id')
      .eq('ios_share_code', shareCode)
      .maybeSingle();
    if (lookupErr) { console.error('[dualWrite.teamShare.lookup]', lookupErr); return; }

    const coachId = existingTeam?.coach_id || `anon:${shareCode}`;
    const teamId = existingTeam?.id || team.id;
    const isAnon = coachId.startsWith('anon:');

    // Only touch the coaches row for anon coaches. Real (claimed) coaches
    // own their devices array and must not be clobbered by a push.
    if (isAnon) {
      const { error: coachErr } = await supabase.from('coaches').upsert({
        coach_id: coachId,
        devices: [],
        updated_at: now,
      });
      if (coachErr) { console.error('[dualWrite.teamShare.coach]', coachErr); return; }
    }

    // Upsert the team row. For anon teams we take the iOS metadata; for
    // a linked (real-coach) team we only refresh updated_at — the web user
    // owns the canonical name / age group / duration and an iOS push must
    // not clobber their edits.
    const teamRow = isAnon
      ? {
          id: teamId,
          coach_id: coachId,
          name: team.name ?? 'Untitled Team',
          age_group: team.ageGroup ?? null,
          default_duration: team.defaultDuration ?? null,
          sharing: team.sharing ?? { isShared: false },
          ios_share_code: shareCode,
          updated_at: now,
        }
      : { id: teamId, coach_id: coachId, updated_at: now };
    const { error: teamErr } = await supabase.from('teams').upsert(teamRow);
    if (teamErr) { console.error('[dualWrite.teamShare.team]', teamErr); return; }

    // Diff incoming games[] against live Postgres rows.
    const incoming = Array.isArray(team.games) ? team.games.filter(g => g?.id) : [];
    const incomingIds = new Set(incoming.map(g => g.id));

    if (incoming.length) {
      const rows = incoming.map(g => ({
        id: g.id,
        team_id: teamId,
        coach_id: coachId,
        name: g.name ?? 'Untitled Game',
        date: g.date ?? null,
        is_home: !!g.isHome,
        payload: g,
        updated_at: now,
        deleted_at: null,
      }));
      const { error: gameErr } = await supabase.from('games').upsert(rows);
      if (gameErr) console.error('[dualWrite.teamShare.games]', gameErr);
    }

    // Soft-delete games that were in Postgres but no longer in the push.
    const { data: liveGames, error: liveErr } = await supabase
      .from('games')
      .select('id')
      .eq('team_id', teamId)
      .is('deleted_at', null);
    if (liveErr) { console.error('[dualWrite.teamShare.liveGames]', liveErr); return; }
    const toDelete = (liveGames || [])
      .map(r => r.id)
      .filter(id => !incomingIds.has(id));
    if (toDelete.length) {
      const { error: delErr } = await supabase
        .from('games')
        .update({ deleted_at: now, updated_at: now })
        .in('id', toDelete);
      if (delErr) console.error('[dualWrite.teamShare.softDelete]', delErr);
    }
  } catch (e) {
    console.error('[dualWrite.mirrorTeamSharePush] threw', e);
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
