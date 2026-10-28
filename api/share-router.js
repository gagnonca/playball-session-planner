import { supabase } from './_lib/supabase.js';
import { authenticate } from './_lib/auth.js';
import { reassembleSession, flattenRichTextFields, inlineCdnImages } from './_lib/sessionForApp.js';

// Routed via vercel.json rewrite: /api/share/:slug* → /api/share-router?slug=:slug*
//
// Reads live from Postgres via teams.sharing->>shareToken. No Redis. No push.
//   GET    /api/share/:token                          → team view
//   DELETE /api/share/:token                          → revoke (owner only)
//   GET    /api/share/:token/sessions                 → lightweight session list
//   GET    /api/share/:token/sessions/:sessionId      → full session (X-PlayBall-Version)
//   GET    /api/share/:token/games                    → games synced from iOS, for the sub schedule

export default async function handler(req, res) {
  const raw = req.query.slug;
  const slug = Array.isArray(raw)
    ? raw
    : typeof raw === 'string' && raw.length
      ? raw.split('/')
      : [];
  const [token, sub, sessionId] = slug;
  if (!token) return send(res, 400, 'missing_token');

  try {
    if (sub === 'sessions' && sessionId) return getSession(req, res, token, sessionId);
    if (sub === 'sessions' && !sessionId) return listSessions(res, token);
    if (sub === 'games' && req.method === 'GET') return listGames(res, token);
    if (!sub) {
      if (req.method === 'GET') return getTeam(res, token);
      if (req.method === 'DELETE') return revoke(req, res, token);
      return send(res, 405, 'method_not_allowed');
    }
    return send(res, 404, 'not_found');
  } catch (e) {
    console.error('[share router]', slug, e);
    return send(res, 500, 'server_error', e.message);
  }
}

async function loadTeamByToken(token) {
  const { data: team, error } = await supabase
    .from('teams')
    .select('id, coach_id, name, age_group, sharing')
    .eq('sharing->>shareToken', token)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) { console.error('[share.loadTeam]', error); return null; }
  if (!team) return null;
  if (!team.sharing?.isShared) return null;
  return team;
}

async function loadSessionsForTeam(teamId, columns = '*') {
  const { data, error } = await supabase
    .from('sessions')
    .select(columns)
    .eq('team_id', teamId)
    .is('deleted_at', null);
  if (error) { console.error('[share.loadSessions]', error); return []; }
  return (data || []).map(reassembleSession)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

async function getTeam(res, token) {
  const team = await loadTeamByToken(token);
  if (!team) return send(res, 404, 'not_found', 'This shared team link is no longer valid.');
  // Lightweight: only fetch id + summary for the team overview
  const sessions = await loadSessionsForTeam(team.id, 'id, summary');
  return res.status(200).json({
    success: true,
    team: {
      teamName: team.name,
      ageGroup: team.age_group || '',
      sessions: sessions.map(s => ({
        id: s.id,
        title: s.summary?.title || s.title || '',
        date: s.summary?.date || s.date || null,
      })).sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    },
  });
}

// The link is a read-only capability, so holding it must not be enough to
// kill it — only the owning coach can revoke.
async function revoke(req, res, token) {
  const auth = await authenticate(req);
  if (!auth.ok) return res.status(auth.status).json(auth.body);
  const team = await loadTeamByToken(token);
  if (!team) return send(res, 404, 'not_found', 'Share not found');
  if (team.coach_id !== auth.coachId) return send(res, 403, 'forbidden', 'Only the team owner can revoke this link');
  const { error } = await supabase
    .from('teams')
    .update({
      sharing: { isShared: false },
      updated_at: new Date().toISOString(),
    })
    .eq('id', team.id);
  if (error) { console.error('[share.revoke]', error); return send(res, 500, 'server_error'); }
  return res.status(200).json({ success: true, message: 'Share link revoked' });
}

async function listSessions(res, token) {
  const team = await loadTeamByToken(token);
  if (!team) return send(res, 404, 'not_found', 'This share code is not valid or has been revoked.');
  // Only fetch id + summary — no sections/diagrams needed for the list view
  const sessions = await loadSessionsForTeam(team.id, 'id, summary');
  return res.status(200).json({
    success: true,
    teamName: team.name,
    ageGroup: team.age_group || '',
    sessions: sessions.map(s => ({
      id: s.id,
      title: s.summary?.title || s.title || '',
      date: s.summary?.date || s.date || null,
    })).sort((a, b) => (b.date || '').localeCompare(a.date || '')),
  });
}

// Games the coach's iOS app syncs to this team (see dualWrite
// mirrorTeamSharePush). Only what the read-only sub schedule needs: the web
// builds the plan from these settings the same way the app does
// (src/utils/gamePlan.js).
async function listGames(res, token) {
  const team = await loadTeamByToken(token);
  if (!team) return send(res, 404, 'not_found', 'This share code is not valid or has been revoked.');
  const { data, error } = await supabase
    .from('games')
    .select('id, name, date, is_home, payload')
    .eq('team_id', team.id)
    .is('deleted_at', null);
  if (error) { console.error('[share.listGames]', error); return send(res, 500, 'server_error'); }
  const games = (data || []).map(row => {
    const g = row.payload || {};
    return {
      id: row.id,
      name: row.name || g.name || 'Game',
      date: row.date || g.date || null,
      isHome: g.isHome ?? row.is_home ?? true,
      availablePlayers: (g.availablePlayers || []).map(p => ({ id: p.id, name: p.name, tintHex: p.tintHex })),
      substitutionStyle: g.substitutionStyle,
      playersOnField: g.playersOnField,
      subsPerInterval: g.subsPerInterval ?? null,
      subsPerHalf: g.subsPerHalf ?? null,
      periodLengthMinutes: g.periodLengthMinutes,
      numberOfPeriods: g.numberOfPeriods,
      customSubInterval: g.customSubInterval ?? null,
      captainID: g.captainID ?? null,
      goalieH1ID: g.goalieH1ID ?? null,
      goalieH2ID: g.goalieH2ID ?? null,
      goaliesPlayOutfield: Boolean(g.goaliesPlayOutfield),
    };
  }).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ success: true, teamName: team.name, games });
}

async function getSession(req, res, token, sessionId) {
  const team = await loadTeamByToken(token);
  if (!team) return send(res, 404, 'not_found', 'This share code is not valid or has been revoked.');

  const { data: row, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('team_id', team.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) { console.error('[share.getSession]', error); return send(res, 500, 'server_error'); }
  if (!row) return send(res, 404, 'session_not_found', 'Session not found in this shared team.');

  const session = reassembleSession(row);

  // Rich-text fields are stored as HTML; the iOS viewer and the web SharedView
  // both render them as plain text, so flatten HTML to text with bullets/numbers
  // before sending.
  flattenRichTextFields(session.sections || []);

  // iOS app sends X-PlayBall-Version and expects base64 data URIs in imageDataUrl.
  // CDN URLs need to be fetched and inlined for iOS compatibility.
  const isNativeApp = req.headers['x-playball-version'];
  if (isNativeApp) {
    await inlineCdnImages(session.sections || []);
  }

  return res.status(200).json({
    success: true,
    teamName: team.name,
    ageGroup: team.age_group || '',
    session,
  });
}

function send(res, status, error, message) {
  return res.status(status).json({ success: false, error, message });
}
