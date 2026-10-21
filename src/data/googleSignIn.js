import { supabase, authConfigured } from './supabaseClient';

// "Continue with Google" through Google's own button (Google Identity
// Services) instead of Supabase's redirect. With the redirect, Google's
// consent screen names Supabase's domain (<project>.supabase.co), which looks
// like a third party grabbing your account. With this button, Google talks to
// this page directly and names PlayBall / getplayball.app; the ID token it
// returns is then verified by Supabase (signInWithIdToken).
//
// Requirements (see the login setup doc, step 4):
//   • Google Cloud → OAuth client → Authorized JavaScript origins lists every
//     site this runs on (www.getplayball.app, the preview URL).
//   • Supabase → Google provider → Authorized Client IDs includes this ID.

// Public identifier (it is in every page that shows the button).
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
  || '12718753246-531g4451hqbnr7pv2qqgnnbaeec6humr.apps.googleusercontent.com';

// The local test server fakes Supabase Auth, and Google won't issue tokens to
// it; fall back to the redirect flow there.
export function googleButtonAvailable() {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return authConfigured && !url.includes('/fake-sb');
}

let scriptPromise = null;
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { scriptPromise = null; reject(new Error("Couldn't load Google sign-in. Check your connection.")); };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Draw Google's button into `el`. Sign-in completes through Supabase, whose
// auth listener then loads the account (data/store.js).
export async function renderGoogleButton(el, { onError, onStart } = {}) {
  await loadGoogleScript();
  // Replay protection: Google embeds the hashed nonce in the ID token and
  // Supabase checks it against the raw one.
  const nonce = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const hashedNonce = await sha256Hex(nonce);
  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    nonce: hashedNonce,
    ux_mode: 'popup',
    context: 'signin',
    itp_support: true,
    use_fedcm_for_prompt: true,
    callback: async ({ credential }) => {
      onStart?.();
      const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: credential, nonce });
      if (error) onError?.(error.message);
    },
  });
  el.innerHTML = '';
  window.google.accounts.id.renderButton(el, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    logo_alignment: 'center',
    width: Math.min(400, Math.max(200, Math.round(el.getBoundingClientRect().width) || 320)),
  });
}
