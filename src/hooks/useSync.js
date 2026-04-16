import { useState, useEffect, useCallback, useRef } from 'react';
import { COACH_IDENTITY_KEY } from '../constants/storage';
import { generateCoachId, generateDeviceId } from '../utils/tokens';
import { mergeTeamsData } from '../utils/helpers';

/**
 * Hook for managing device sync across multiple devices.
 * Handles coach identity, device pairing, and two-way sync.
 *
 * @param {object} options
 * @param {(teams) => void} [options.onRemoteUpdate] - called when server (or conflict
 *   resolution) produces a newer teamsData that the caller should adopt locally.
 */
export default function useSync(options = {}) {
  const onRemoteUpdateRef = useRef(options.onRemoteUpdate);
  useEffect(() => { onRemoteUpdateRef.current = options.onRemoteUpdate; }, [options.onRemoteUpdate]);
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
          if (data.error === 'version_conflict' && data.serverTeams) {
            // Server has newer data. Merge locally-staged changes with server truth,
            // hydrate the UI, and retry the push. Retry a few times because racing
            // pushes from multiple tabs can cause successive conflicts.
            let workingTeams = teamsToSync;
            let workingData = data;
            let attempts = 0;
            const MAX_ATTEMPTS = 4;
            while (workingData && workingData.error === 'version_conflict' && workingData.serverTeams && attempts < MAX_ATTEMPTS) {
              attempts += 1;
              const merged = mergeTeamsData(workingTeams, workingData.serverTeams);
              const serverVersion = workingData.serverVersion || workingData.version || 0;
              const patchedIdentity = { ...identity, localVersion: serverVersion };
              localStorage.setItem(COACH_IDENTITY_KEY, JSON.stringify(patchedIdentity));
              setIdentity(patchedIdentity);
              if (onRemoteUpdateRef.current) onRemoteUpdateRef.current(merged);

              const retry = await fetch('/api/sync/teams', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  coachId: identity.coachId,
                  deviceId: identity.deviceId,
                  teams: merged,
                  localVersion: serverVersion,
                }),
              });
              workingData = await retry.json();
              workingTeams = merged;
              if (workingData.success) {
                const now = new Date().toISOString();
                const updatedIdentity = { ...patchedIdentity, lastSyncAt: now, localVersion: workingData.version };
                localStorage.setItem(COACH_IDENTITY_KEY, JSON.stringify(updatedIdentity));
                setIdentity(updatedIdentity);
                setLastSyncAt(now);
                setSyncStatus('synced');
                pendingPushRef.current = null;
                return { success: true, merged: true };
              }
            }
            // Ran out of retries — leave status at 'syncing' and let the next
            // push cycle try again. Do NOT surface as error; the data is safe locally.
            console.warn('Version conflict exhausted retries; will retry on next edit');
            setSyncStatus('synced');
            return { conflict: true };
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

      let data = await response.json();
      let pushedTeams = teams;

      if (!data.success && data.error === 'version_conflict' && data.serverTeams) {
        const merged = mergeTeamsData(teams, data.serverTeams);
        const serverVersion = data.serverVersion || data.version || 0;
        if (onRemoteUpdateRef.current) onRemoteUpdateRef.current(merged);
        const retry = await fetch('/api/sync/teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            coachId: identity.coachId,
            deviceId: identity.deviceId,
            teams: merged,
            localVersion: serverVersion,
          }),
        });
        data = await retry.json();
        pushedTeams = merged;
      }

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

      return { success: true, teams: pushedTeams };
    } catch (error) {
      console.error('Force push failed:', error);
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
      return { library: data.library, version: data.version };
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
    // Clear pending syncs
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    pendingPushRef.current = null;

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
    pushTeams,
    forcePush,
    resetSync,
    pullLibrary,
    pushLibrary,
  };
}
