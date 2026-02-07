import { redis } from '../_lib/redis.js';

/**
 * POST /api/share/push
 * Push team data for AC sharing (view-only).
 *
 * Request: { shareToken: string, team: object }
 * Response: { success: true, pushedAt: string }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'method_not_allowed' });
  }

  try {
    const { shareToken, team } = req.body;

    if (!shareToken || !team) {
      return res.status(400).json({
        success: false,
        error: 'missing_params',
        message: 'shareToken and team are required'
      });
    }

    // Validate token format
    if (!shareToken.startsWith('t_') || shareToken.length < 20) {
      return res.status(400).json({
        success: false,
        error: 'invalid_token',
        message: 'Invalid share token format'
      });
    }

    const now = new Date().toISOString();

    // Prepare share data (exclude sensitive metadata)
    const shareData = {
      teamId: team.id,
      teamName: team.name,
      ageGroup: team.ageGroup,
      sessions: team.sessions || [],
      pushedAt: now,
    };

    await redis.set(`share:${shareToken}`, JSON.stringify(shareData));

    return res.status(200).json({
      success: true,
      pushedAt: now
    });
  } catch (error) {
    console.error('Error in /api/share/push:', error);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to push team data'
    });
  }
}
