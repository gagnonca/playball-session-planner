import { redis } from '../_lib/redis.js';
import { mirrorDeviceLink } from '../_lib/dualWrite.js';

/**
 * POST /api/sync/pair
 * Handles device pairing in two steps:
 *
 * action=request: Generate a 6-digit pairing code (expires 5 min)
 *   Body: { action: 'request', coachId }
 *   Response: { success: true, code, expiresAt }
 *
 * action=confirm: Confirm a pairing code and link the new device
 *   Body: { action: 'confirm', code, deviceId }
 *   Response: { success: true, coachId, teams, linkedAt }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'method_not_allowed' });
  }

  const { action } = req.body;

  if (action === 'request') {
    return handleRequest(req, res);
  } else if (action === 'confirm') {
    return handleConfirm(req, res);
  } else {
    return res.status(400).json({ success: false, error: 'invalid_action', message: 'action must be request or confirm' });
  }
}

async function handleRequest(req, res) {
  try {
    const { coachId } = req.body;
    if (!coachId) {
      return res.status(400).json({ success: false, error: 'missing_params', message: 'coachId is required' });
    }

    const existing = await redis.get(`coach:${coachId}`);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Coach not found' });
    }

    const bytes = new Uint8Array(3);
    crypto.getRandomValues(bytes);
    const num = (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
    const code = String(num % 1000000).padStart(6, '0');

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await redis.set(
      `pairing:${code}`,
      JSON.stringify({ coachId, createdAt: new Date().toISOString() }),
      { ex: 300 }
    );

    return res.status(200).json({ success: true, code, expiresAt });
  } catch (error) {
    console.error('Error in pair/request:', error);
    return res.status(500).json({ success: false, error: 'server_error', message: 'Failed to generate pairing code' });
  }
}

async function handleConfirm(req, res) {
  try {
    const { code, deviceId } = req.body;
    if (!code || !deviceId) {
      return res.status(400).json({ success: false, error: 'missing_params', message: 'code and deviceId are required' });
    }

    const pairingData = await redis.get(`pairing:${code}`);
    if (!pairingData) {
      return res.status(404).json({ success: false, error: 'invalid_code', message: 'Invalid or expired pairing code' });
    }

    const { coachId } = typeof pairingData === 'string' ? JSON.parse(pairingData) : pairingData;

    const coachDataRaw = await redis.get(`coach:${coachId}`);
    if (!coachDataRaw) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Coach not found' });
    }

    const coachData = typeof coachDataRaw === 'string' ? JSON.parse(coachDataRaw) : coachDataRaw;

    if (!coachData.devices.includes(deviceId)) {
      coachData.devices.push(deviceId);
      coachData.lastUpdatedAt = new Date().toISOString();
      await redis.set(`coach:${coachId}`, JSON.stringify(coachData));
    }

    // Mirror the link into Postgres — verifyDevice reads from there, so without
    // this the new device gets 403 device_not_linked on its very next call and
    // useSync clears the identity locally (sync silently turns back off).
    await mirrorDeviceLink({ coachId, deviceId });

    await redis.del(`pairing:${code}`);

    return res.status(200).json({ success: true, coachId, teams: coachData.teams, linkedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Error in pair/confirm:', error);
    return res.status(500).json({ success: false, error: 'server_error', message: 'Failed to confirm pairing' });
  }
}
