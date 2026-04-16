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

  // Share links now read live from Postgres via teams.sharing->>shareToken
  // (api/share-router.js). Creating a link just mints a token; saving it onto
  // the team (via updateTeam → per-entity PUT) is what makes it discoverable.
  const generateShareLink = useCallback(async (_team) => {
    const shareToken = generateShareToken();
    const sharedAt = new Date().toISOString();
    return {
      shareToken,
      sharedAt,
      shareUrl: `${window.location.origin}/shared/${shareToken}`,
    };
  }, []);

  // No-op: the team is live in Postgres, the share endpoint reads it directly.
  const pushUpdate = useCallback(async () => {
    return { pushedAt: new Date().toISOString() };
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
   * Copy just the share code to clipboard (for iOS app paste).
   */
  const copyShareCode = useCallback(async (shareToken) => {
    try {
      await navigator.clipboard.writeText(shareToken);
      return true;
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = shareToken;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    }
  }, []);

  /**
   * Fetch lightweight session list for a shared team.
   * Uses the new /api/share/{token}/sessions endpoint.
   */
  const fetchSharedSessions = useCallback(async (shareToken) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/share/${shareToken}/sessions`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Share code is not valid');
      }

      setIsLoading(false);
      return data;
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
      throw err;
    }
  }, []);

  /**
   * Fetch full session detail for a specific session in a shared team.
   * Uses the new /api/share/{token}/sessions/{sessionId} endpoint.
   */
  const fetchSharedSessionDetail = useCallback(async (shareToken, sessionId) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/share/${shareToken}/sessions/${sessionId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Session not found');
      }

      setIsLoading(false);
      return data.session;
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
      throw err;
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
    fetchSharedSessions,
    fetchSharedSessionDetail,
    copyShareUrl,
    copyShareCode,
    // AC following features
    followedShares,
    followShare,
    unfollowShare,
    isFollowing,
  };
}
