import { redis } from '../_lib/redis.js';

/**
 * POST /api/sync/unlink
 * Remove a device from a coach's linked devices.
 * If no devices remain, purges the coach data entirely.
 *
 * Request: { coachId: string, deviceId: string }
 * Response: { success: true, remainingDevices: number, purged?: boolean }
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

    // Get coach data
    const coachDataStr = await redis.get(`coach:${coachId}`);
    if (!coachDataStr) {
      // Coach doesn't exist - nothing to unlink
      return res.status(200).json({
        success: true,
        remainingDevices: 0,
        purged: true,
        message: 'Coach data not found'
      });
    }

    const coachData = typeof coachDataStr === 'string'
      ? JSON.parse(coachDataStr)
      : coachDataStr;

    // Remove the device from the devices array
    const updatedDevices = (coachData.devices || []).filter(d => d !== deviceId);

    if (updatedDevices.length === 0) {
      // No devices left - purge all coach data
      await redis.del(`coach:${coachId}`);

      return res.status(200).json({
        success: true,
        remainingDevices: 0,
        purged: true,
        message: 'All devices unlinked, coach data purged'
      });
    }

    // Update coach data with remaining devices
    const updatedCoachData = {
      ...coachData,
      devices: updatedDevices,
      lastUpdatedAt: new Date().toISOString(),
    };

    await redis.set(`coach:${coachId}`, JSON.stringify(updatedCoachData));

    return res.status(200).json({
      success: true,
      remainingDevices: updatedDevices.length,
      purged: false
    });
  } catch (error) {
    console.error('Error in /api/sync/unlink:', error);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to unlink device'
    });
  }
}
