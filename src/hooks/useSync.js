import { useState, useEffect, useCallback, useRef } from 'react';
import { COACH_IDENTITY_KEY } from '../constants/storage';
import { generateCoachId, generateDeviceId } from '../utils/tokens';

/**
 * Hook for managing device sync across multiple devices.
 * Handles coach identity, device pairing, and pulling teams from the server.
 * Writes go through per-entity PUT/DELETE under /api/v2/* (see useTeams.js);
 * this hook only handles identity and reads.
 *
 * @param {object} options
 * @param {(teams) => void} [options.onRemoteUpdate] - called when cross-tab
 *   broadcasts produce a newer teamsData that the caller should adopt locally.
 */
export default function useSync(options = {}) {
  const onRemoteUpdateRef = useRef(options.onRemoteUpdate);
  useEffect(() => { onRemoteUpdateRef.current = options.onRemoteUpdate; }, [options.onRemoteUpdate]);
  const [identity, setIdentity] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | synced | error | offline
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

    const response = await fetch('/api/sync/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'request', coachId: identity.coachId }),
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

    const response = await fetch('/api/sync/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm', code, deviceId }),
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
    };

    localStorage.setItem(COACH_IDENTITY_KEY, JSON.stringify(newIdentity));
    setIdentity(newIdentity);
    setSyncStatus('synced');

    return data.teams;
  }, []);

  /**
   * Fetch latest teams from server.
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
      const updatedIdentity = { ...identity, lastSyncAt: now };
      localStorage.setItem(COACH_IDENTITY_KEY, JSON.stringify(updatedIdentity));
      setIdentity(updatedIdentity);
      setLastSyncAt(now);
      setSyncStatus('synced');

      return { teams: data.teams };
    } catch (error) {
      console.error('Failed to pull teams:', error);
      setSyncStatus('error');
      throw error;
    }
  }, [identity, isOnline]);

  /**
   * Fetch latest library from server.
   */
  const pullLibrary = useCallback(async () => {
    if (!identity?.coachId || !identity?.deviceId || !isOnline) return null;

    try {
      const response = await fetch(
        `/api/sync/library?coachId=${identity.coachId}&deviceId=${identity.deviceId}`
      );
      const data = await response.json();
      if (!data.success) return null;
      return { library: data.library };
    } catch (error) {
      console.error('Failed to pull library:', error);
      return null;
    }
  }, [identity, isOnline]);

  /**
   * Push library to server. Debounced to avoid too many requests.
   */
  const pushLibrary = useCallback(async (library) => {
    if (!identity?.coachId || !identity?.deviceId || !isOnline) return;

    try {
      await fetch('/api/sync/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId: identity.coachId,
          deviceId: identity.deviceId,
          library,
        }),
      });
    } catch (error) {
      console.error('Failed to push library:', error);
    }
  }, [identity, isOnline]);

  /**
   * Reset sync by clearing the coach identity.
   * This allows the user to start fresh or link to a different account.
   * Also notifies the server to unlink this device.
   */
  const resetSync = useCallback(async () => {
    // Notify server to unlink this device (fire and forget)
    if (identity?.coachId && identity?.deviceId) {
      try {
        await fetch('/api/sync/unlink', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            coachId: identity.coachId,
            deviceId: identity.deviceId,
          }),
        });
      } catch (error) {
        // Don't block reset if unlink fails
        console.error('Failed to unlink device from server:', error);
      }
    }

    // Clear identity from localStorage
    localStorage.removeItem(COACH_IDENTITY_KEY);
    setIdentity(null);
    setSyncStatus('idle');
    setLastSyncAt(null);
  }, [identity]);

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
    resetSync,
    pullLibrary,
    pushLibrary,
  };
}
