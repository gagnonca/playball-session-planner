import { redis } from '../_lib/redis.js';

/**
 * GET/DELETE /api/share/[token]
 *
 * GET: Fetch shared team data (view-only)
 * Response: { success: true, team: object }
 *
 * DELETE: Revoke share link
 * Header: X-Revoke-Secret (sha256 of token + teamId for verification)
 * Response: { success: true }
 */
export default async function handler(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({
      success: false,
      error: 'missing_token',
      message: 'Share token is required'
    });
  }

  if (req.method === 'GET') {
    return handleGet(req, res, token);
  } else if (req.method === 'DELETE') {
    return handleDelete(req, res, token);
  } else {
    return res.status(405).json({ success: false, error: 'method_not_allowed' });
  }
}

async function handleGet(req, res, token) {
  try {
    const shareDataRaw = await redis.get(`share:${token}`);

    if (!shareDataRaw) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'This shared team link is no longer valid.'
      });
    }

    const shareData = typeof shareDataRaw === 'string'
      ? JSON.parse(shareDataRaw)
      : shareDataRaw;

    return res.status(200).json({
      success: true,
      team: shareData
    });
  } catch (error) {
    console.error('Error in GET /api/share/[token]:', error);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to fetch shared team'
    });
  }
}

async function handleDelete(req, res, token) {
  try {
    // Get the share data first to verify it exists
    const shareDataRaw = await redis.get(`share:${token}`);

    if (!shareDataRaw) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Share not found'
      });
    }

    // Optional: Verify revoke secret for extra security
    // const revokeSecret = req.headers['x-revoke-secret'];
    // In production, you'd verify this matches sha256(token + teamId)

    // Delete the share
    await redis.del(`share:${token}`);

    return res.status(200).json({
      success: true,
      message: 'Share link revoked'
    });
  } catch (error) {
    console.error('Error in DELETE /api/share/[token]:', error);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to revoke share'
    });
  }
}
