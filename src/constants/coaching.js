/**
 * Coaching constants for moment-based filtering of player actions and key qualities.
 * These mappings help guide coaches to relevant options based on the selected moment.
 */

// Player actions grouped by relevance to each moment
export const MOMENT_ACTIONS = {
  'Attacking': {
    primary: ['Pass', 'Dribble', 'Shoot', 'Receive', 'Create space'],
    secondary: ['Support', 'Scan', 'Communicate'],
  },
  'Defending': {
    primary: ['Press', 'Defend', 'Tackle', 'Intercept', 'Clear'],
    secondary: ['Communicate', 'Support', 'Scan'],
  },
  'Transition to Attack': {
    primary: ['Receive', 'Pass', 'Dribble', 'Scan', 'Create space'],
    secondary: ['Support', 'Shoot', 'Communicate'],
  },
  'Transition to Defense': {
    primary: ['Press', 'Intercept', 'Communicate', 'Defend'],
    secondary: ['Tackle', 'Clear', 'Support', 'Scan'],
  },
};

// Key qualities grouped by relevance to each moment
export const MOMENT_QUALITIES = {
  'Attacking': {
    primary: ['Vision', 'Quick thinking', 'Timing', 'First touch', 'Composure'],
    secondary: ['Ball control', 'Technical execution', 'Communication'],
  },
  'Defending': {
    primary: ['Focus', 'Read & decide', 'Awareness', 'Communication', 'Teamwork'],
    secondary: ['Composure', 'Timing', 'Technical execution'],
  },
  'Transition to Attack': {
    primary: ['Quick thinking', 'Awareness', 'First touch', 'Vision', 'Scan'],
    secondary: ['Composure', 'Technical execution', 'Communication'],
  },
  'Transition to Defense': {
    primary: ['Focus', 'Read & decide', 'Awareness', 'Communication', 'Quick thinking'],
    secondary: ['Teamwork', 'Composure', 'Technical execution'],
  },
};

// All available player actions (for reference)
export const ALL_PLAYER_ACTIONS = [
  'Pass',
  'Dribble',
  'Shoot',
  'Receive',
  'Support',
  'Press',
  'Defend',
  'Tackle',
  'Intercept',
  'Clear',
  'Create space',
  'Scan',
  'Communicate',
];

// All available key qualities (for reference)
export const ALL_KEY_QUALITIES = [
  'Read & decide',
  'Focus',
  'Technical execution',
  'Awareness',
  'Quick thinking',
  'Composure',
  'Vision',
  'Timing',
  'First touch',
  'Ball control',
  'Communication',
  'Teamwork',
];

// PPP Template definitions - pre-filled sections for Play-Practice-Play
export const PPP_TEMPLATES = {
  // Templates keyed by moment
  'Attacking': {
    play1: {
      name: 'Free Play',
      type: 'Play',
      time: '10 min',
      objective: 'Let players play freely. Encourage creativity, risk-taking, and lots of touches on the ball.',
      organization: 'Set up small-sided games (2v2 or 3v3) with small goals. Multiple fields if needed for more touches.',
    },
    practice: {
      name: 'Attacking Practice',
      type: 'Practice',
      time: '20 min',
      objective: 'Develop attacking skills through guided discovery.',
      organization: '',
      guidedQA: 'Q1: Where is the space?\nA1: Look for gaps between defenders, areas with fewer players\n\nQ2: How can you get there?\nA2: Move into open areas, check shoulder before receiving\n\nQ3: When should you pass vs dribble?\nA3: Pass when teammate is in better position, dribble when you have space',
    },
    play2: {
      name: 'The Game',
      type: 'Play',
      time: '15 min',
      objective: 'Apply attacking concepts in game context. Minimal stoppages, let them play.',
      organization: 'Scrimmage with appropriate numbers. Coach on the fly, celebrate good decisions.',
    },
  },
  'Defending': {
    play1: {
      name: 'Free Play',
      type: 'Play',
      time: '10 min',
      objective: 'Let players compete. Notice defending opportunities naturally arise.',
      organization: 'Small-sided games (2v2 or 3v3). Encourage quick restarts after goals.',
    },
    practice: {
      name: 'Defending Practice',
      type: 'Practice',
      time: '20 min',
      objective: 'Develop defending skills through guided discovery.',
      organization: '',
      guidedQA: 'Q1: When should you press?\nA1: Press when ball is close and you can win it\n\nQ2: Where should you position yourself?\nA2: Stay goal-side, between attacker and goal\n\nQ3: How do you work together?\nA3: Communicate with teammates, one presses while others cover',
    },
    play2: {
      name: 'The Game',
      type: 'Play',
      time: '15 min',
      objective: 'Apply defending concepts in game context. Celebrate good defending decisions.',
      organization: 'Scrimmage with appropriate numbers. Notice and praise good positioning.',
    },
  },
  'Transition to Attack': {
    play1: {
      name: 'Free Play',
      type: 'Play',
      time: '10 min',
      objective: 'Let players play. Notice moments when possession changes.',
      organization: 'Small-sided games with quick restarts to create many transition moments.',
    },
    practice: {
      name: 'Transition Practice',
      type: 'Practice',
      time: '20 min',
      objective: 'Recognize and exploit transition moments when winning the ball.',
      organization: '',
      guidedQA: 'Q1: What do you see when you win the ball?\nA1: Scan quickly for open teammates and space\n\nQ2: Where is the space?\nA2: Often behind the defenders who were attacking\n\nQ3: How fast should you play?\nA3: Play forward quickly when possible, before defense recovers',
    },
    play2: {
      name: 'The Game',
      type: 'Play',
      time: '15 min',
      objective: 'Apply transition concepts. Celebrate quick decisions after winning possession.',
      organization: 'Scrimmage focused on recognizing transition opportunities.',
    },
  },
  'Transition to Defense': {
    play1: {
      name: 'Free Play',
      type: 'Play',
      time: '10 min',
      objective: 'Let players play. Notice reactions when possession is lost.',
      organization: 'Small-sided games. Observe how players respond to losing the ball.',
    },
    practice: {
      name: 'Transition Practice',
      type: 'Practice',
      time: '20 min',
      objective: 'React quickly and intelligently when losing possession.',
      organization: '',
      guidedQA: 'Q1: What should you do immediately when you lose the ball?\nA1: React immediately - either press the ball or recover\n\nQ2: Where should you go?\nA2: Get goal-side, between the ball and your goal\n\nQ3: How do you decide to press or recover?\nA3: Press if close to ball, recover if far away',
    },
    play2: {
      name: 'The Game',
      type: 'Play',
      time: '15 min',
      objective: 'Apply transition to defense concepts. Praise quick reactions.',
      organization: 'Scrimmage focused on immediate response to losing possession.',
    },
  },
  // Default template when no moment selected
  'default': {
    play1: {
      name: 'Free Play',
      type: 'Play',
      time: '10 min',
      objective: 'Let players play freely. Build confidence and enjoyment.',
      organization: 'Set up small-sided games (2v2 or 3v3) with small goals.',
    },
    practice: {
      name: 'Practice Activity',
      type: 'Practice',
      time: '20 min',
      objective: '',
      organization: '',
      guidedQA: '',
    },
    play2: {
      name: 'The Game',
      type: 'Play',
      time: '15 min',
      objective: 'Apply skills in game context. Minimal stoppages.',
      organization: 'Scrimmage with appropriate numbers for age group.',
    },
  },
};
