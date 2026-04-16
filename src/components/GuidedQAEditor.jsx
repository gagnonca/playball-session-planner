import { useState, useEffect } from 'react';

export default function GuidedQAEditor({ value, onChange, placeholder, aiButton }) {
  const [showText, setShowText] = useState(false);
  const [pairs, setPairs] = useState([]);

  // Parse text format to pairs
  useEffect(() => {
    const parsed = [];
    if (value) {
      const lines = value.split('\n');
      let currentQ = null;
      for (const line of lines) {
        const qMatch = line.match(/^Q(\d+):\s*(.*)/);
        const aMatch = line.match(/^A(\d+):\s*(.*)/);
        if (qMatch) {
          if (currentQ) parsed.push(currentQ);
          currentQ = { num: parseInt(qMatch[1]), q: qMatch[2], a: '' };
        } else if (aMatch && currentQ) {
          currentQ.a = aMatch[2];
        } else if (line.trim() && currentQ) {
          if (currentQ.a) currentQ.a += '\n' + line;
          else currentQ.q += '\n' + line;
        }
      }
      if (currentQ) parsed.push(currentQ);
    }
    setPairs(parsed);
  }, [value]);

  const handleAddPair = () => {
    const newNum = pairs.length > 0 ? Math.max(...pairs.map(p => p.num)) + 1 : 1;
    setPairs([...pairs, { num: newNum, q: '', a: '' }]);
  };

  const handleUpdatePair = (index, field, val) => {
    const updated = [...pairs];
    updated[index][field] = val;
    setPairs(updated);
    syncToText(updated);
  };

  const handleRemovePair = (index) => {
    const updated = pairs.filter((_, i) => i !== index);
    setPairs(updated);
    syncToText(updated);
  };

  const syncToText = (pairsToSync) => {
    const text = pairsToSync
      .map(p => `Q${p.num}: ${p.q}\nA${p.num}: ${p.a}`)
      .join('\n');
    onChange(text);
  };

  if (showText) {
    return (
      <div>
        <label className="label-text flex items-center justify-between">
          <span>Guided Q&A</span>
          <button
            type="button"
            onClick={() => setShowText(false)}
            className="text-xs text-slate-400 hover:text-slate-300 px-2 py-1"
          >
            ← Structured
          </button>
        </label>
        <div className="relative">
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className="input-field resize-none overflow-hidden pr-10 font-mono text-sm"
            placeholder={placeholder}
          />
          {aiButton && <div className="absolute top-2 right-2">{aiButton}</div>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="label-text flex items-center justify-between">
        <span>Guided Q&A</span>
        <button
          type="button"
          onClick={() => setShowText(true)}
          className="text-xs text-slate-400 hover:text-slate-300 px-2 py-1"
        >
          Text Mode →
        </button>
      </label>

      <div className="space-y-3">
        {pairs.map((pair, idx) => (
          <div key={idx} className="border border-slate-700 rounded-lg p-3 bg-slate-900/50">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-300">Q{pair.num}:</label>
              {pairs.length > 0 && (
                <button
                  onClick={() => handleRemovePair(idx)}
                  className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded text-xs"
                  title="Remove pair"
                >
                  ×
                </button>
              )}
            </div>
            <textarea
              value={pair.q}
              onChange={(e) => handleUpdatePair(idx, 'q', e.target.value)}
              placeholder="What question do you ask?"
              className="input-field resize-none mb-2 text-sm h-16"
            />

            <label className="text-sm font-semibold text-slate-300 block mb-1">A{pair.num}:</label>
            <textarea
              value={pair.a}
              onChange={(e) => handleUpdatePair(idx, 'a', e.target.value)}
              placeholder="What answer do you expect?"
              className="input-field resize-none text-sm h-16"
            />
          </div>
        ))}

        <button
          onClick={handleAddPair}
          className="w-full py-2 px-3 border border-dashed border-slate-600 rounded-lg text-slate-400 hover:text-slate-300 hover:border-slate-500 transition-colors text-sm"
        >
          + Add Q&A Pair
        </button>

        {aiButton && (
          <div className="flex justify-end">
            {aiButton}
          </div>
        )}
      </div>
    </div>
  );
}
