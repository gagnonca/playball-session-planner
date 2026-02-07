import React, { useState, useEffect } from 'react';

/**
 * AIConfigModal - Configure OpenAI API key for AI-assisted content generation
 */
export default function AIConfigModal({ isOpen, onClose, aiHook }) {
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [showKey, setShowKey] = useState(false);

  const { getConfig, saveConfig, clearConfig, validateApiKey } = aiHook;

  // Load existing config on open
  useEffect(() => {
    if (isOpen) {
      const config = getConfig();
      if (config.apiKey) {
        setApiKey(config.apiKey);
        setValidationResult({ valid: true, saved: true });
      } else {
        setApiKey('');
        setValidationResult(null);
      }
    }
  }, [isOpen, getConfig]);

  const handleValidate = async () => {
    if (!apiKey.trim()) {
      setValidationResult({ valid: false, error: 'Please enter an API key' });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    const result = await validateApiKey(apiKey.trim());
    setValidationResult(result);
    setIsValidating(false);
  };

  const handleSave = () => {
    if (validationResult?.valid) {
      saveConfig(apiKey.trim());
      setValidationResult({ valid: true, saved: true });
    }
  };

  const handleClear = () => {
    if (window.confirm('Remove your API key? AI features will be disabled.')) {
      clearConfig();
      setApiKey('');
      setValidationResult(null);
    }
  };

  const handleClose = () => {
    if (validationResult?.valid && !validationResult?.saved && apiKey.trim()) {
      if (window.confirm('Save your API key before closing?')) {
        saveConfig(apiKey.trim());
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={handleClose} />

      {/* Modal Content */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="text-2xl">✨</span>
              AI Assistant Setup
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Connect your OpenAI account to enable AI-powered suggestions
            </p>
          </div>
          <button onClick={handleClose} className="btn btn-subtle">
            Close
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-300 mb-2">How it works</h3>
          <ul className="text-sm text-slate-300 space-y-1">
            <li>• Your API key is stored locally on your device only</li>
            <li>• API calls go directly to OpenAI (we never see your key)</li>
            <li>• Uses gpt-4o for cost-effective suggestions</li>
            <li>• Typical cost: less than $0.01 per generation</li>
          </ul>
        </div>

        {/* API Key Input */}
        <div className="mb-4">
          <label className="label-text mb-2 block">OpenAI API Key</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setValidationResult(null);
                }}
                placeholder="sk-..."
                className="input-field w-full pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
              >
                {showKey ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <button
              onClick={handleValidate}
              disabled={isValidating || !apiKey.trim()}
              className="btn btn-secondary"
            >
              {isValidating ? 'Checking...' : 'Validate'}
            </button>
          </div>

          {/* Validation feedback */}
          {validationResult && (
            <div className={`mt-2 text-sm ${validationResult.valid ? 'text-green-400' : 'text-red-400'}`}>
              {validationResult.valid
                ? validationResult.saved
                  ? '✓ API key saved and working'
                  : '✓ Valid key - click Save to store it'
                : `✗ ${validationResult.error}`}
            </div>
          )}
        </div>

        {/* Get API Key Link */}
        <p className="text-sm text-slate-400 mb-6">
          Don't have an API key?{' '}
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            Get one from OpenAI →
          </a>
        </p>

        {/* Actions */}
        <div className="flex justify-between">
          <button
            onClick={handleClear}
            className="btn btn-danger text-sm"
            disabled={!apiKey}
          >
            Remove Key
          </button>
          <div className="flex gap-2">
            <button onClick={handleClose} className="btn btn-subtle">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!validationResult?.valid || validationResult?.saved}
              className="btn btn-primary"
            >
              {validationResult?.saved ? 'Saved ✓' : 'Save Key'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
