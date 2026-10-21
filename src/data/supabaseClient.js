import { createClient } from '@supabase/supabase-js';

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
