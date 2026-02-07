import { redis } from '../_lib/redis.js';

/**
 * POST /api/sync/init
 * Create a new coach identity and initialize cloud storage.
 *
 * Request: { coachId: string, deviceId: string }
 * Response: { success: true, coachId: string }
 */
export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'method_not_allowed' });
  }

  try {
    const { coachId, deviceId } = req.body;

    if (!coachId || !deviceId) {
      return res.status(400).json({
        success: false,
        error: 'missing_params',
        message: 'coachId and deviceId are required'
      });
    }

    // Check if coach already exists
    const existing = await redis.get(`coach:${coachId}`);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'already_exists',
        message: 'Coach ID already exists'
      });
    }

    // Initialize coach data
    const now = new Date().toISOString();
    const coachData = {
      coachId,
      devices: [deviceId],
      teams: { version: 1, teams: [], defaultTeamId: null },
      createdAt: now,
      lastUpdatedAt: now,
    };

    await redis.set(`coach:${coachId}`, JSON.stringify(coachData));

    return res.status(200).json({
      success: true,
      coachId,
      version: 1
    });
  } catch (error) {
    console.error('Error in /api/sync/init:', error);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to initialize coach'
    });
  }
}
