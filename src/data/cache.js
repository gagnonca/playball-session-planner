// Read-only offline cache of the last server snapshot, per user. It exists so
// the app paints instantly and still opens at the field with no signal. It is
// never merged or written back to the server — the next server snapshot
// replaces it wholesale. Several tabs writing it is harmless for that reason.

const DB_NAME = 'playball-v3';
const STORE = 'kv';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function readCachedSnapshot(userKey) {
  if (!userKey) return null;
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(`snapshot:${userKey}`);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[cache] read failed', e);
    return null;
  }
}

export async function writeCachedSnapshot(userKey, snapshot) {
  if (!userKey) return;
  try {
    const db = await open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(snapshot, `snapshot:${userKey}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('[cache] write failed', e);
  }
}

export async function clearCachedSnapshot(userKey) {
  if (!userKey) return;
  try {
    const db = await open();
    db.transaction(STORE, 'readwrite').objectStore(STORE).delete(`snapshot:${userKey}`);
  } catch { /* ignore */ }
}
