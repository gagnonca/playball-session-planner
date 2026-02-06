// Unified diagram constants - single source of truth

// Cone colors available in diagram builder
export const CONE_COLORS = [
  { id: 'orange', label: 'Orange', color: '#FF6B35' },
  { id: 'yellow', label: 'Yellow', color: '#FDD835' },
  { id: 'blue', label: 'Blue', color: '#42A5F5' },
  { id: 'green', label: 'Green', color: '#66BB6A' },
];

// Field types with dimensions
export const FIELD_TYPES = [
  { id: 'full', label: 'Full Field', width: 700, height: 525 },
  { id: 'small', label: 'Small Field', width: 700, height: 525 },
];

// Tool modes for diagram builder
export const TOOLS = {
  SELECT: 'select',
  ATTACKER: 'attacker',
  DEFENDER: 'defender',
  BALL: 'ball',
  GOAL: 'goal',
  CONE: 'cone',
  LINE: 'line',
  FIELD: 'field',
};

// Line types
export const LINE_TYPES = {
  PASS: 'pass',
  MOVEMENT: 'movement',
  DRIBBLE: 'dribble',
};

// Shape types
export const SHAPE_TYPES = {
  ATTACKER: 'attacker',
  DEFENDER: 'defender',
  GOAL: 'goal',
  CONE: 'cone',
  BALL: 'ball',
};

// Player colors
export const PLAYER_COLORS = {
  ATTACKER: '#EF4444',
  DEFENDER: '#3B82F6',
};

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

// Arrow configuration
export const ARROW_CONFIG = {
  pointerLength: 12,
  pointerWidth: 10,
};

// Game moments for tagging
export const MOMENTS = [
  'Attacking',
  'Defending',
  'Transition to Attack',
  'Transition to Defense',
];
