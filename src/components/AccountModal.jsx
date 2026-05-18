import React, { useState } from 'react';

/**
 * AccountModal — sign-in for the (currently stubbed) Account tier.
 *
 * The submit handler is provided by the parent; today it writes to
 * localStorage via useAccount(). When real auth lands, swap the parent's
 * handler for a Supabase magic-link / OAuth call without touching this UI.
 */
export default function AccountModal({ onClose, onSignIn, hasSync }) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e?.preventDefault?.();
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Enter the email you want to use.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await onSignIn(trimmed);
      onClose();
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="card p-6 w-full max-w-md animate-fade-in"
          style={{ boxShadow: 'var(--shadow-lg)', maxHeight: '90vh', overflow: 'auto' }}
        >
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="eyebrow mb-1">YOUR ACCOUNT</div>
              <h2 className="text-[20px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>
                Create your free account
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md"
              style={{ color: 'var(--ink-3)' }}
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-[13px] mb-4" style={{ color: 'var(--ink-2)' }}>
            {hasSync
              ? 'Your synced teams stay where they are — the account just adds discovery and a way to recover if you lose every device.'
              : 'An account turns on cloud sync automatically, and lets you discover other coaches’ sessions.'}
          </p>

          <ul className="space-y-1.5 text-[12.5px] mb-5" style={{ color: 'var(--ink-2)' }}>
            {[
              'Cloud sync across devices (auto-enabled)',
              'Recover your library if you lose every device',
              'Discover sessions shared by other coaches',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--good)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                <span>{t}</span>
              </li>
            ))}
          </ul>

          {error && (
            <div
              className="mb-4 p-3 rounded-[10px] text-[12.5px]"
              style={{
                background: 'rgb(var(--danger-rgb) / 0.1)',
                border: '1px solid rgb(var(--danger-rgb) / 0.3)',
                color: 'var(--danger)',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-[11.5px] font-mono uppercase mb-1.5 block" style={{ color: 'var(--ink-3)', letterSpacing: '0.08em' }}>
                Email
              </span>
              <input
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-[10px] py-2.5 px-3 text-[14px] focus:outline-none"
                style={{
                  background: 'var(--bg-sunken)',
                  border: '1px solid var(--line)',
                  color: 'var(--ink)',
                }}
              />
            </label>
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full"
            >
              {isLoading ? 'Signing in…' : 'Continue'}
            </button>
          </form>

          <div className="hairline my-5" />
          <p className="text-[11.5px] text-center" style={{ color: 'var(--ink-3)' }}>
            Stubbed sign-in for the v2 redesign. Real magic-link auth is coming.
          </p>
        </div>
      </div>
    </>
  );
}
