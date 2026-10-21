import { COACH_IDENTITY_KEY } from '../constants/storage';
import { supabase } from './supabaseClient';

// The only place the web app decides *who* it is talking to the server as:
// the signed-in account's access token. (The pre-accounts device identity
// is read only so the first sign-in can claim that coach's data.)

let currentSession = null;

export function setAuthSession(session) {
  currentSession = session || null;
}

export function isSignedIn() {
  return Boolean(currentSession?.access_token);
}

// Stable per-user key for the local read cache and drafts.
export function identityKey() {
  return currentSession?.user?.id || null;
}

export function currentUser() {
  return currentSession?.user || null;
}

// Pre-accounts device link, if this browser had one.
export function readLegacyIdentity() {
  try {
    const raw = localStorage.getItem(COACH_IDENTITY_KEY);
    if (!raw) return null;
    const identity = JSON.parse(raw);
    return identity?.coachId && identity?.deviceId ? identity : null;
  } catch {
    return null;
  }
}

async function authHeaders() {
  // Ask supabase-js for the session so an expired token is refreshed first.
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data?.session) currentSession = data.session;
  }
  if (!currentSession?.access_token) return null;
  return { Authorization: `Bearer ${currentSession.access_token}` };
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
  const auth = await authHeaders();
  if (!auth) throw new ApiError(401, { error: 'not_signed_in' });
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
