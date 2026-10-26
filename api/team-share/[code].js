import { redis } from '../_lib/redis.js';
import { del } from '@vercel/blob';
import { supabase } from '../_lib/supabase.js';
import { coachName } from '../_lib/teamAccess.js';

const VALID_CODE = /^[A-Z2-9]{6}$/;

/**
 * GET  /api/team-share/{code}  — fetch team data for import
 * DELETE /api/team-share/{code} — revoke share (called when team is deleted in iOS app)
 *
 * GET response: { success: true, team: {...}, trainingShareCode?: "YYYYYY", mascotImageUrl?: "https://..." }
 */
export default async function handler(req, res) {
  const { code } = req.query;

  if (!code || !VALID_CODE.test(code)) {
    return res.status(400).json({
      success: false,
      error: 'invalid_code',
      message: 'Invalid share code'
    });
  }

  if (req.method === 'GET') {
    return handleGet(req, res, code);
  } else if (req.method === 'DELETE') {
    return handleDelete(req, res, code);
  } else {
    return res.status(405).json({ success: false, error: 'method_not_allowed' });
  }
}

async function handleGet(req, res, code) {
  try {
    const raw = await redis.get(`team-share:${code}`);
    if (!raw) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'This share code is no longer valid.'
      });
    }

    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const response = { success: true, team: data.team };
    if (data.trainingShareCode) response.trainingShareCode = data.trainingShareCode;
    if (data.mascotImageUrl) response.mascotImageUrl = data.mascotImageUrl;

    // Once a coach moves the team onto their account, say whose it is, so
    // the app can show "Managed by …" instead of silently going stale.
    const { data: owned } = await supabase
      .from('teams').select('id, coach_id')
      .eq('ios_share_code', code).is('deleted_at', null)
      .not('coach_id', 'like', 'anon:%')
      .maybeSingle();
    if (owned) response.managedBy = { teamId: owned.id, name: await coachName(owned.coach_id) };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error in GET /api/team-share/[code]:', error);
    return res.status(500).json({ success: false, error: 'server_error' });
  }
}

async function handleDelete(req, res, code) {
  try {
    const raw = await redis.get(`team-share:${code}`);
    if (raw) {
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (data.mascotImageUrl) {
        await del(data.mascotImageUrl).catch(() => {}); // best-effort blob cleanup
      }
    }
    await redis.del(`team-share:${code}`);
    return res.status(200).json({ success: true, message: 'Share revoked' });
  } catch (error) {
    console.error('Error in DELETE /api/team-share/[code]:', error);
    return res.status(500).json({ success: false, error: 'server_error' });
  }
}
