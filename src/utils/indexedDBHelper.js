const DB_NAME = 'playball_session_planner';
const DB_VERSION = 1;
const STORE_NAME = 'teams';

let dbInstance = null;

// Initialize IndexedDB
export async function initializeDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB initialization failed:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

// Get teams data from IndexedDB
export async function getTeamsData() {
  const db = await initializeDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get('teams_data');

    request.onerror = () => {
      console.error('Failed to read teams data:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result?.data || null);
    };
  });
}

// Save teams data to IndexedDB
export async function saveTeamsData(teamsData) {
  const db = await initializeDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({
      id: 'teams_data',
      data: teamsData,
      timestamp: Date.now(),
    });

    request.onerror = () => {
      console.error('Failed to save teams data:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}

// Check if we need to migrate from localStorage
export async function migrateFromLocalStorage(localStorageData) {
  if (!localStorageData) return;

  try {
    const teamsData = JSON.parse(localStorageData);
    await saveTeamsData(teamsData);
    console.log('Successfully migrated teams data from localStorage to IndexedDB');
  } catch (error) {
    console.error('Migration from localStorage failed:', error);
    throw error;
  }
}

// Clear all data (for sync reset)
export async function clearTeamsData() {
  const db = await initializeDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete('teams_data');

    request.onerror = () => {
      console.error('Failed to clear teams data:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}

// Get database size (for debugging)
export async function getStorageSize() {
  if (!navigator.storage?.estimate) return null;

  try {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage,
      quota: estimate.quota,
      percentUsed: Math.round((estimate.usage / estimate.quota) * 100),
    };
  } catch (error) {
    console.error('Failed to get storage estimate:', error);
    return null;
  }
}
