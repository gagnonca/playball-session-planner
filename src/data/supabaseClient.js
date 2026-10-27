import { createClient, isAuthRetryableFetchError } from '@supabase/supabase-js';

// Browser Supabase client — used for Auth only (Google, Apple, emailed code).
// Data goes through our own /api/v2 endpoints with the session's access token.
// The anon key is public by design; Postgres is never queried from here.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const authConfigured = Boolean(url && anonKey);

if (!authConfigured) {
  console.warn('[auth] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — sign-in is disabled');
}

export const supabase = authConfigured
  ? createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  })
  : null;

// Signs this browser out even when the server has already ended the session
// (e.g. revoked by signing out elsewhere). supabase-js then answers
// signOut() with "session missing" and keeps the stale session in storage,
// so clear it ourselves and reload into the signed-out app.
export async function signOutHere() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (!error) return;
  try {
    const prefix = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
    Object.keys(localStorage).filter(k => k.startsWith(prefix)).forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
  window.location.replace('/');
}

// The server rejected our token. If the session itself is gone, refreshing
// fails and supabase-js signs out (SIGNED_OUT → the sign-in page); if it was
// just a stale token, this gets a fresh one.
export async function recheckSession() {
  if (!supabase) return;
  const { error } = await supabase.auth.refreshSession();
  if (error && !isAuthRetryableFetchError(error)) await signOutHere(); // not just offline
}
