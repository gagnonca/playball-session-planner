import { redis } from '../_lib/redis.js';
import { put, del } from '@vercel/blob';
import { randomBytes } from 'node:crypto';
import { mirrorTeamSharePush } from '../_lib/dualWrite.js';

const VALID_CODE = /^[A-Z2-9]{6}$/;

/**
 * POST /api/team-share/push
 *
 * Body: { code, team, trainingShareCode?, mascotImageBase64?, plans? }
 *
 * `plans` (newer iOS builds): { [gameId]: { shifts } } — the sub plan the
 * phone shows for each game, which it may not store on the game itself. Kept
 * beside the team (never inside it) so importing devices are unaffected.
 *
 * Every shared team also gets a read-only `viewToken` for the web sub
 * schedule (/shared/games/<viewToken>). Unlike the code, it can't be used to
 * push, so it's safe to hand to a helper.
 *
 * Stores team data in Redis at key team-share:{code}.
 * If mascotImageBase64 is provided, uploads the image to Vercel Blob
 * and stores the CDN URL instead of the raw base64 in Redis.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'method_not_allowed' });
  }

  const { code, team, trainingShareCode, mascotImageBase64, plans } = req.body;

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
    const oldData = existing ? (typeof existing === 'string' ? JSON.parse(existing) : existing) : null;
    if (oldData) {
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

    const viewToken = oldData?.viewToken || randomBytes(12).toString('base64url');
    const payload = {
      team,
      ...(trainingShareCode ? { trainingShareCode } : {}),
      ...(mascotImageUrl ? { mascotImageUrl } : {}),
      plans: mergePlans(oldData?.plans, plans, team),
      viewToken,
      pushedAt: new Date().toISOString()
    };

    await redis.set(`team-share:${code}`, JSON.stringify(payload));
    if (!oldData?.viewToken) await redis.set(`team-view:${viewToken}`, code);

    // Best-effort Postgres mirror. Never blocks the iOS request — if the
    // mirror throws or rejects, the Redis write above remains the source
    // of truth for iOS-to-iOS sharing.
    await mirrorTeamSharePush({ shareCode: code, team });

    return res.status(200).json({ success: true, viewToken });
  } catch (error) {
    console.error('Error in POST /api/team-share/push:', error);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to push team data'
    });
  }
}

// Plans are stamped with the game's updatedAt so the web can tell when one is
// out of date. A push without plans (an older app on a co-coach's phone)
// keeps the last ones rather than wiping them.
function mergePlans(previous, incoming, team) {
  const games = Array.isArray(team?._games) ? team._games : [];
  const result = {};
  for (const game of games) {
    const fresh = incoming && typeof incoming === 'object' ? incoming[game.id] : null;
    if (fresh && Array.isArray(fresh.shifts)) {
      result[game.id] = { shifts: fresh.shifts, gameUpdatedAt: game.updatedAt || null };
    } else if (previous?.[game.id]) {
      result[game.id] = previous[game.id];
    }
  }
  return result;
}
