import React from 'react';
import { useDiagram } from '../DiagramContext';
import { TOOL_MODES, CONE_COLORS, ATTACKER_COLOR, DEFENDER_COLOR } from '../utils/constants';

const ToolButton = ({ active, onClick, children, title }) => (
  <button
    onClick={onClick}
    title={title}
    className={`w-full p-3 rounded-lg text-left flex items-center gap-2 transition-all ${
      active
        ? 'bg-blue-600 text-white ring-2 ring-blue-400'
        : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
    }`}
  >
    {children}
  </button>
);

const Toolbar = () => {
  const {
    toolMode,
    setToolMode,
    selectedConeColor,
    setSelectedConeColor,
    currentLine,
  } = useDiagram();

  const isDrawingLine = currentLine !== null;

  return (
    <div className="w-48 bg-slate-800 border-r border-slate-700 flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Tools</h3>
      </div>

      <div className="p-3 space-y-4 flex-1">
        {/* Select Tool */}
        <div>
          <ToolButton
            active={toolMode === TOOL_MODES.SELECT}
            onClick={() => setToolMode(TOOL_MODES.SELECT)}
            title="Select and move elements"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
            <span>Select</span>
          </ToolButton>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-600 pt-4">
          <h4 className="text-xs font-medium text-slate-400 mb-2 uppercase">Equipment</h4>
          <div className="space-y-2">
            <ToolButton
              active={toolMode === TOOL_MODES.BALL}
              onClick={() => setToolMode(TOOL_MODES.BALL)}
              title="Place soccer ball"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" fill="white" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 2c1.93 0 3.68.69 5.05 1.83L12 8.17l-5.05-2.34A7.94 7.94 0 0112 4zm-7.1 4.5L9.41 11H4.26c.14-1.03.45-2 .89-2.88l-.25.38zm-.64 3.5h5.25l-3.24 4.43A7.94 7.94 0 014 12c0-.34.02-.67.05-1zm5.49 6.65L12 15.52l2.25 3.13A7.94 7.94 0 0112 20c-1.53 0-2.96-.42-4.18-1.15l1.93-.2zm8.18-1.15L14.59 13h5.15a7.94 7.94 0 01-3.81 5.5zm3.81-5.5h-5.25l3.24-4.43A7.94 7.94 0 0120 12c0 .34-.02.67-.05 1zm-5.49-6.65L12 8.48 9.75 5.35A7.94 7.94 0 0112 4c1.53 0 2.96.42 4.18 1.15l-1.93.2z" fill="currentColor"/>
              </svg>
              <span>Ball</span>
            </ToolButton>

            <ToolButton
              active={toolMode === TOOL_MODES.GOAL}
              onClick={() => setToolMode(TOOL_MODES.GOAL)}
              title="Place goal"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="8" width="20" height="14" rx="1" fill="white" stroke="currentColor"/>
                <line x1="2" y1="8" x2="2" y2="22" strokeWidth="2.5"/>
                <line x1="22" y1="8" x2="22" y2="22" strokeWidth="2.5"/>
                <line x1="2" y1="8" x2="22" y2="8" strokeWidth="2.5"/>
                <line x1="6" y1="8" x2="6" y2="22" strokeWidth="0.5" opacity="0.5"/>
                <line x1="10" y1="8" x2="10" y2="22" strokeWidth="0.5" opacity="0.5"/>
                <line x1="14" y1="8" x2="14" y2="22" strokeWidth="0.5" opacity="0.5"/>
                <line x1="18" y1="8" x2="18" y2="22" strokeWidth="0.5" opacity="0.5"/>
                <line x1="2" y1="12" x2="22" y2="12" strokeWidth="0.5" opacity="0.5"/>
                <line x1="2" y1="16" x2="22" y2="16" strokeWidth="0.5" opacity="0.5"/>
                <line x1="2" y1="20" x2="22" y2="20" strokeWidth="0.5" opacity="0.5"/>
              </svg>
              <span>Goal</span>
            </ToolButton>
          </div>
        </div>

        {/* Cones */}
        <div className="border-t border-slate-600 pt-4">
          <h4 className="text-xs font-medium text-slate-400 mb-2 uppercase">Cones</h4>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {CONE_COLORS.map((cone) => (
              <button
                key={cone.value}
                onClick={() => {
                  setSelectedConeColor(cone.color);
                  setToolMode(TOOL_MODES.CONE);
                }}
                className={`w-8 h-8 rounded-md transition-all ${
                  toolMode === TOOL_MODES.CONE && selectedConeColor === cone.color
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800'
                    : 'hover:scale-110'
                }`}
                style={{ backgroundColor: cone.color }}
                title={`${cone.label} cone`}
              />
            ))}
          </div>
          <ToolButton
            active={toolMode === TOOL_MODES.CONE}
            onClick={() => setToolMode(TOOL_MODES.CONE)}
            title="Place cone"
          >
            <div
              className="w-5 h-5 rounded-sm"
              style={{
                backgroundColor: selectedConeColor,
                clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
              }}
            />
            <span>Place Cone</span>
          </ToolButton>
        </div>

        {/* Players */}
        <div className="border-t border-slate-600 pt-4">
          <h4 className="text-xs font-medium text-slate-400 mb-2 uppercase">Players</h4>
          <div className="space-y-2">
            <ToolButton
              active={toolMode === TOOL_MODES.ATTACKER}
              onClick={() => setToolMode(TOOL_MODES.ATTACKER)}
              title="Place attacker (red circle)"
            >
              <div
                className="w-5 h-5 rounded-full border-2 border-black"
                style={{ backgroundColor: ATTACKER_COLOR }}
              />
              <span>Attacker</span>
            </ToolButton>

            <ToolButton
              active={toolMode === TOOL_MODES.DEFENDER}
              onClick={() => setToolMode(TOOL_MODES.DEFENDER)}
              title="Place defender (blue triangle)"
            >
              <div
                className="w-5 h-5 border-2 border-black"
                style={{
                  backgroundColor: DEFENDER_COLOR,
                  clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
                }}
              />
              <span>Defender</span>
            </ToolButton>
          </div>
        </div>

        {/* Lines */}
        <div className="border-t border-slate-600 pt-4">
          <h4 className="text-xs font-medium text-slate-400 mb-2 uppercase">Lines</h4>
          <div className="space-y-2">
            <ToolButton
              active={toolMode === TOOL_MODES.PASS}
              onClick={() => setToolMode(TOOL_MODES.PASS)}
              title="Draw pass line (solid arrow)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              <span>Pass</span>
            </ToolButton>

            <ToolButton
              active={toolMode === TOOL_MODES.MOVEMENT}
              onClick={() => setToolMode(TOOL_MODES.MOVEMENT)}
              title="Draw movement line (dashed arrow)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeDasharray="4 2">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              <span>Movement</span>
            </ToolButton>

            <ToolButton
              active={toolMode === TOOL_MODES.DRIBBLE}
              onClick={() => setToolMode(TOOL_MODES.DRIBBLE)}
              title="Draw dribble line (wavy arrow)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12c2-2 4 2 6 0s4 2 6 0s4 2 6 0" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4-4 4" />
              </svg>
              <span>Dribble</span>
            </ToolButton>
          </div>
        </div>

        {/* Drawing hint */}
        {isDrawingLine && (
          <div className="border-t border-slate-600 pt-4">
            <div className="p-3 bg-blue-900/50 border border-blue-500 rounded-lg text-sm text-blue-200">
              <p className="font-medium">Drawing line...</p>
              <p className="text-xs mt-1 text-blue-300">
                Click to add points<br />
                Double-click to finish<br />
                Press ESC to cancel
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="p-3 border-t border-slate-700 text-xs text-slate-400">
        <p><strong>Tip:</strong> Click to place, tool stays active for quick multi-placement.</p>
      </div>
    </div>
  );
};

export default Toolbar;
