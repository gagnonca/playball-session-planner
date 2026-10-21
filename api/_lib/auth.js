import { supabase } from './supabase.js';

// Who is calling?
//
//   Authorization: Bearer <Supabase access token>  → an account (preferred)
//   x-coach-id + x-device-id                        → a legacy device link
//
// A legacy device link only works for coaches that no account has claimed
// yet; once claimed, that coach is reachable through its account only.

function extractDevice(req) {
  const coachId = req.headers['x-coach-id'] || req.query?.coachId || req.body?.coachId;
  const deviceId = req.headers['x-device-id'] || req.query?.deviceId || req.body?.deviceId;
  return { coachId, deviceId };
}

function bearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

const fail = (status, error, message) => ({ ok: false, status, body: { success: false, error, message } });

// Warm-function cache so a burst of writes doesn't re-verify the same token.
const userCache = new Map(); // token → { user, until }

export async function resolveUser(req) {
  const token = bearer(req);
  if (!token) return null;
  const hit = userCache.get(token);
  if (hit && hit.until > Date.now()) return hit.user;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return { invalid: true };
  if (userCache.size > 500) userCache.clear();
  userCache.set(token, { user: data.user, until: Date.now() + 60_000 });
  return data.user;
}

// Returns { ok: true, coach, coachId, user? } or { ok: false, status, body }.
export async function authenticate(req) {
  const user = await resolveUser(req);
  if (user?.invalid) return fail(401, 'invalid_token', 'Your sign-in expired. Sign in again.');
  if (user) {
    const { data: coach, error } = await supabase
      .from('coaches').select('coach_id, devices, default_team_id, user_id')
      .eq('user_id', user.id).maybeSingle();
    if (error) { console.error('[auth] coach by user', error); return fail(500, 'server_error'); }
    if (!coach) return fail(409, 'no_coach', 'Account has no PlayBall data yet');
    return { ok: true, coach, coachId: coach.coach_id, user };
  }
  return verifyDevice(req);
}

// Legacy device-link check. Kept for the claim flow and for unclaimed coaches.
export async function verifyDevice(req) {
  const { coachId, deviceId } = extractDevice(req);
  if (!coachId || !deviceId) return fail(401, 'not_signed_in', 'Sign in to PlayBall');

  // Anon coaches are created by the team-share/push mirror for unclaimed
  // iOS shares. They have no real owner and must never authenticate.
  if (typeof coachId === 'string' && coachId.startsWith('anon:')) {
    return fail(403, 'anon_coach', 'Anonymous shares cannot be used to sign in');
  }

  const { data: coach, error } = await supabase
    .from('coaches')
    .select('coach_id, devices, default_team_id, user_id')
    .eq('coach_id', coachId)
    .maybeSingle();

  if (error) {
    console.error('[auth] coach lookup failed', error);
    return fail(500, 'server_error');
  }
  if (!coach) return fail(404, 'not_found', 'Coach not found');
  if (coach.user_id) return fail(401, 'login_required', 'This PlayBall data belongs to an account. Sign in to use it.');

  const devices = Array.isArray(coach.devices) ? coach.devices : [];
  if (!devices.includes(deviceId)) {
    return fail(403, 'device_not_linked', 'Device is not linked to this coach');
  }
  return { ok: true, coach, coachId, deviceId, legacy: true };
}

export function sendError(res, status, error, message) {
  return res.status(status).json({ success: false, error, message });
}
