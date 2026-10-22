import React, { useEffect, useRef, useState } from 'react';
import { googleButtonAvailable, renderGoogleButton } from '../data/googleSignIn';
import { returningCoachQuick, findReturningCoach } from '../data/legacyImport';
import playballIcon from '../assets/playball-icon.png';

// Signed-out landing. PlayBall keeps every coach's data in their account, so
// this is the front door: what the app is, why it asks for an account, a
// sign-in that never involves a password, and a demo to click around in
// before deciding.
//
// A coach who used PlayBall in this browser before accounts existed gets a
// "welcome back" version instead: their teams are named, and it says signing
// in moves them into the account — so the page doesn't read as if their
// season vanished.

function joinNames(names) {
  const shown = names.slice(0, 3);
  const more = names.length - shown.length;
  if (more > 0) return `${shown.join(', ')} and ${more} more`;
  if (shown.length <= 1) return shown.join('');
  return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
}

function useReturningCoach() {
  const [returning, setReturning] = useState(returningCoachQuick);
  useEffect(() => {
    let alive = true;
    findReturningCoach().then(r => { if (alive) setReturning(r); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return returning;
}

const Icons = {
  devices: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="14" height="10" rx="1.5" /><path d="M6 18h6" /><rect x="17" y="8" width="5" height="12" rx="1.2" />
    </svg>
  ),
  field: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="1.5" /><path d="M12 5v14" /><circle cx="12" cy="12" r="2.5" />
    </svg>
  ),
  share: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" /><path d="M3 20v-1a5 5 0 015-5h2a5 5 0 015 5v1" /><path d="M17 8h4M19 6v4" />
    </svg>
  ),
};

function ProviderButton({ onClick, children, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full inline-flex items-center justify-center gap-2.5 rounded-[10px] px-4 py-2.5 text-[14px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', color: 'var(--ink)' }}
    >
      {children}
    </button>
  );
}

// Google's own button (it names PlayBall, not Supabase, on Google's screen).
function GoogleButton({ disabled, onError, onStart }) {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    renderGoogleButton(ref.current, { onError, onStart }).catch(e => { setFailed(true); onError?.(e.message); });
  }, [onError, onStart]);
  if (failed) return null;
  return <div ref={ref} className="w-full flex justify-center" style={{ minHeight: 44, opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }} />;
}

