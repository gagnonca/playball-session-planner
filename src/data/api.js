import { COACH_IDENTITY_KEY } from '../constants/storage';

// The only place the web app decides *who* it is talking to the server as.
// Today that's the device-linked coach identity; swapping to account auth
// means changing authHeaders() and identityKey() and nothing else.

export function readIdentity() {
  try {
    const raw = localStorage.getItem(COACH_IDENTITY_KEY);
    if (!raw) return null;
    const identity = JSON.parse(raw);
    return identity?.coachId && identity?.deviceId ? identity : null;
  } catch {
    return null;
  }
}

// Stable per-user key for the local read cache.
export function identityKey() {
  return readIdentity()?.coachId || null;
}

function authHeaders() {
  const identity = readIdentity();
  if (!identity) return null;
  return {
    'x-coach-id': identity.coachId,
    'x-device-id': identity.deviceId,
  };
}

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || body?.error || `HTTP ${status}`);
    this.status = status;   // 0 = network failure
    this.body = body || {};
  }
}

// fetch → parsed JSON. Throws ApiError for non-2xx (incl. 409 conflict, whose
// body carries `current`) and for network failures (status 0).
export async function request(method, path, body) {
  const auth = authHeaders();
  if (!auth) throw new ApiError(401, { error: 'no_identity' });
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: { ...auth, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError(0, { error: 'network', message: e.message });
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty / non-JSON body */ }
  if (!res.ok || data?.success === false) throw new ApiError(res.status, data);
  return data;
}
