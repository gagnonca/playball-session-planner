import { verifyDevice } from '../_lib/auth.js';
import { buildTeamsBlob } from '../_lib/pgToBlob.js';

// Legacy blob endpoint, kept GET-only for iOS compatibility. Reads Postgres
// directly; no Redis. POST is retired — web writes per-entity via /api/v2/*.

export default async function handler(req, res) {
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') {
    return res.status(410).json({
      success: false,
      error: 'gone',
      message: 'Blob POST retired. Use per-entity PUT/DELETE under /api/v2/teams/* and /api/v2/sessions/*',
    });
  }
  return res.status(405).json({ success: false, error: 'method_not_allowed' });
}

async function handleGet(req, res) {
  try {
    const auth = await verifyDevice(req);
    if (!auth.ok) return res.status(auth.status).json(auth.body);

    const pg = await buildTeamsBlob(auth.coachId);
    if (!pg) {
      return res.status(404).json({ success: false, error: 'not_found' });
    }

    return res.status(200).json({
      success: true,
      teams: {
        teams: pg.teams,
        defaultTeamId: pg.defaultTeamId,
      },
      lastUpdatedAt: pg.lastUpdatedAt,
    });
  } catch (error) {
    console.error('Error in GET /api/sync/teams:', error);
    return res.status(500).json({ success: false, error: 'server_error', message: 'Failed to fetch teams' });
  }
}
