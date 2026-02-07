import { useState, useEffect, useCallback, useRef } from 'react';
import { COACH_IDENTITY_KEY } from '../constants/storage';
import { generateCoachId, generateDeviceId } from '../utils/tokens';

/**
 * Hook for managing device sync across multiple devices.
 * Handles coach identity, device pairing, and two-way sync.
 */
export default function useSync() {
  const [identity, setIdentity] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | synced | error | offline
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const syncTimeoutRef = useRef(null);
  const pendingPushRef = useRef(null);

  // Load identity from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(COACH_IDENTITY_KEY);
    if (stored) {
      try {
        setIdentity(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse coach identity:', e);
      }
    }
  }, []);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /**
   * Initialize a new coach identity (first-time setup).
   * Creates anonymous coachId and deviceId, registers with server.
   */
  const initializeIdentity = useCallback(async () => {
    const coachId = generateCoachId();
    const deviceId = generateDeviceId();

    try {
      const response = await fetch('/api/sync/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachId, deviceId }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to initialize');
      }

      const newIdentity = {
        coachId,
        deviceId,
        linkedAt: new Date().toISOString(),
        lastSyncAt: null,
        localVersion: 1,
      };

      localStorage.setItem(COACH_IDENTITY_KEY, JSON.stringify(newIdentity));
      setIdentity(newIdentity);
      setSyncStatus('synced');

      return newIdentity;
    } catch (error) {
      console.error('Failed to initialize identity:', error);
      setSyncStatus('error');
      throw error;
    }
  }, []);

  /**
   * Request a pairing code to link another device.
   * Returns { code, expiresAt }.
   */
  const requestPairingCode = useCallback(async () => {
    if (!identity?.coachId) {
      throw new Error('No coach identity');
    }

    const response = await fetch('/api/sync/pair/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coachId: identity.coachId }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to get pairing code');
    }

    return { code: data.code, expiresAt: data.expiresAt };
  }, [identity]);

  /**
   * Confirm a pairing code to link this device to an existing coach.
   * Returns the coach's teams data.
   */
  const confirmPairingCode = useCallback(async (code) => {
    const deviceId = generateDeviceId();

    const response = await fetch('/api/sync/pair/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, deviceId }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to confirm pairing code');
    }

    const newIdentity = {
      coachId: data.coachId,
      deviceId,
      linkedAt: data.linkedAt,
      lastSyncAt: new Date().toISOString(),
      localVersion: data.teams?.version || 1,
    };

    localStorage.setItem(COACH_IDENTITY_KEY, JSON.stringify(newIdentity));
    setIdentity(newIdentity);
    setSyncStatus('synced');

    return data.teams;
  }, []);

  /**
   * Fetch latest teams from server.
   * Returns { teams, version } for comparison with local version.
   */
  const pullTeams = useCallback(async () => {
    if (!identity?.coachId || !identity?.deviceId) {
      return null;
    }

    if (!isOnline) {
      setSyncStatus('offline');
      return null;
    }

    setSyncStatus('syncing');

    try {
      const response = await fetch(
        `/api/sync/teams?coachId=${identity.coachId}&deviceId=${identity.deviceId}`
      );

      const data = await response.json();

      if (!data.success) {
        if (data.error === 'device_not_linked') {
          // Device was unlinked, clear identity
          localStorage.removeItem(COACH_IDENTITY_KEY);
          setIdentity(null);
          setSyncStatus('idle');
          return null;
        }
        throw new Error(data.message || 'Failed to fetch teams');
      }

      const now = new Date().toISOString();
      const updatedIdentity = {
        ...identity,
        lastSyncAt: now,
        localVersion: data.version,
      };
      localStorage.setItem(COACH_IDENTITY_KEY, JSON.stringify(updatedIdentity));
      setIdentity(updatedIdentity);
      setLastSyncAt(now);
      setSyncStatus('synced');

      // Return both teams and version for caller to compare
      return { teams: data.teams, version: data.version };
    } catch (error) {
      console.error('Failed to pull teams:', error);
      setSyncStatus('error');
      throw error;
    }
  }, [identity, isOnline]);

  /**
   * Push teams to server.
   * Debounced to avoid too many requests.
   */
  const pushTeams = useCallback(async (teams) => {
    if (!identity?.coachId || !identity?.deviceId) {
      return;
    }

    // Store pending push
    pendingPushRef.current = teams;

    // Clear existing timeout
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Debounce: wait 2 seconds before actually pushing
    syncTimeoutRef.current = setTimeout(async () => {
      if (!isOnline) {
        setSyncStatus('offline');
        return;
      }

      const teamsToSync = pendingPushRef.current;
      if (!teamsToSync) return;

      setSyncStatus('syncing');

      try {
        const response = await fetch('/api/sync/teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            coachId: identity.coachId,
            deviceId: identity.deviceId,
            teams: teamsToSync,
            localVersion: identity.localVersion,
          }),
        });

        const data = await response.json();

        if (!data.success) {
          if (data.error === 'version_conflict') {
            // Server has newer data, need to merge
            console.warn('Version conflict, server has newer data');
            // Return the server teams for the caller to handle
            setSyncStatus('synced');
            return { conflict: true, serverTeams: data.serverTeams };
          }
          throw new Error(data.message || 'Failed to push teams');
        }

        const now = new Date().toISOString();
        const updatedIdentity = {
          ...identity,
          lastSyncAt: now,
          localVersion: data.version,
        };
        localStorage.setItem(COACH_IDENTITY_KEY, JSON.stringify(updatedIdentity));
        setIdentity(updatedIdentity);
        setLastSyncAt(now);
        setSyncStatus('synced');
        pendingPushRef.current = null;

        return { success: true };
      } catch (error) {
        console.error('Failed to push teams:', error);
        setSyncStatus('error');
        throw error;
      }
    }, 2000);
  }, [identity, isOnline]);

  /**
   * Force an immediate sync (no debounce).
   */
  const forcePush = useCallback(async (teams) => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    pendingPushRef.current = null;

    if (!identity?.coachId || !identity?.deviceId || !isOnline) {
      return;
    }

    setSyncStatus('syncing');

    try {
      const response = await fetch('/api/sync/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId: identity.coachId,
          deviceId: identity.deviceId,
          teams,
          localVersion: identity.localVersion,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to push');
      }

      const now = new Date().toISOString();
      const updatedIdentity = {
        ...identity,
        lastSyncAt: now,
        localVersion: data.version,
      };
      localStorage.setItem(COACH_IDENTITY_KEY, JSON.stringify(updatedIdentity));
      setIdentity(updatedIdentity);
      setLastSyncAt(now);
      setSyncStatus('synced');

      return { success: true };
    } catch (error) {
      console.error('Force push failed:', error);
      setSyncStatus('error');
      throw error;
    }
  }, [identity, isOnline]);

  /**
   * Reset sync by clearing the coach identity.
   * This allows the user to start fresh or link to a different account.
   */
  const resetSync = useCallback(() => {
    // Clear pending syncs
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    pendingPushRef.current = null;

    // Clear identity from localStorage
    localStorage.removeItem(COACH_IDENTITY_KEY);
    setIdentity(null);
    setSyncStatus('idle');
    setLastSyncAt(null);
  }, []);

  /**
   * Check if sync is available (has identity and is online).
   */
  const isSyncEnabled = Boolean(identity?.coachId && identity?.deviceId);

  return {
    // State
    identity,
    syncStatus,
    lastSyncAt,
    isOnline,
    isSyncEnabled,

    // Actions
    initializeIdentity,
    requestPairingCode,
    confirmPairingCode,
    pullTeams,
    pushTeams,
    forcePush,
    resetSync,
  };
}
