import React from 'react';

export default function Variation({ variation, onUpdate, onRemove }) {
  const handleChange = (field, value) => {
    onUpdate({ ...variation, [field]: value });
  };

  return (
    <div className="mt-4 p-4 bg-slate-900/30 border border-slate-700 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <input
          type="text"
          value={variation.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="Variation name (e.g., Less Challenging)"
          className="input-field font-semibold flex-1"
        />
        <button
          onClick={onRemove}
          className="btn btn-danger ml-3 no-print"
        >
          Remove
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label-text">Objective</label>
          <textarea
            value={variation.objective}
            onChange={(e) => handleChange('objective', e.target.value)}
            rows="3"
            className="input-field resize-y"
          />
        </div>

        <div>
          <label className="label-text">Organization</label>
          <textarea
            value={variation.organization}
            onChange={(e) => handleChange('organization', e.target.value)}
            rows="3"
            className="input-field resize-y"
          />
        </div>

        <div>
          <label className="label-text">Guided questions</label>
          <textarea
            value={variation.questions}
            onChange={(e) => handleChange('questions', e.target.value)}
            rows="3"
            className="input-field resize-y"
          />
        </div>

        <div>
          <label className="label-text">Answers</label>
          <textarea
            value={variation.answers}
            onChange={(e) => handleChange('answers', e.target.value)}
            rows="3"
            className="input-field resize-y"
          />
        </div>

        <div>
          <label className="label-text">Notes</label>
          <textarea
            value={variation.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows="3"
            className="input-field resize-y"
          />
        </div>
      </div>
    </div>
  );
}
