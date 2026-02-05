import React from 'react';
import { useDiagram } from '../DiagramContext';
import { CONE_COLORS, LINE_TYPES, SHAPE_TYPES, FIELD_TEMPLATES } from '../utils/constants';

const InspectorPanel = () => {
  const {
    fieldType,
    setFieldType,
    selectedShapes,
    selectedLines,
    hasSelection,
    deleteSelected,
    updateSelectedShapeColor,
    updateSelectedLineType,
    toggleSelectedLineArrows,
    clearAll,
    diagramName,
    setDiagramName,
  } = useDiagram();

  // Determine selection type
  const selectionCount = selectedShapes.length + selectedLines.length;
  const hasOnlyLines = selectedShapes.length === 0 && selectedLines.length > 0;
  const hasOnlyCones = selectedShapes.length > 0 &&
    selectedShapes.every(s => s.type === SHAPE_TYPES.CONE) &&
    selectedLines.length === 0;
  const hasMixedSelection = selectedShapes.length > 0 && selectedLines.length > 0;

  // Get current states for selected items
  const currentLineType = hasOnlyLines && selectedLines.every(l => l.type === selectedLines[0].type)
    ? selectedLines[0].type
    : null;
  const currentArrowState = hasOnlyLines && selectedLines.every(l => l.hasArrow === selectedLines[0].hasArrow)
    ? selectedLines[0].hasArrow
    : null;
  const currentConeColor = hasOnlyCones && selectedShapes.every(s => s.color === selectedShapes[0].color)
    ? selectedShapes[0].color
    : null;

  return (
    <div className="w-56 bg-slate-800 border-l border-slate-700 flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Properties</h3>
      </div>

      <div className="p-3 space-y-4 flex-1">
        {/* Diagram Name */}
        <div>
          <label className="label-text">Diagram Name</label>
          <input
            type="text"
            value={diagramName}
            onChange={(e) => setDiagramName(e.target.value)}
            placeholder="Untitled Diagram"
            className="input-field"
          />
        </div>

        {/* Field Template */}
        <div>
          <label className="label-text">Field Template</label>
          <select
            value={fieldType.value}
            onChange={(e) => {
              const template = FIELD_TEMPLATES.find(t => t.value === e.target.value);
              if (template) setFieldType(template);
            }}
            className="input-field"
          >
            {FIELD_TEMPLATES.map((template) => (
              <option key={template.value} value={template.value}>
                {template.label}
              </option>
            ))}
          </select>
        </div>

        {/* Selection Panel */}
        {hasSelection ? (
          <div className="border-t border-slate-700 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-slate-300">Selection</h4>
              <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded">
                {selectionCount} item{selectionCount !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Line Controls */}
            {hasOnlyLines && (
              <div className="space-y-3">
                <div>
                  <label className="label-text">Line Type</label>
                  <div className="flex flex-col gap-1">
                    {Object.values(LINE_TYPES).map((type) => (
                      <button
                        key={type}
                        onClick={() => updateSelectedLineType(type)}
                        className={`w-full p-2 text-left rounded-md text-sm transition-colors flex items-center gap-2 ${
                          currentLineType === type
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                        }`}
                      >
                        {type === LINE_TYPES.PASS && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        )}
                        {type === LINE_TYPES.MOVEMENT && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeDasharray="4 2">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        )}
                        {type === LINE_TYPES.DRIBBLE && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12c2-2 4 2 6 0s4 2 6 0s4 2 6 0" />
                          </svg>
                        )}
                        <span className="capitalize">{type}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label-text">Arrow</label>
                  <button
                    onClick={toggleSelectedLineArrows}
                    className={`w-full p-2 rounded-md text-sm transition-colors flex items-center justify-center gap-2 ${
                      currentArrowState
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <span>{currentArrowState ? 'Arrow On' : 'Arrow Off'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Cone Color Controls */}
            {hasOnlyCones && (
              <div>
                <label className="label-text">Cone Color</label>
                <div className="grid grid-cols-5 gap-2">
                  {CONE_COLORS.map((cone) => (
                    <button
                      key={cone.value}
                      onClick={() => updateSelectedShapeColor(cone.color)}
                      className={`w-full aspect-square rounded-md transition-all ${
                        currentConeColor === cone.color
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800'
                          : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: cone.color }}
                      title={cone.label}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Mixed or general selection */}
            {(hasMixedSelection || (!hasOnlyLines && !hasOnlyCones && hasSelection)) && (
              <p className="text-xs text-slate-500">
                Select items of the same type to edit properties.
              </p>
            )}

            {/* Delete button */}
            <button
              onClick={deleteSelected}
              className="w-full btn btn-danger mt-4"
            >
              Delete Selected
            </button>
          </div>
        ) : (
          <div className="border-t border-slate-700 pt-4">
            <p className="text-sm text-slate-500 text-center">
              Select an element to view its properties
            </p>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="p-3 border-t border-slate-700 space-y-2">
        <button
          onClick={() => {
            if (confirm('Clear all elements from the diagram?')) {
              clearAll();
            }
          }}
          className="w-full btn btn-subtle text-sm"
        >
          Clear All
        </button>
      </div>
    </div>
  );
};

export default InspectorPanel;
