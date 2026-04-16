import { supabase } from './supabase.js';

// Pull coach + device identity from headers (preferred) or query/body (fallback).
function extractIdentity(req) {
  const coachId =
    req.headers['x-coach-id'] ||
    req.query?.coachId ||
    req.body?.coachId;
  const deviceId =
    req.headers['x-device-id'] ||
    req.query?.deviceId ||
    req.body?.deviceId;
  return { coachId, deviceId };
}

// Verifies the requesting device is linked to the coach.
// Returns { ok: true, coach } or { ok: false, status, body }.
export async function verifyDevice(req) {
  const { coachId, deviceId } = extractIdentity(req);
  if (!coachId || !deviceId) {
    return {
      ok: false,
      status: 400,
      body: { success: false, error: 'missing_params', message: 'coachId and deviceId are required' },
    };
  }

  const { data: coach, error } = await supabase
    .from('coaches')
    .select('coach_id, devices, default_team_id')
    .eq('coach_id', coachId)
    .maybeSingle();

  if (error) {
    console.error('[auth] coach lookup failed', error);
    return { ok: false, status: 500, body: { success: false, error: 'server_error' } };
  }
  if (!coach) {
    return { ok: false, status: 404, body: { success: false, error: 'not_found', message: 'Coach not found' } };
  }

  const devices = Array.isArray(coach.devices) ? coach.devices : [];
  if (!devices.includes(deviceId)) {
    return {
      ok: false,
      status: 403,
      body: { success: false, error: 'device_not_linked', message: 'Device is not linked to this coach' },
    };
  }

  return { ok: true, coach, coachId, deviceId };
}

export function sendError(res, status, error, message) {
  return res.status(status).json({ success: false, error, message });
}
