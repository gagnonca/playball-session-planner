import React, { useState, useEffect } from 'react';

/**
 * Modal for linking devices via pairing code.
 * Shows either "Generate Code" (for existing identity) or "Enter Code" (for new device).
 */
export default function LinkDeviceModal({
  onClose,
  hasIdentity,
  onRequestCode,
  onConfirmCode,
  onInitialize,
}) {
  const [mode, setMode] = useState(hasIdentity ? 'generate' : 'join');
  const [pairingCode, setPairingCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Countdown timer for generated code
  useEffect(() => {
    if (!expiresAt) return;

    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        setGeneratedCode(null);
        setExpiresAt(null);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
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
      setError('Please enter a 6-digit code');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">
            {hasIdentity ? 'Link Another Device' : 'Sync Your Teams'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mode tabs (only show if not already linked) */}
        {!hasIdentity && (
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMode('join')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                mode === 'join'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Join Existing
            </button>
            <button
              onClick={() => setMode('new')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                mode === 'new'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Start Fresh
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Generate code mode */}
        {(mode === 'generate' && hasIdentity) && (
          <div className="space-y-4">
            <p className="text-slate-300 text-sm">
              Generate a code on this device, then enter it on your other device to sync your teams.
            </p>

            {generatedCode ? (
              <div className="text-center py-6">
                <div className="text-4xl font-mono font-bold text-white tracking-widest mb-2">
                  {generatedCode}
                </div>
                <div className="text-slate-400 text-sm">
                  Expires in {formatTime(timeLeft || 0)}
                </div>
              </div>
            ) : (
              <button
                onClick={handleGenerateCode}
                disabled={isLoading}
                className="w-full btn btn-primary"
              >
                {isLoading ? 'Generating...' : 'Generate Code'}
              </button>
            )}
          </div>
        )}

        {/* Join mode */}
        {mode === 'join' && (
          <div className="space-y-4">
            <p className="text-slate-300 text-sm">
              Enter the 6-digit code from your other device to sync your teams.
            </p>

            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full text-center text-3xl font-mono tracking-widest bg-slate-700 border border-slate-600 rounded-lg py-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <button
              onClick={handleConfirmCode}
              disabled={isLoading || pairingCode.length !== 6}
              className="w-full btn btn-primary"
            >
              {isLoading ? 'Linking...' : 'Link Device'}
            </button>
          </div>
        )}

        {/* New/fresh start mode */}
        {mode === 'new' && (
          <div className="space-y-4">
            <p className="text-slate-300 text-sm">
              Start with a new account. Your local teams will be synced to the cloud and available on all your devices.
            </p>

            <button
              onClick={handleStartFresh}
              disabled={isLoading}
              className="w-full btn btn-primary"
            >
              {isLoading ? 'Setting up...' : 'Enable Cloud Sync'}
            </button>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-700">
          <p className="text-slate-500 text-xs text-center">
            No account or personal information required. Your data syncs securely using an anonymous ID.
          </p>
        </div>
      </div>
    </div>
  );
}