export default function Welcome({ accountContext, onStartDemo, onBrowseCommunity }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState('start'); // start | code
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const returning = useReturningCoach();
  const teamNames = returning?.teamNames || [];
  const sessionCount = returning?.sessionCount || 0;

  const configured = accountContext?.authConfigured;
  // Stable callbacks so Google's button isn't re-drawn on every render.
  const setGoogleError = React.useCallback((msg) => setError(msg || 'Google sign-in failed. Try again.'), []);
  const clearError = React.useCallback(() => setError(''), []);

  const run = async (fn) => {
    setError('');
    setBusy(true);
    try { await fn(); }
    catch (e) { setError(e?.message || 'Something went wrong. Try again.'); }
    finally { setBusy(false); }
  };

  const sendCode = () => run(async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error('Enter a valid email address.');
    await accountContext.sendEmailCode(email);
    setStage('code');
  });

  const verify = () => run(async () => {
    await accountContext.verifyEmailCode(email, code);
  });

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      <main className="max-w-[980px] mx-auto px-6 pt-16 pb-16 grid gap-10 md:grid-cols-[1.15fr_1fr] items-start">
        <section>
          <div
            className="inline-flex items-center gap-2.5 rounded-full pl-1.5 pr-3.5 py-1"
            style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)' }}
          >
            <img src={playballIcon} alt="" className="w-6 h-6 rounded-[7px]" />
            <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
              <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>PlayBall</strong>
              <span style={{ color: 'var(--ink-3)' }}> · session planner for grassroots coaches</span>
            </span>
          </div>

          {returning ? (
            <>
              <h1 className="mt-7 text-[46px] leading-[1.05] font-semibold" style={{ letterSpacing: '-0.025em' }}>
                Welcome back,{' '}
                <span style={{ fontStyle: 'italic', color: 'var(--accent)', fontWeight: 600 }}>coach</span>.
              </h1>
              {returning.signedInBefore ? (
                <p className="mt-4 text-[16px] leading-snug max-w-[520px]" style={{ color: 'var(--ink-2)' }}>
                  You're signed out. Sign in the same way you did before and your teams will be right where you left them.
                </p>
              ) : (
                <>
                  <p className="mt-4 text-[16px] leading-snug max-w-[520px]" style={{ color: 'var(--ink-2)' }}>
                    Your teams and sessions are safe. PlayBall now keeps them in an account
                    instead of this browser, so you'll sign in once and everything comes with you.
                  </p>
                  <div className="mt-6 rounded-[12px] p-4 max-w-[520px]" style={{ background: 'var(--accent-soft)', border: '1px solid var(--line)' }}>
                    <div className="text-[14px] font-semibold" style={{ letterSpacing: '-0.01em' }}>
                      {teamNames.length
                        ? `Found in this browser: ${teamNames.length} team${teamNames.length === 1 ? '' : 's'}${sessionCount ? `, ${sessionCount} session${sessionCount === 1 ? '' : 's'}` : ''}`
                        : 'Your synced teams are waiting'}
                    </div>
                    {teamNames.length > 0 && (
                      <p className="text-[13px] mt-0.5" style={{ color: 'var(--ink-2)' }}>{joinNames(teamNames)}</p>
                    )}
                    <p className="text-[13px] mt-2 leading-snug" style={{ color: 'var(--ink-2)' }}>
                      Sign in and they move into your account automatically. Nothing is deleted,
                      and you only do this once per browser.
                    </p>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <h1 className="mt-7 text-[46px] leading-[1.05] font-semibold" style={{ letterSpacing: '-0.025em' }}>
                Plan a practice your players will{' '}
                <span style={{ fontStyle: 'italic', color: 'var(--accent)', fontWeight: 600 }}>love</span>.
              </h1>
              <p className="mt-4 text-[16px] leading-snug max-w-[520px]" style={{ color: 'var(--ink-2)' }}>
                Build sessions, draw the field, and keep your season organized.
              </p>
            </>
          )}

          {returning && !returning.signedInBefore && (
            <div className="mt-8 text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>Why accounts</div>
          )}
          <div className={returning && !returning.signedInBefore ? 'mt-3 flex flex-col gap-4' : 'mt-8 flex flex-col gap-4'}>
            {[
              { icon: Icons.devices, title: 'Your plans on every device', body: 'Plan on the laptop tonight, pull it up on your phone at practice. Everything is saved to your account as you go.' },
              { icon: Icons.field, title: 'Never lose a session', body: "Nothing lives only in one browser, so clearing a cache or switching computers can't wipe out a season." },
              { icon: Icons.share, title: 'Share with assistant coaches', body: "Send a read-only link. They don't need an account to see the plan." },
            ].map(b => (
              <div key={b.title} className="flex gap-3">
                <div className="w-9 h-9 flex-shrink-0 rounded-[10px] inline-flex items-center justify-center" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{b.icon}</div>
                <div>
                  <div className="text-[14.5px] font-semibold" style={{ letterSpacing: '-0.01em' }}>{b.title}</div>
                  <p className="text-[13px] leading-snug" style={{ color: 'var(--ink-2)' }}>{b.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[16px] p-6" style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 className="text-[20px] font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>
            {returning && !returning.signedInBefore ? 'Sign in to keep your teams' : returning ? 'Sign in' : 'Sign in or create an account'}
          </h2>
          <p className="text-[13px] mb-5" style={{ color: 'var(--ink-2)' }}>
            {returning && !returning.signedInBefore
              ? "No password to remember. Use the sign-in you'll use on your phone too — your teams belong to that account."
              : 'No password to remember.'}
          </p>
          {!returning && (
            <p className="text-[12.5px] leading-snug -mt-2 mb-5 rounded-[10px] px-3 py-2" style={{ background: 'var(--accent-soft)', color: 'var(--ink-2)' }}>
              <strong style={{ color: 'var(--ink)' }}>Used PlayBall before?</strong> Your teams are safe.
              Sign in here, and once on the computer or phone you planned on — your teams move into
              your account and show up everywhere.
            </p>
          )}

          {!configured && (
            <p className="text-[13px] mb-4" style={{ color: 'var(--danger)' }}>Sign-in isn't configured on this deployment.</p>
          )}

          {stage === 'start' && (
            <div className="flex flex-col gap-2.5">
              {googleButtonAvailable() ? (
                <GoogleButton disabled={busy} onError={setGoogleError} onStart={clearError} />
              ) : (
                <ProviderButton disabled={busy || !configured} onClick={() => run(accountContext.signInWithGoogle)}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 01-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0012 24z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 010-4.6V6.6H1.3a12 12 0 000 10.8l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 001.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"/></svg>
                  Continue with Google
                </ProviderButton>
              )}
              <ProviderButton disabled={busy || !configured} onClick={() => run(accountContext.signInWithApple)}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M16.4 12.6c0-2.4 2-3.5 2-3.6-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.7zM14.1 5.6c.6-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.5 2.8-1.3z"/></svg>
                Continue with Apple
              </ProviderButton>

              <div className="flex items-center gap-3 my-2 text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
                <span className="flex-1 hairline" /> or use your email <span className="flex-1 hairline" />
              </div>

              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendCode(); }}
                className="input-field"
              />
              <button className="btn btn-primary w-full" disabled={busy || !configured || !email.trim()} onClick={sendCode}>
                {busy ? 'Sending…' : 'Email me a sign-in code'}
              </button>
            </div>
          )}

          {stage === 'code' && (
            <div className="flex flex-col gap-2.5">
              <p className="text-[13.5px]" style={{ color: 'var(--ink-2)' }}>
                We sent a 6-digit code to <strong style={{ color: 'var(--ink)' }}>{email.trim()}</strong>. Enter it below, or click the link in that email.
              </p>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter' && code.length === 6) verify(); }}
                className="input-field text-center font-mono tracking-[0.3em] text-[18px]"
                autoFocus
              />
              <button className="btn btn-primary w-full" disabled={busy || code.length !== 6} onClick={verify}>
                {busy ? 'Checking…' : 'Sign in'}
              </button>
              <button className="btn btn-ghost w-full" disabled={busy} onClick={() => { setStage('start'); setCode(''); setError(''); }}>
                Use a different email
              </button>
            </div>
          )}

          {error && <p className="mt-3 text-[13px]" style={{ color: 'var(--danger)' }}>{error}</p>}

          <div className="hairline my-5" />

          {!returning && (
            <>
              <button className="btn btn-secondary w-full" onClick={onStartDemo}>
                Look around first — try a demo team
              </button>
              <p className="mt-2 text-[11.5px] text-center" style={{ color: 'var(--ink-3)' }}>
                Nothing in the demo is saved.
              </p>
            </>
          )}
          {onBrowseCommunity && (
            <button className={`btn btn-ghost w-full${returning ? '' : ' mt-2'}`} onClick={onBrowseCommunity}>
              Browse sessions shared by other coaches
            </button>
          )}

          <p className="mt-5 text-[11.5px] leading-snug" style={{ color: 'var(--ink-3)' }}>
            Your account exists only so you can sign in, keep your teams, and use them on all your
            devices. PlayBall never sells, shares or analyzes your data.{' '}
            <a href="/privacy" style={{ color: 'var(--accent)' }}>Privacy policy</a>
          </p>
        </section>
      </main>
    </div>
  );
}
