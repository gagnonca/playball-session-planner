import { redis } from '../../_lib/redis.js';

/**
 * POST /api/sync/pair/confirm
 * Confirm a pairing code and link a new device to the coach.
 *
 * Request: { code: string, deviceId: string }
 * Response: { success: true, coachId: string, teams: object }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'method_not_allowed' });
  }

  try {
    const { code, deviceId } = req.body;

    if (!code || !deviceId) {
      return res.status(400).json({
        success: false,
        error: 'missing_params',
        message: 'code and deviceId are required'
      });
    }

    // Look up pairing code
    const pairingData = await redis.get(`pairing:${code}`);
    if (!pairingData) {
      return res.status(404).json({
        success: false,
        error: 'invalid_code',
        message: 'Invalid or expired pairing code'
      });
    }

    const { coachId } = typeof pairingData === 'string'
      ? JSON.parse(pairingData)
      : pairingData;

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

    // Add device if not already linked
    if (!coachData.devices.includes(deviceId)) {
      coachData.devices.push(deviceId);
      coachData.lastUpdatedAt = new Date().toISOString();
      await redis.set(`coach:${coachId}`, JSON.stringify(coachData));
    }

    // Delete the pairing code (one-time use)
    await redis.del(`pairing:${code}`);

    return res.status(200).json({
      success: true,
      coachId,
      teams: coachData.teams,
      linkedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in /api/sync/pair/confirm:', error);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to confirm pairing'
    });
  }
}
