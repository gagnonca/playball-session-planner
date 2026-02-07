/**
 * Expert coaching prompts for AI-assisted content generation.
 * Based on Play-Practice-Play methodology and youth soccer best practices.
 */

// System prompt with expert coaching knowledge
export const EXPERT_SYSTEM_PROMPT = `You are an expert youth soccer coach trained in the Play-Practice-Play methodology.

COACHING PHILOSOPHY:
- Player-centered learning: Guide discovery through questions, don't just instruct
- Age-appropriate: Simpler language and concepts for younger players, more tactical for older
- Fun first: Engagement and enjoyment drive learning
- Game-realistic: Practice activities should look and feel like the real game
- Minimal lines: Maximize touches, minimize standing around
- Small-sided games: More touches, more decisions, more fun

FORMATTING RULES:
- Use bullet points (•) for lists
- Keep language simple and actionable
- Be concise but complete
- No coaching jargon unless age-appropriate
- Write as if speaking to the coach, not the players

AGE GROUP GUIDELINES:
- U6-U8: Focus on fun, basic ball familiarity, lots of touches, small groups (1v1, 2v2), simple rules, celebrate effort
- U9-U10: Introduce simple tactics, 3v3 and 4v4 games, guided discovery questions, basic positions
- U11-U12: More complex decisions, positional awareness, 5v5 to 7v7, tactical concepts
- U13+: Tactical detail, game understanding, full formations, sophisticated decision-making`;

// Field-specific prompt builders
export const FIELD_PROMPTS = {
  objective: (context) => `Generate an objective for this ${context.sectionType} activity.

SESSION CONTEXT:
- Moment of the game: ${context.moment || 'General'}
- Age group: ${context.ageGroup || 'Youth'}
- Session focus: ${context.playerActions?.join(', ') || 'Not specified'}
- Key qualities: ${context.keyQualities?.join(', ') || 'Not specified'}
- Section name: ${context.sectionName || 'Not specified'}

USER'S ACTIVITY DESCRIPTION:
${context.userPrompt}

Write 1-2 clear sentences describing:
- What players will learn, practice, or improve
- How this connects to the game moment
- Use age-appropriate language

Format: Plain text, no bullet points. Be specific and actionable.`,

  organization: (context) => `Generate organization/setup instructions for this ${context.sectionType} activity.

SESSION CONTEXT:
- Moment of the game: ${context.moment || 'General'}
- Age group: ${context.ageGroup || 'Youth'}
- Section name: ${context.sectionName || 'Not specified'}
- Objective: ${context.objective || 'Not specified'}

USER'S ACTIVITY DESCRIPTION:
${context.userPrompt}

Provide clear, concise setup instructions including:
• Field/grid size (appropriate for age group)
• Number of players per group
• Equipment needed (balls, cones, goals)
• Starting positions
• Basic rules of the activity

Format: Use bullet points (•). Keep it scannable - coaches read this on the field.
For ${context.ageGroup || 'youth'}: ${getAgeSizeGuidance(context.ageGroup)}`,

  guidedQA: (context) => `Generate guided discovery questions with answers for this practice activity.

SESSION CONTEXT:
- Moment of the game: ${context.moment || 'General'}
- Age group: ${context.ageGroup || 'Youth'}
- Objective: ${context.objective || 'Not specified'}
- Key qualities to develop: ${context.keyQualities?.join(', ') || 'Not specified'}

USER'S ACTIVITY DESCRIPTION:
${context.userPrompt}

GUIDED DISCOVERY PRINCIPLES:
- Questions help players discover solutions themselves (don't just tell them)
- Avoid yes/no questions - use "what", "when", "where", "how", "why"
- Questions should relate directly to game situations
- Answers are key coaching points for the coach's reference
- ${context.ageGroup?.startsWith('U6') || context.ageGroup?.startsWith('U7') || context.ageGroup?.startsWith('U8') ? 'Keep questions very simple for young players' : 'Questions can be more tactical for this age group'}

Generate exactly 3 question-answer pairs in this EXACT format:

Q1: [First guided question]
A1: [Key coaching point/answer]

Q2: [Second guided question]
A2: [Key coaching point/answer]

Q3: [Third guided question]
A3: [Key coaching point/answer]`,

  notes: (context) => `Generate coaching notes for this ${context.sectionType} activity.

SESSION CONTEXT:
- Moment of the game: ${context.moment || 'General'}
- Age group: ${context.ageGroup || 'Youth'}
- Section name: ${context.sectionName || 'Not specified'}
- Objective: ${context.objective || 'Not specified'}
- Organization: ${context.organization || 'Not specified'}
- Guided Q&A: ${context.guidedQA || 'Not specified'}

USER'S REQUEST:
${context.userPrompt}

Provide helpful coaching notes including any of:
• Coaching tips or key things to watch for
• Common mistakes and how to address them
• Progressions or variations to make it easier/harder
• Safety considerations if relevant
• Ways to keep it fun and engaging

Format: Use bullet points (•). Be practical and actionable.`,
};

// Helper function for age-appropriate field sizes
function getAgeSizeGuidance(ageGroup) {
  if (!ageGroup) return 'Use appropriate field size for the age group';

  const age = ageGroup.toUpperCase();
  if (age.includes('U6') || age.includes('U7') || age.includes('U8')) {
    return 'Use small grids (15x20 yards max), 1v1 to 3v3, lots of balls';
  }
  if (age.includes('U9') || age.includes('U10')) {
    return 'Use medium grids (20x25 yards), 3v3 to 4v4, pugg goals or small goals';
  }
  if (age.includes('U11') || age.includes('U12')) {
    return 'Use larger grids (25x35 yards), 4v4 to 6v6, small goals or full goals';
  }
  return 'Use full-size grids, 7v7+, tactical formations';
}

// Placeholder guidance for each field
export const FIELD_PLACEHOLDERS = {
  objective: 'Describe what players will do in this activity...',
  organization: 'Describe your setup, grid size, player arrangement...',
  guidedQA: 'Describe what you want players to discover...',
  notes: 'Describe what tips or variations you need...',
};
