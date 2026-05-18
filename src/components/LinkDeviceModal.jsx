import React, { useState, useEffect } from 'react';

/**
 * Cloud-sync setup modal (v2).
 * Three modes:
 *   - "new": first-time setup, kicks off identity init
 *   - "generate": already synced, share a code with another device
 *   - "join":     enter a code from another device
 */
export default function LinkDeviceModal({
  onClose,
  hasIdentity,
  onRequestCode,
  onConfirmCode,
  onInitialize,
  onReset,
  defaultMode,
}) {
  const [mode, setMode] = useState(defaultMode || (hasIdentity ? 'generate' : 'new'));
  const [pairingCode, setPairingCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        setGeneratedCode(null);
        setExpiresAt(null);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const handleGenerateCode = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await onRequestCode();
      setGeneratedCode(result.code);
      setExpiresAt(result.expiresAt);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmCode = async () => {
    if (pairingCode.length !== 6) {
      setError('Enter the 6-digit code from your other device.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await onConfirmCode(pairingCode);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartFresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onInitialize();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const heading = hasIdentity
    ? 'Cloud sync'
    : mode === 'join' ? 'Join an existing account'
    : 'Turn on cloud sync';

  const Tab = ({ value, label }) => (
    <button
      onClick={() => { setMode(value); setError(null); }}
      className="flex-1 text-[12.5px] py-2 rounded-[8px] transition-colors"
      style={{
        background: mode === value ? 'var(--bg-elev)' : 'transparent',
        border: mode === value ? '1px solid var(--line)' : '1px solid transparent',
        color: mode === value ? 'var(--ink)' : 'var(--ink-2)',
        fontWeight: mode === value ? 500 : 400,
        boxShadow: mode === value ? 'var(--shadow-sm)' : 'none',
      }}
    >
      {label}
    </button>
  );

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
                {heading}
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

          {/* Mode tabs */}
          {!hasIdentity ? (
            <div
              className="flex gap-1 p-1 rounded-[10px] mb-5"
              style={{ background: 'var(--bg-sunken)', border: '1px solid var(--line)' }}
            >
              <Tab value="new" label="New setup" />
              <Tab value="join" label="I have a code" />
            </div>
          ) : (
            <div
              className="flex gap-1 p-1 rounded-[10px] mb-5"
              style={{ background: 'var(--bg-sunken)', border: '1px solid var(--line)' }}
            >
              <Tab value="generate" label="Share a code" />
              <Tab value="join" label="Join different" />
            </div>
          )}

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

          {/* New setup */}
          {mode === 'new' && !hasIdentity && (
            <div className="space-y-4">
              <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
                Your teams and diagrams will sync to the cloud. Pair another device with a one-time
                code so they stay in lockstep — no account or email required.
              </p>
              <ul className="space-y-1.5 text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
                {['Anonymous coach id — nothing personal stored', 'Pair as many devices as you want', 'Turn it off any time and your local copy stays'].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--good)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={handleStartFresh}
                disabled={isLoading}
                className="btn btn-primary w-full"
              >
                {isLoading ? 'Setting up…' : 'Turn on cloud sync'}
              </button>
            </div>
          )}

          {/* Generate code */}
          {mode === 'generate' && hasIdentity && (
            <div className="space-y-4">
              <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
                Open PlayBall on your other device and pick &ldquo;I have a code&rdquo;. The code
                expires in a few minutes.
              </p>

              {generatedCode ? (
                <div
                  className="rounded-[12px] p-5 text-center"
                  style={{ background: 'var(--bg-sunken)', border: '1px solid var(--line)' }}
                >
                  <div
                    className="font-mono font-semibold tracking-[0.2em]"
                    style={{ fontSize: 38, color: 'var(--ink)' }}
                  >
                    {generatedCode}
                  </div>
                  <div className="mt-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
                    Expires in {formatTime(timeLeft || 0)}
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleGenerateCode}
                  disabled={isLoading}
                  className="btn btn-primary w-full"
                >
                  {isLoading ? 'Generating…' : 'Generate a code'}
                </button>
              )}

              {onReset && (
                <div className="hairline" />
              )}
              {onReset && (
                <button
                  onClick={() => {
                    if (window.confirm('Unlink this device? Other linked devices keep their data; your local copy stays here.')) {
                      onReset();
                    }
                  }}
                  className="w-full text-[12.5px] text-left py-1.5"
                  style={{ color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  Unlink this device
                </button>
              )}
            </div>
          )}

          {/* Join */}
          {mode === 'join' && (
            <div className="space-y-4">
              <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
                Enter the 6-digit code from your other device to pull its teams onto this one.
              </p>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pairingCode}
                onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full text-center font-mono tracking-[0.3em] rounded-[10px] py-4 focus:outline-none"
                style={{
                  background: 'var(--bg-sunken)',
                  border: '1px solid var(--line)',
                  color: 'var(--ink)',
                  fontSize: 30,
                }}
              />
              <button
                onClick={handleConfirmCode}
                disabled={isLoading || pairingCode.length !== 6}
                className="btn btn-primary w-full"
              >
                {isLoading ? 'Linking…' : 'Link this device'}
              </button>
              {hasIdentity && (
                <p className="text-[11.5px] text-center" style={{ color: 'var(--ink-3)' }}>
                  This will replace this device&rsquo;s sync identity with the one from the code.
                </p>
              )}
            </div>
          )}

          <div className="hairline my-5" />
          <p className="text-[11.5px] text-center" style={{ color: 'var(--ink-3)' }}>
            No account or personal info required. Sync uses an anonymous coach id.
          </p>
        </div>
      </div>
    </>
  );
}
