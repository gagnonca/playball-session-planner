import { useState, useCallback } from 'react';
import { generateShareToken } from '../utils/tokens';

/**
 * Hook for managing team sharing with assistant coaches.
 * Handles share link generation, pushing updates, and revocation.
 */
export default function useSharing() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Generate a share link for a team.
   * Returns the share token (caller should save it to the team object).
   */
  const generateShareLink = useCallback(async (team) => {
    setIsLoading(true);
    setError(null);

    try {
      const shareToken = generateShareToken();

      // Push initial team data
      const response = await fetch('/api/share/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareToken, team }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to create share link');
      }

      setIsLoading(false);
      return {
        shareToken,
        sharedAt: data.pushedAt,
        shareUrl: `${window.location.origin}/shared/${shareToken}`,
      };
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
      throw err;
    }
  }, []);

  /**
   * Push updated team data to an existing share.
   */
  const pushUpdate = useCallback(async (shareToken, team) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/share/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareToken, team }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to push update');
      }

      setIsLoading(false);
      return { pushedAt: data.pushedAt };
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
      throw err;
    }
  }, []);

  /**
   * Revoke a share link (stop sharing).
   */
  const revokeShare = useCallback(async (shareToken) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/share/${shareToken}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to revoke share');
      }

      setIsLoading(false);
      return { success: true };
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
      throw err;
    }
  }, []);

  /**
   * Fetch a shared team (for ACs viewing shared links).
   */
  const fetchSharedTeam = useCallback(async (shareToken) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/share/${shareToken}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Share link is no longer valid');
      }

      setIsLoading(false);
      return data.team;
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
      throw err;
    }
  }, []);

  /**
   * Copy share URL to clipboard.
   */
  const copyShareUrl = useCallback(async (shareToken) => {
    const url = `${window.location.origin}/shared/${shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    }
  }, []);

  return {
    isLoading,
    error,
    generateShareLink,
    pushUpdate,
    revokeShare,
    fetchSharedTeam,
    copyShareUrl,
  };
}
