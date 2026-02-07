/**
 * Expert coaching prompts for AI-assisted content generation.
 * Based on Play-Practice-Play methodology and youth soccer best practices.
 *
 * AI generates "inspiration" based on filled-in context - no user prompting needed.
 */

// System prompt with expert coaching knowledge
export const EXPERT_SYSTEM_PROMPT = `You are an expert youth soccer coach. Generate concise, practical content.

RULES:
• Be brief - coaches read this on the field
• Age-appropriate language
• Game-realistic activities
• No headers or titles in output
• Use bullet points (•) only when specified

AGE GROUPS:
• U5-U8: 4v4 max, fun focus, 1v1/2v2, simple rules
• U9-U10: 7v7, basic tactics, 3v3/4v4, guided questions
• U11-U12: 9v9, positional play, 5v5-7v7
• U13+: 11v11, tactical detail, formations`;

// Field-specific prompt builders - generate from context, no user prompt needed
export const FIELD_PROMPTS = {
  objective: (context) => `Write a 1-2 sentence objective for this ${context.sectionType} activity.

CONTEXT:
${context.sectionName ? `• Activity: ${context.sectionName}` : ''}
${context.moment ? `• Moment: ${context.moment}` : ''}
${context.ageGroup ? `• Age: ${context.ageGroup}` : ''}
${context.playerActions?.length ? `• Focus: ${context.playerActions.join(', ')}` : ''}
${context.organization ? `• Setup: ${context.organization}` : ''}

Write what players will learn or improve. Plain text, no bullets.`,

  organization: (context) => `Write brief setup instructions for this ${context.sectionType} activity.

CONTEXT:
${context.sectionName ? `• Activity: ${context.sectionName}` : ''}
${context.moment ? `• Moment: ${context.moment}` : ''}
${context.ageGroup ? `• Age: ${context.ageGroup}` : ''}
${context.objective ? `• Objective: ${context.objective}` : ''}

Include ONLY (use bullet points •):
• Grid size
• Players per group
• Equipment
• How to play

${context.ageGroup ? `Size guide for ${context.ageGroup}: ${getAgeSizeGuidance(context.ageGroup)}` : ''}

Max 5 bullet points. No headers. No Q&A.`,

  guidedQA: (context) => `Generate 2-3 guided discovery questions with answers.

CONTEXT:
${context.sectionName ? `• Activity: ${context.sectionName}` : ''}
${context.moment ? `• Moment: ${context.moment}` : ''}
${context.ageGroup ? `• Age: ${context.ageGroup}` : ''}
${context.objective ? `• Objective: ${context.objective}` : ''}
${context.keyQualities?.length ? `• Qualities: ${context.keyQualities.join(', ')}` : ''}

Questions help players discover solutions. Use "what/when/where/how".
${context.ageGroup?.match(/U[5-8]/i) ? 'Keep very simple for young players.' : ''}

Format EXACTLY like this:
Q1: [question]
A1: [key coaching point]

Q2: [question]
A2: [key coaching point]`,

  notes: (context) => `Generate 2-4 brief coaching notes.

CONTEXT:
${context.sectionName ? `• Activity: ${context.sectionName}` : ''}
${context.objective ? `• Objective: ${context.objective}` : ''}
${context.organization ? `• Setup: ${context.organization}` : ''}
${context.ageGroup ? `• Age: ${context.ageGroup}` : ''}

Include any of:
• Key things to watch for
• Common mistakes to correct
• Progressions (easier/harder)

Use bullet points (•). Max 4 bullets. No headers.`,
};

// Helper function for age-appropriate field sizes
function getAgeSizeGuidance(ageGroup) {
  if (!ageGroup) return '';
  const age = ageGroup.toUpperCase();
  if (age.match(/U[5-8]/)) return '15x20 yards, 1v1-3v3';
  if (age.match(/U(9|10)/)) return '20x25 yards, 3v3-4v4';
  if (age.match(/U(11|12)/)) return '25x35 yards, 4v4-6v6';
  return '30x40+ yards, 7v7+';
}
