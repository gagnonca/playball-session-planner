import React from 'react';
import { useDiagram } from '../DiagramContext';
import { CONE_COLORS, LINE_TYPES, SHAPE_TYPES } from '../utils/constants';

const QuickActionsBubble = ({ position, containerRef }) => {
  const {
    selectedShapes,
    selectedLines,
    deleteSelected,
    updateSelectedShapeColor,
    updateSelectedLineType,
    toggleSelectedLineArrows,
  } = useDiagram();

  // Don't render if nothing selected or no position
  if (!position || (selectedShapes.length === 0 && selectedLines.length === 0)) {
    return null;
  }

  // Determine what controls to show
  const hasOnlyLines = selectedShapes.length === 0 && selectedLines.length > 0;
  const hasOnlyCones = selectedShapes.length > 0 &&
    selectedShapes.every(s => s.type === SHAPE_TYPES.CONE) &&
    selectedLines.length === 0;

  // Get current line type if all selected lines are same type
  const currentLineType = hasOnlyLines && selectedLines.every(l => l.type === selectedLines[0].type)
    ? selectedLines[0].type
    : null;

  // Get current arrow state if all selected lines have same state
  const currentArrowState = hasOnlyLines && selectedLines.every(l => l.hasArrow === selectedLines[0].hasArrow)
    ? selectedLines[0].hasArrow
    : null;

  // Calculate position relative to container
  const containerRect = containerRef?.current?.getBoundingClientRect();
  const bubbleStyle = {
    position: 'absolute',
    left: `${position.x}px`,
    top: `${position.y - 60}px`,
    transform: 'translateX(-50%)',
    zIndex: 100,
  };

  return (
    <div style={bubbleStyle}>
      <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-2 flex items-center gap-2">
        {/* Delete button - always shown */}
        <button
          onClick={deleteSelected}
          className="p-2 hover:bg-red-600 rounded-md transition-colors text-slate-300 hover:text-white"
          title="Delete"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>

        {/* Line controls */}
        {hasOnlyLines && (
          <>
            <div className="w-px h-6 bg-slate-600" />

            {/* Arrow toggle */}
            <button
              onClick={toggleSelectedLineArrows}
              className={`p-2 rounded-md transition-colors ${
                currentArrowState ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-300'
              }`}
              title={currentArrowState ? 'Hide arrow' : 'Show arrow'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>

            <div className="w-px h-6 bg-slate-600" />

            {/* Line type buttons */}
            <div className="flex gap-1">
              <button
                onClick={() => updateSelectedLineType(LINE_TYPES.PASS)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  currentLineType === LINE_TYPES.PASS
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-slate-700 text-slate-300'
                }`}
                title="Solid line (Pass)"
              >
                Pass
              </button>
              <button
                onClick={() => updateSelectedLineType(LINE_TYPES.MOVEMENT)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  currentLineType === LINE_TYPES.MOVEMENT
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-slate-700 text-slate-300'
                }`}
                title="Dashed line (Movement)"
              >
                Move
              </button>
              <button
                onClick={() => updateSelectedLineType(LINE_TYPES.DRIBBLE)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  currentLineType === LINE_TYPES.DRIBBLE
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-slate-700 text-slate-300'
                }`}
                title="Wavy line (Dribble)"
              >
                Dribble
              </button>
            </div>
          </>
        )}

        {/* Cone color swatches */}
        {hasOnlyCones && (
          <>
            <div className="w-px h-6 bg-slate-600" />
            <div className="flex gap-1">
              {CONE_COLORS.map((cone) => (
                <button
                  key={cone.value}
                  onClick={() => updateSelectedShapeColor(cone.color)}
                  className="w-6 h-6 rounded-md border-2 border-transparent hover:border-white transition-colors"
                  style={{ backgroundColor: cone.color }}
                  title={cone.label}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default QuickActionsBubble;
