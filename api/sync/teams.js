import { redis } from '../_lib/redis.js';

/**
 * GET/POST /api/sync/teams
 *
 * GET: Fetch teams for a coach
 * Query: ?coachId=xxx&deviceId=xxx
 * Response: { success: true, teams: object, version: number }
 *
 * POST: Push teams update
 * Body: { coachId: string, deviceId: string, teams: object, localVersion: number }
 * Response: { success: true, version: number }
 */
export default async function handler(req, res) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  } else if (req.method === 'POST') {
    return handlePost(req, res);
  } else {
    return res.status(405).json({ success: false, error: 'method_not_allowed' });
  }
}

async function handleGet(req, res) {
  try {
    const { coachId, deviceId } = req.query;

    if (!coachId || !deviceId) {
      return res.status(400).json({
        success: false,
        error: 'missing_params',
        message: 'coachId and deviceId are required'
      });
    }

    // Get coach data
    const coachDataRaw = await redis.get(`coach:${coachId}`);
    if (!coachDataRaw) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Coach not found'
      });
    }

    const coachData = typeof coachDataRaw === 'string'
      ? JSON.parse(coachDataRaw)
      : coachDataRaw;

    // Verify device is linked
    if (!coachData.devices.includes(deviceId)) {
      return res.status(403).json({
        success: false,
        error: 'device_not_linked',
        message: 'Device is not linked to this coach'
      });
    }

    return res.status(200).json({
      success: true,
      teams: coachData.teams,
      version: coachData.teams.version || 1,
      lastUpdatedAt: coachData.lastUpdatedAt
    });
  } catch (error) {
    console.error('Error in GET /api/sync/teams:', error);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to fetch teams'
    });
  }
}

async function handlePost(req, res) {
  try {
    const { coachId, deviceId, teams, localVersion } = req.body;

    if (!coachId || !deviceId || !teams) {
      return res.status(400).json({
        success: false,
        error: 'missing_params',
        message: 'coachId, deviceId, and teams are required'
      });
    }

    // Get coach data
    const coachDataRaw = await redis.get(`coach:${coachId}`);
    if (!coachDataRaw) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Coach not found'
      });
    }

    const coachData = typeof coachDataRaw === 'string'
      ? JSON.parse(coachDataRaw)
      : coachDataRaw;

    // Verify device is linked
    if (!coachData.devices.includes(deviceId)) {
      return res.status(403).json({
        success: false,
        error: 'device_not_linked',
        message: 'Device is not linked to this coach'
      });
    }

    const serverVersion = coachData.teams.version || 1;

    // Check for version conflict
    if (localVersion && localVersion < serverVersion) {
      return res.status(409).json({
        success: false,
        error: 'version_conflict',
        message: 'Server has newer data. Fetch latest before pushing.',
        serverVersion,
        serverTeams: coachData.teams
      });
    }

    // Update teams with incremented version
    const newVersion = serverVersion + 1;
    const now = new Date().toISOString();

    coachData.teams = {
      ...teams,
      version: newVersion
    };
    coachData.lastUpdatedAt = now;

    await redis.set(`coach:${coachId}`, JSON.stringify(coachData));

    return res.status(200).json({
      success: true,
      version: newVersion,
      updatedAt: now
    });
  } catch (error) {
    console.error('Error in POST /api/sync/teams:', error);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to update teams'
    });
  }
}
