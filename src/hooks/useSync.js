import { useState, useEffect, useCallback } from 'react';
import { COACH_IDENTITY_KEY } from '../constants/storage';
import { generateCoachId, generateDeviceId } from '../utils/tokens';
import { readIdentity } from '../data/api';
import { useStore, resetStore } from '../data/store';

/**
 * Coach identity (device-linked) + a status summary of the data store.
 * Reads and writes themselves live in data/store.js; this hook only creates,
 * pairs and unlinks the identity, and restarts the store when it changes.
 */
export default function useSync() {
  const [identity, setIdentity] = useState(readIdentity);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const status = useStore(s => s.status);
  const pendingWrites = useStore(s => s.pendingWrites);
  const lastLoadedAt = useStore(s => s.lastLoadedAt);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const adopt = useCallback((next) => {
    if (next) localStorage.setItem(COACH_IDENTITY_KEY, JSON.stringify(next));
    else localStorage.removeItem(COACH_IDENTITY_KEY);
    setIdentity(next);
    return resetStore();
  }, []);

  /**
   * Create a new coach identity (first-time setup) and register it.
   */
  const initializeIdentity = useCallback(async () => {
    const coachId = generateCoachId();
    const deviceId = generateDeviceId();
    const response = await fetch('/api/sync/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coachId, deviceId }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message || 'Failed to initialize');
    const next = { coachId, deviceId, linkedAt: new Date().toISOString() };
    await adopt(next);
    return next;
  }, [adopt]);

  /**
   * Request a pairing code to link another device. Returns { code, expiresAt }.
   */
  const requestPairingCode = useCallback(async () => {
    if (!identity?.coachId) throw new Error('No coach identity');
    const response = await fetch('/api/sync/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'request', coachId: identity.coachId }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message || 'Failed to get pairing code');
    return { code: data.code, expiresAt: data.expiresAt };
  }, [identity]);

  /**
   * Link this device to an existing coach with a pairing code, then load
   * that coach's data from the server. Resolves true on success.
   */
  const confirmPairingCode = useCallback(async (code) => {
    const deviceId = generateDeviceId();
    const response = await fetch('/api/sync/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm', code, deviceId }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message || 'Failed to confirm pairing code');
    await adopt({ coachId: data.coachId, deviceId, linkedAt: data.linkedAt });
    return true;
  }, [adopt]);

  /**
   * Unlink this device and forget the identity.
   */
  const resetSync = useCallback(async () => {
    if (identity?.coachId && identity?.deviceId) {
      try {
        await fetch('/api/sync/unlink', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coachId: identity.coachId, deviceId: identity.deviceId }),
        });
      } catch (error) {
        console.error('Failed to unlink device from server:', error);
      }
    }
    await adopt(null);
  }, [identity, adopt]);

  const isSyncEnabled = Boolean(identity?.coachId && identity?.deviceId);

  let syncStatus = 'idle';
  if (!isOnline) syncStatus = 'offline';
  else if (pendingWrites > 0 || status === 'loading') syncStatus = 'syncing';
  else if (status === 'error') syncStatus = 'error';
  else if (status === 'ready') syncStatus = 'synced';

  return {
    identity,
    syncStatus,
    lastSyncAt: lastLoadedAt ? new Date(lastLoadedAt).toISOString() : null,
    isOnline,
    isSyncEnabled,
    initializeIdentity,
    requestPairingCode,
    confirmPairingCode,
    resetSync,
  };
}
