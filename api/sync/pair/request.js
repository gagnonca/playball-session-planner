import { redis } from '../../_lib/redis.js';

/**
 * POST /api/sync/pair/request
 * Generate a 6-digit pairing code for device linking.
 * Code expires after 5 minutes.
 *
 * Request: { coachId: string }
 * Response: { success: true, code: string, expiresAt: string }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'method_not_allowed' });
  }

  try {
    const { coachId } = req.body;

    if (!coachId) {
      return res.status(400).json({
        success: false,
        error: 'missing_params',
        message: 'coachId is required'
      });
    }

    // Verify coach exists
    const existing = await redis.get(`coach:${coachId}`);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Coach not found'
      });
    }

    // Generate 6-digit code
    const bytes = new Uint8Array(3);
    crypto.getRandomValues(bytes);
    const num = (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
    const code = String(num % 1000000).padStart(6, '0');

    // Store pairing request with 5-minute TTL
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await redis.set(
      `pairing:${code}`,
      JSON.stringify({ coachId, createdAt: new Date().toISOString() }),
      { ex: 300 } // 5 minutes in seconds
    );

    return res.status(200).json({
      success: true,
      code,
      expiresAt
    });
  } catch (error) {
    console.error('Error in /api/sync/pair/request:', error);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to generate pairing code'
    });
  }
}
