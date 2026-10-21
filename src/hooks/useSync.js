import { useState, useEffect } from 'react';
import { useStore } from '../data/store';

/**
 * Connection + save status for the UI ("Synced", "Saving…", "Offline").
 * All data lives on the server behind the coach's account (data/store.js);
 * there is no separate sync to turn on anymore.
 */
export default function useSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const status = useStore(s => s.status);
  const demo = useStore(s => s.demo);
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

  let syncStatus = 'idle';
  if (demo) syncStatus = 'idle';
  else if (!isOnline) syncStatus = 'offline';
  else if (pendingWrites > 0 || status === 'loading') syncStatus = 'syncing';
  else if (status === 'error') syncStatus = 'error';
  else if (status === 'ready') syncStatus = 'synced';

  return {
    syncStatus,
    lastSyncAt: lastLoadedAt ? new Date(lastLoadedAt).toISOString() : null,
    isOnline,
    // Signed in (not the demo) = everything is saved to the account.
    isSyncEnabled: status !== 'signed-out' && !demo,
    isDemo: demo,
  };
}
