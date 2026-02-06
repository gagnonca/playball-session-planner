/**
 * Generate a unique ID with an optional prefix.
 * Format: {prefix}-{timestamp}-{random9chars}
 *
 * @param {string} prefix - Optional prefix for the ID (default: 'item')
 * @returns {string} Unique identifier
 */
export const generateId = (prefix = 'item') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
