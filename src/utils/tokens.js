/**
 * Token generation utilities for device sync and sharing.
 * Uses cryptographically secure random values.
 */

/**
 * Generate a secure share token for AC sharing.
 * Format: t_[24 chars of base64url]
 * Entropy: 144 bits (practically unguessable)
 */
export function generateShareToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return `t_${base64}`;
}

/**
 * Generate an anonymous coach ID.
 * Format: c_[24 chars of base64url]
 */
export function generateCoachId() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return `c_${base64}`;
}

/**
 * Generate a device ID.
 * Format: d_[24 chars of base64url]
 */
export function generateDeviceId() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return `d_${base64}`;
}

/**
 * Generate a 6-digit pairing code.
 * Used for device linking (expires in 5 minutes).
 */
export function generatePairingCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(3));
  // Convert to number and take last 6 digits
  const num = (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
  return String(num % 1000000).padStart(6, '0');
}
