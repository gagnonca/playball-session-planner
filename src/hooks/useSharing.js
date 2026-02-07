import { useState, useCallback, useEffect } from 'react';
import { generateShareToken } from '../utils/tokens';
import { FOLLOWED_SHARES_KEY } from '../constants/storage';

/**
 * Hook for managing team sharing with assistant coaches.
 * Handles share link generation, pushing updates, revocation,
 * and tracking followed shared teams (for ACs).
 */
export default function useSharing() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [followedShares, setFollowedShares] = useState([]);

  // Load followed shares from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FOLLOWED_SHARES_KEY);
      if (saved) {
        setFollowedShares(JSON.parse(saved));
      }
    } catch (err) {
      console.error('Failed to load followed shares:', err);
    }
  }, []);

  // Persist followed shares to localStorage
  const saveFollowedShares = useCallback((shares) => {
    setFollowedShares(shares);
    localStorage.setItem(FOLLOWED_SHARES_KEY, JSON.stringify(shares));
  }, []);

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

  /**
   * Follow a shared team (for ACs to track teams they've accessed).
   * Stores basic info so we can fetch updates later.
   */
  const followShare = useCallback((shareToken, teamInfo) => {
    // Check if already following
    const existing = followedShares.find(s => s.shareToken === shareToken);
    if (existing) {
      // Update team info but keep existing
      const updated = followedShares.map(s =>
        s.shareToken === shareToken
          ? { ...s, teamName: teamInfo.name, ageGroup: teamInfo.ageGroup, lastViewedAt: new Date().toISOString() }
          : s
      );
      saveFollowedShares(updated);
      return;
    }

    // Add new followed share
    const newShare = {
      shareToken,
      teamName: teamInfo.name,
      ageGroup: teamInfo.ageGroup,
      followedAt: new Date().toISOString(),
      lastViewedAt: new Date().toISOString(),
    };
    saveFollowedShares([...followedShares, newShare]);
  }, [followedShares, saveFollowedShares]);

  /**
   * Unfollow a shared team (stop tracking it).
   */
  const unfollowShare = useCallback((shareToken) => {
    const updated = followedShares.filter(s => s.shareToken !== shareToken);
    saveFollowedShares(updated);
  }, [followedShares, saveFollowedShares]);

  /**
   * Check if a share is being followed.
   */
  const isFollowing = useCallback((shareToken) => {
    return followedShares.some(s => s.shareToken === shareToken);
  }, [followedShares]);

  return {
    isLoading,
    error,
    generateShareLink,
    pushUpdate,
    revokeShare,
    fetchSharedTeam,
    copyShareUrl,
    // AC following features
    followedShares,
    followShare,
    unfollowShare,
    isFollowing,
  };
}
