import { useState, useEffect, useCallback } from 'react';
import { supabase, authConfigured } from '../data/supabaseClient';
import { request } from '../data/api';

/**
 * PlayBall accounts — Supabase Auth with no passwords: Sign in with Google,
 * Sign in with Apple, or a one-time code / link emailed to the coach.
 * The data store (data/store.js) listens for sign-in changes itself; this
 * hook is the UI's handle on the account.
 */
export default function useAccount() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!authConfigured);

  useEffect(() => {
    if (!supabase) return undefined;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setUser(data?.session?.user || null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => { alive = false; sub?.subscription?.unsubscribe(); };
  }, []);

  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;

  const signInWithProvider = useCallback(async (provider) => {
    if (!supabase) throw new Error('Sign-in is not configured');
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) throw error;
  }, [redirectTo]);

  // Emails a 6-digit code (and a sign-in link) — creates the account on first use.
  const sendEmailCode = useCallback(async (email) => {
    if (!supabase) throw new Error('Sign-in is not configured');
    const { error } = await supabase.auth.signInWithOtp({
      email: String(email || '').trim(),
      options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
    });
    if (error) throw error;
  }, [redirectTo]);

  const verifyEmailCode = useCallback(async (email, code) => {
    if (!supabase) throw new Error('Sign-in is not configured');
    const { error } = await supabase.auth.verifyOtp({
      email: String(email || '').trim(),
      token: String(code || '').trim(),
      type: 'email',
    });
    if (error) throw error;
  }, []);

  // Back to the front page (sign-in) rather than wherever you were.
  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    window.history.replaceState({}, '', '/');
  }, []);

  // Permanently deletes the account and every team, session, game, library
  // item and diagram it owns.
  const deleteAccount = useCallback(async () => {
    await request('DELETE', '/api/v2/account', { confirm: 'DELETE' });
    if (supabase) await supabase.auth.signOut();
    window.history.replaceState({}, '', '/');
  }, []);

  return {
    authConfigured,
    ready,
    user,
    account: user ? { email: user.email || '', provider: user.app_metadata?.provider || 'email' } : null,
    isSignedIn: Boolean(user),
    signInWithGoogle: () => signInWithProvider('google'),
    signInWithApple: () => signInWithProvider('apple'),
    sendEmailCode,
    verifyEmailCode,
    signOut,
    deleteAccount,
  };
}
