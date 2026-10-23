import { redis } from '../_lib/redis.js';
import { put, del } from '@vercel/blob';
import { mirrorTeamSharePush } from '../_lib/dualWrite.js';

const VALID_CODE = /^[A-Z2-9]{6}$/;

/**
 * POST /api/team-share/push
 *
 * Body: { code, team, trainingShareCode?, mascotImageBase64? }
 *
 * Stores team data in Redis at key team-share:{code}.
 * If mascotImageBase64 is provided, uploads the image to Vercel Blob
 * and stores the CDN URL instead of the raw base64 in Redis.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'method_not_allowed' });
  }

  const { code, team, trainingShareCode, mascotImageBase64 } = req.body;

  if (!code || !VALID_CODE.test(code)) {
    return res.status(400).json({
      success: false,
      error: 'invalid_code',
      message: 'Code must be 6 uppercase alphanumeric characters'
    });
  }

  if (!team || typeof team !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'missing_team',
      message: 'Team data is required'
    });
  }

  try {
    // Clean up old blob if this code already has one (re-push / sync)
    const existing = await redis.get(`team-share:${code}`);
    if (existing) {
      const oldData = typeof existing === 'string' ? JSON.parse(existing) : existing;
      if (oldData.mascotImageUrl) {
        await del(oldData.mascotImageUrl).catch(() => {}); // best-effort
      }
    }

    // Upload mascot image to Vercel Blob if provided
    let mascotImageUrl = null;
    if (mascotImageBase64) {
      try {
        const imageBuffer = Buffer.from(mascotImageBase64, 'base64');
        const blob = await put(`mascots/${code}.jpg`, imageBuffer, {
          access: 'public',
          contentType: 'image/jpeg',
          allowOverwrite: true,
        });
        mascotImageUrl = blob.url;
      } catch (blobError) {
        // Non-fatal — team still saves without image
        console.warn('Blob upload failed, continuing without mascot image:', blobError.message);
      }
    }

    const payload = {
      team,
      ...(trainingShareCode ? { trainingShareCode } : {}),
      ...(mascotImageUrl ? { mascotImageUrl } : {}),
      pushedAt: new Date().toISOString()
    };

    await redis.set(`team-share:${code}`, JSON.stringify(payload));

    // Best-effort Postgres mirror. Never blocks the iOS request — if the
    // mirror throws or rejects, the Redis write above remains the source
    // of truth for iOS-to-iOS sharing.
    await mirrorTeamSharePush({ shareCode: code, team });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/team-share/push:', error);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to push team data'
    });
  }
}
