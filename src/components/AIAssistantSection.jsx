import React, { useState, useEffect } from 'react';
import useAI from '../hooks/useAI';

// Inline AI configuration for the Settings page. Same surface as
// AIConfigModal — validate against OpenAI, save locally, clear.
// AIField widgets across the app key off useAI.isConfigured(), so
// turning this off here hides them everywhere.
export default function AIAssistantSection() {
  const aiHook = useAI();
  const { getConfig, saveConfig, clearConfig, validateApiKey, isConfigured } = aiHook;

  const [apiKey, setApiKey] = useState(() => getConfig().apiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState(() => (isConfigured() ? { valid: true, saved: true } : null));

  useEffect(() => {
    setApiKey(getConfig().apiKey || '');
    setResult(isConfigured() ? { valid: true, saved: true } : null);
    // We intentionally only run once on mount; reads from localStorage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleValidate = async () => {
    if (!apiKey.trim()) {
      setResult({ valid: false, error: 'Please enter an API key' });
      return;
    }
    setValidating(true);
    setResult(null);
    const r = await validateApiKey(apiKey.trim());
    setResult(r);
    if (r.valid) {
      saveConfig(apiKey.trim());
      setResult({ valid: true, saved: true });
    }
    setValidating(false);
  };

  const handleClear = () => {
    if (!window.confirm('Remove your API key? Suggest-from-context buttons will hide everywhere.')) return;
    clearConfig();
    setApiKey('');
    setResult(null);
  };

  const configured = result?.saved && result?.valid;

  return (
    <section>
      <div className="eyebrow mb-2">AI ASSISTANT</div>
      <h2 className="text-[20px] font-semibold mb-1" style={{ letterSpacing: '-0.02em' }}>
        {configured ? 'AI is on' : 'Off by default'}
      </h2>
      <p className="text-[13px] mb-4 max-w-[540px]" style={{ color: 'var(--ink-2)' }}>
        Optional. Add your own OpenAI key and PlayBall will start showing
        &ldquo;Suggest from context&rdquo; under every objective, organization, and notes field.
        Calls go straight to OpenAI from your browser; we never see the key.
      </p>

      <div className="card p-4">
        {configured ? (
          <div className="flex items-center gap-3 flex-wrap">
            <div
              className="flex-shrink-0 w-10 h-10 rounded-[11px] inline-flex items-center justify-center"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold" style={{ letterSpacing: '-0.015em' }}>
                Connected to OpenAI
              </div>
              <div className="text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
                Key stored locally · model: gpt-4o · typical cost &lt; $0.01 per generation
              </div>
            </div>
            <button onClick={handleClear} className="btn btn-ghost" style={{ color: 'var(--danger)' }}>
              Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="label-text">OpenAI API key</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setResult(null); }}
                  placeholder="sk-…"
                  className="input-field pr-20"
                  spellCheck={false}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(s => !s)}
                  className="absolute top-1/2 -translate-y-1/2 right-2 text-[11.5px] font-mono uppercase"
                  style={{ color: 'var(--ink-3)', letterSpacing: '0.08em', background: 'transparent', border: 'none', padding: '4px 6px', cursor: 'pointer' }}
                  title={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            </div>

            {result?.error && (
              <div className="text-[12.5px]" style={{ color: 'var(--danger)' }}>
                {result.error}
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleValidate}
                disabled={!apiKey.trim() || validating}
                className="btn btn-primary"
              >
                {validating ? 'Checking…' : 'Validate & save'}
              </button>
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12.5px]"
                style={{ color: 'var(--accent)' }}
              >
                Get a key at platform.openai.com →
              </a>
            </div>
          </div>
        )}
      </div>

      <ul className="mt-3 text-[12px] space-y-1" style={{ color: 'var(--ink-3)' }}>
        <li>• Your key stays in this browser&rsquo;s local storage; nothing leaves except direct calls to OpenAI.</li>
        <li>• Turning it off here hides the &ldquo;Suggest from context&rdquo; widget everywhere in the app.</li>
        <li>• The Coach panel (coming soon) will use the same key.</li>
      </ul>
    </section>
  );
}
