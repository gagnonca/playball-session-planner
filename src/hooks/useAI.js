import { useState, useCallback } from 'react';
import { AI_CONFIG_KEY } from '../constants/storage';

/**
 * useAI Hook - OpenAI integration for content generation
 *
 * Features:
 * - Stores API key in localStorage (base64 encoded for basic obfuscation)
 * - Generates section content based on session context
 * - All API calls are made directly to OpenAI (client-side, BYOK model)
 */

const DEFAULT_MODEL = 'gpt-4o-mini'; // Cost-effective model for suggestions

// Simple encoding/decoding for API key storage (not encryption, just obfuscation)
const encodeKey = (key) => btoa(key);
const decodeKey = (encoded) => {
  try {
    return atob(encoded);
  } catch {
    return '';
  }
};

export default function useAI() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get stored config
  const getConfig = useCallback(() => {
    try {
      const stored = localStorage.getItem(AI_CONFIG_KEY);
      if (stored) {
        const config = JSON.parse(stored);
        return {
          ...config,
          apiKey: config.apiKey ? decodeKey(config.apiKey) : '',
        };
      }
    } catch (e) {
      console.error('Error reading AI config:', e);
    }
    return { apiKey: '', model: DEFAULT_MODEL };
  }, []);

  // Save config
  const saveConfig = useCallback((apiKey, model = DEFAULT_MODEL) => {
    try {
      const config = {
        apiKey: apiKey ? encodeKey(apiKey) : '',
        model,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
      return true;
    } catch (e) {
      console.error('Error saving AI config:', e);
      return false;
    }
  }, []);

  // Clear config
  const clearConfig = useCallback(() => {
    try {
      localStorage.removeItem(AI_CONFIG_KEY);
      return true;
    } catch (e) {
      console.error('Error clearing AI config:', e);
      return false;
    }
  }, []);

  // Check if AI is configured
  const isConfigured = useCallback(() => {
    const config = getConfig();
    return Boolean(config.apiKey && config.apiKey.length > 10);
  }, [getConfig]);

  // Validate API key with a test call
  const validateApiKey = useCallback(async (apiKey) => {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        return { valid: true };
      } else {
        const error = await response.json();
        return { valid: false, error: error.error?.message || 'Invalid API key' };
      }
    } catch (e) {
      return { valid: false, error: 'Failed to validate API key' };
    }
  }, []);

  // Make OpenAI API call
  const callOpenAI = useCallback(async (messages, options = {}) => {
    const config = getConfig();
    if (!config.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || config.model || DEFAULT_MODEL,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 500,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }, [getConfig]);

  // Generate section content
  const generateSectionContent = useCallback(async (context) => {
    const {
      moment,
      ageGroup,
      playerActions,
      keyQualities,
      sectionName,
      sectionType,
      existingObjective,
    } = context;

    setIsLoading(true);
    setError(null);

    try {
      const systemPrompt = `You are a youth soccer coaching assistant helping coaches plan training sessions.
You provide concise, age-appropriate content for coaching sessions.
Keep language simple and actionable. Focus on fun and development.
Always respond in valid JSON format.`;

      const userPrompt = `Generate content for a ${sectionType} section in a youth soccer training session.

Context:
- Moment of the game: ${moment || 'Not specified'}
- Age Group: ${ageGroup || 'Not specified'}
- Player Actions focus: ${playerActions?.length > 0 ? playerActions.join(', ') : 'Not specified'}
- Key Qualities focus: ${keyQualities?.length > 0 ? keyQualities.join(', ') : 'Not specified'}
- Section Name: ${sectionName || 'Not specified'}
${existingObjective ? `- Current Objective: ${existingObjective}` : ''}

Generate appropriate content for this ${sectionType === 'Practice' ? 'practice activity' : 'play session'}.
${sectionType === 'Practice' ? 'Include guided discovery questions and key learning points.' : ''}

Respond with JSON in this exact format:
{
  "objective": "1-2 sentences about the goal of this activity",
  "organization": "Brief setup instructions (field size, players, equipment)",
  ${sectionType === 'Practice' ? `"questions": "2-3 guided questions to help players discover solutions",
  "answers": "Key points players should learn from this activity",` : ''}
  "notes": "Any coaching tips or variations to consider"
}`;

      const content = await callOpenAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setIsLoading(false);
        return parsed;
      }

      throw new Error('Invalid response format');
    } catch (e) {
      setError(e.message);
      setIsLoading(false);
      throw e;
    }
  }, [callOpenAI]);

  // Generate title suggestions
  const generateTitleSuggestions = useCallback(async (context) => {
    const { moment, playerActions } = context;

    setIsLoading(true);
    setError(null);

    try {
      const prompt = `Generate 3 short, descriptive session titles for a youth soccer training session.

Context:
- Moment: ${moment || 'General'}
- Focus areas: ${playerActions?.length > 0 ? playerActions.join(', ') : 'Not specified'}

Respond with JSON: { "titles": ["Title 1", "Title 2", "Title 3"] }
Keep titles under 40 characters each.`;

      const content = await callOpenAI([
        { role: 'user', content: prompt },
      ]);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setIsLoading(false);
        return parsed.titles || [];
      }

      throw new Error('Invalid response format');
    } catch (e) {
      setError(e.message);
      setIsLoading(false);
      throw e;
    }
  }, [callOpenAI]);

  // Generate guided questions
  const generateQuestions = useCallback(async (context) => {
    const { moment, objective, ageGroup } = context;

    setIsLoading(true);
    setError(null);

    try {
      const prompt = `Generate 3 guided discovery questions for a youth soccer practice activity.

Context:
- Moment: ${moment || 'General'}
- Objective: ${objective || 'Not specified'}
- Age Group: ${ageGroup || 'Youth'}

Questions should help players discover solutions themselves rather than being told directly.
Format: Simple questions appropriate for young players.

Respond with JSON: { "questions": "Question 1?\\nQuestion 2?\\nQuestion 3?" }`;

      const content = await callOpenAI([
        { role: 'user', content: prompt },
      ]);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setIsLoading(false);
        return parsed.questions || '';
      }

      throw new Error('Invalid response format');
    } catch (e) {
      setError(e.message);
      setIsLoading(false);
      throw e;
    }
  }, [callOpenAI]);

  return {
    // State
    isLoading,
    error,

    // Config management
    getConfig,
    saveConfig,
    clearConfig,
    isConfigured,
    validateApiKey,

    // Content generation
    generateSectionContent,
    generateTitleSuggestions,
    generateQuestions,
  };
}
