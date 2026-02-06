// Tool modes
export const TOOL_MODES = {
  SELECT: 'select',
  // Stamp tools
  ATTACKER: 'attacker',
  DEFENDER: 'defender',
  GOAL: 'goal',
  CONE: 'cone',
  BALL: 'ball',
  // Line tools
  PASS: 'pass',
  MOVEMENT: 'movement',
  DRIBBLE: 'dribble',
};

// Tool categories for logic branching
export const isStampTool = (mode) =>
  [TOOL_MODES.ATTACKER, TOOL_MODES.DEFENDER, TOOL_MODES.GOAL, TOOL_MODES.CONE, TOOL_MODES.BALL].includes(mode);

export const isLineTool = (mode) =>
  [TOOL_MODES.PASS, TOOL_MODES.MOVEMENT, TOOL_MODES.DRIBBLE].includes(mode);

// Cone colors
export const CONE_COLORS = [
  { value: 'orange', label: 'Orange', color: '#FF6B35' },
  { value: 'yellow', label: 'Yellow', color: '#FDD835' },
  { value: 'blue', label: 'Blue', color: '#42A5F5' },
  { value: 'green', label: 'Green', color: '#66BB6A' },
];

// Field templates - sized to fit comfortably in modal
export const FIELD_TEMPLATES = [
  { value: 'full', label: 'Full Field', width: 800, height: 533 },
  { value: 'half', label: 'Half Field', width: 800, height: 300 },
  { value: 'thirds', label: 'Thirds', width: 800, height: 240 },
  { value: 'penalty', label: 'Penalty Box', width: 600, height: 450 },
];

// Default field
export const DEFAULT_FIELD = FIELD_TEMPLATES[0];

// Shape types for element identification
export const SHAPE_TYPES = {
  ATTACKER: 'attacker',
  DEFENDER: 'defender',
  GOAL: 'goal',
  CONE: 'cone',
  BALL: 'ball',
};

// Line types
export const LINE_TYPES = {
  PASS: 'pass',
  MOVEMENT: 'movement',
  DRIBBLE: 'dribble',
};

// Player colors
export const ATTACKER_COLOR = '#EF4444';
export const DEFENDER_COLOR = '#3B82F6';

// Line styling
export const LINE_STYLES = {
  [LINE_TYPES.PASS]: {
    stroke: '#000000',
    strokeWidth: 4,
    dash: null,
  },
  [LINE_TYPES.MOVEMENT]: {
    stroke: '#000000',
    strokeWidth: 4,
    dash: [10, 8],
  },
  [LINE_TYPES.DRIBBLE]: {
    stroke: '#000000',
    strokeWidth: 4,
    dash: null,
    isWave: true,
  },
};

// Arrow settings
export const ARROW_CONFIG = {
  pointerLength: 12,
  pointerWidth: 10,
};

// Re-export from shared utility
export { generateId } from '../../../utils/id';
