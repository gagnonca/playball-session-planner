import { verifyDevice } from '../_lib/auth.js';
import { buildLibraryBlob } from '../_lib/pgToBlob.js';

// Legacy blob endpoint, kept GET-only for iOS compatibility. Reads Postgres
// directly; no Redis. POST is retired — web writes per-entity.

export default async function handler(req, res) {
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') {
    return res.status(410).json({
      success: false,
      error: 'gone',
      message: 'Blob POST retired. Use per-entity PUT/DELETE under /api/v2/library/*',
    });
  }
  return res.status(405).json({ success: false, error: 'method_not_allowed' });
}

async function handleGet(req, res) {
  try {
    const auth = await verifyDevice(req);
    if (!auth.ok) return res.status(auth.status).json(auth.body);

    const pg = await buildLibraryBlob(auth.coachId);
    if (!pg) {
      return res.status(200).json({
        success: true,
        library: { exercises: { version: 1, items: [] }, sessions: { version: 1, items: [] } },
        version: 0,
      });
    }

    return res.status(200).json({
      success: true,
      library: pg.library,
      version: 1,
      updatedAt: pg.lastUpdatedAt,
    });
  } catch (error) {
    console.error('Error in GET /api/sync/library:', error);
    return res.status(500).json({ success: false, error: 'server_error' });
  }
}
