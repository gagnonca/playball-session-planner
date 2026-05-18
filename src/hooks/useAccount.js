import { useState, useCallback, useEffect } from 'react';
import { ACCOUNT_KEY } from '../constants/storage';

/**
 * useAccount — stubbed account tier.
 *
 * Real auth (Supabase magic link / OAuth) isn't wired yet; this hook fakes
 * a sign-in by storing { email, signedInAt } in localStorage so the rest of
 * the UI can treat the account tier as real state. Swap this for a real
 * Supabase Auth listener when ready — the surface area (account, signIn,
 * signOut) should stay the same.
 */
export default function useAccount() {
  const [account, setAccount] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACCOUNT_KEY);
      if (raw) setAccount(JSON.parse(raw));
    } catch (e) {
      console.warn('Failed to parse account:', e);
    }
  }, []);

  const signIn = useCallback(async (email) => {
    const next = { email: String(email || '').trim(), signedInAt: new Date().toISOString() };
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(next));
    setAccount(next);
    return next;
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem(ACCOUNT_KEY);
    setAccount(null);
  }, []);

  return {
    account,
    isSignedIn: Boolean(account?.email),
    signIn,
    signOut,
  };
}
