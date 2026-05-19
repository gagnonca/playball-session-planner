import { supabase } from './supabase.js';

// Reconstruct the legacy Redis blob shape from Postgres rows.
// Called by the read-bridge in sync/teams.js and sync/library.js so the app
// sees backup-imported data without any client change.

export async function buildTeamsBlob(coachId) {
  const [coachRes, teamsRes, sessionsRes, gamesRes] = await Promise.all([
    supabase.from('coaches').select('*').eq('coach_id', coachId).maybeSingle(),
    supabase.from('teams').select('*').eq('coach_id', coachId).is('deleted_at', null),
    supabase.from('sessions').select('*').eq('coach_id', coachId).is('deleted_at', null),
    supabase.from('games').select('*').eq('coach_id', coachId).is('deleted_at', null),
  ]);

  if (coachRes.error || teamsRes.error || sessionsRes.error || gamesRes.error) {
    console.error('[pgToBlob.teams]', coachRes.error || teamsRes.error || sessionsRes.error || gamesRes.error);
    return null;
  }
  if (!coachRes.data) return null;

  const sessionsByTeam = new Map();
  for (const s of sessionsRes.data) {
    const list = sessionsByTeam.get(s.team_id) || [];
    // Reassemble session: spread summary, then id/sections/isTemplate back on
    // top. Also surface the DB row's updated_at as updatedAt — clients use it
    // to sort "most-recent first" and without it any synced session falls
    // back to undefined → NaN compare → unsorted.
    list.push({
      ...(s.summary || {}),
      id: s.id,
      sections: s.sections || [],
      isTemplate: s.is_template,
      updatedAt: s.updated_at,
    });
    sessionsByTeam.set(s.team_id, list);
  }

  const gamesByTeam = new Map();
  for (const g of gamesRes.data || []) {
    const list = gamesByTeam.get(g.team_id) || [];
    // Carry both the table columns the Schedule view reads (id, name, date,
    // is_home) and the full payload so consumers can show captain / available
    // players without an extra fetch.
    list.push({
      id: g.id,
      name: g.name,
      date: g.date,
      is_home: g.is_home,
      payload: g.payload || {},
      updatedAt: g.updated_at,
    });
    gamesByTeam.set(g.team_id, list);
  }

  const teams = (teamsRes.data || []).map(t => ({
    id: t.id,
    name: t.name,
    ageGroup: t.age_group ?? '',
    defaultDuration: t.default_duration ?? '',
    sharing: t.sharing || { isShared: false },
    iosShareCode: t.ios_share_code ?? null,
    players: Array.isArray(t.players) ? t.players : [],
    sessions: sessionsByTeam.get(t.id) || [],
    games: gamesByTeam.get(t.id) || [],
  }));

  // Latest updated_at across all rows (for freshness comparison).
  const stamps = [
    coachRes.data.updated_at,
    ...(teamsRes.data || []).map(t => t.updated_at),
    ...(sessionsRes.data || []).map(s => s.updated_at),
    ...(gamesRes.data || []).map(g => g.updated_at),
  ].filter(Boolean);
  const lastUpdatedAt = stamps.length ? stamps.sort().at(-1) : null;

  return {
    coach: coachRes.data,
    teams,
    defaultTeamId: coachRes.data.default_team_id || null,
    lastUpdatedAt,
  };
}

export async function buildLibraryBlob(coachId) {
  const [exRes, sessRes] = await Promise.all([
    supabase.from('library_exercises').select('*').eq('coach_id', coachId).is('deleted_at', null),
    supabase.from('library_sessions').select('*').eq('coach_id', coachId).is('deleted_at', null),
  ]);
  if (exRes.error || sessRes.error) {
    console.error('[pgToBlob.library]', exRes.error || sessRes.error);
    return null;
  }

  // Payload column is the pre-split legacy item; return it as-is.
  const exercises = { version: 1, items: (exRes.data || []).map(r => r.payload) };
  const sessions = { version: 1, items: (sessRes.data || []).map(r => r.payload) };

  const stamps = [
    ...(exRes.data || []).map(r => r.updated_at),
    ...(sessRes.data || []).map(r => r.updated_at),
  ].filter(Boolean);
  const lastUpdatedAt = stamps.length ? stamps.sort().at(-1) : null;

  return { library: { exercises, sessions }, lastUpdatedAt };
}
