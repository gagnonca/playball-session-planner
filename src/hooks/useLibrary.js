import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { SECTION_LIBRARY_KEY, SESSION_LIBRARY_KEY, COACH_IDENTITY_KEY } from '../constants/storage';
import {
  sectionToLibraryPayload,
  sessionToLibraryPayload,
  getStarterLibraryItems,
  uid,
  nowIso,
  downloadJson,
} from '../utils/helpers';

/**
 * Unified library hook managing exercises (sections) and sessions.
 * All items are stored globally in localStorage, available across all teams.
 */
export default function useLibrary() {
  const [exercises, setExercises] = useLocalStorage(SECTION_LIBRARY_KEY, {
    version: 1,
    items: getStarterLibraryItems(),
  });

  const [sessions, setSessions] = useLocalStorage(SESSION_LIBRARY_KEY, {
    version: 1,
    items: [],
  });

  // --- Exercise actions ---

  const saveExercise = useCallback((section, name, sessionContext = null) => {
    const payload = sectionToLibraryPayload(section);
    const entryName = (name || section.name || 'Untitled exercise').trim() || 'Untitled exercise';

    const tags = {
      type: section.type || '',
      ageGroup: sessionContext?.ageGroup || '',
      moment: sessionContext?.moment || '',
    };

    const existing = exercises.items.find(
      x => (x.name || '').toLowerCase() === entryName.toLowerCase()
    );

    const item = {
      id: existing?.id || uid(),
      name: entryName,
      type: section.type || 'Other',
      tags,
      payload,
      updatedAt: nowIso(),
    };

    setExercises(prev => ({
      ...prev,
      items: existing
        ? prev.items.map(x => (x.id === existing.id ? item : x))
        : [item, ...prev.items],
    }));
    pgPut(`/api/v2/library/exercises/${encodeURIComponent(item.id)}`, {
      name: item.name,
      type: item.type,
      tags: item.tags,
      payload: item.payload,
    });
  }, [exercises.items, setExercises]);

  const deleteExercise = useCallback((id) => {
    setExercises(prev => ({
      ...prev,
      items: prev.items.filter(x => x.id !== id),
    }));
    pgDelete(`/api/v2/library/exercises/${encodeURIComponent(id)}`);
  }, [setExercises]);

  const clearExercises = useCallback(() => {
    setExercises({ version: 1, items: getStarterLibraryItems() });
  }, [setExercises]);

  // --- Session actions ---

  const saveSession = useCallback((session, name) => {
    const payload = sessionToLibraryPayload(session);
    const entryName = (name || session.summary?.title || 'Untitled session').trim() || 'Untitled session';

    const tags = {
      ageGroup: session.summary?.ageGroup || '',
      moment: session.summary?.moment || '',
      duration: session.summary?.duration || '',
    };

    const existing = sessions.items.find(
      x => (x.name || '').toLowerCase() === entryName.toLowerCase()
    );

    const item = {
      id: existing?.id || uid(),
      name: entryName,
      tags,
      payload,
      updatedAt: nowIso(),
    };

    setSessions(prev => ({
      ...prev,
      items: existing
        ? prev.items.map(x => (x.id === existing.id ? item : x))
        : [item, ...prev.items],
    }));
    pgPut(`/api/v2/library/sessions/${encodeURIComponent(item.id)}`, {
      name: item.name,
      tags: item.tags,
      payload: item.payload,
    });
  }, [sessions.items, setSessions]);

  const deleteSession = useCallback((id) => {
    setSessions(prev => ({
      ...prev,
      items: prev.items.filter(x => x.id !== id),
    }));
    pgDelete(`/api/v2/library/sessions/${encodeURIComponent(id)}`);
  }, [setSessions]);

  const clearSessions = useCallback(() => {
    setSessions({ version: 1, items: [] });
  }, [setSessions]);

  // --- Import / Export ---

  const exportLibrary = useCallback(() => {
    downloadJson('ppp-library.json', { exercises, sessions });
  }, [exercises, sessions]);

  const importLibrary = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const imported = JSON.parse(reader.result);

          // Persist each item directly to Postgres via per-entity endpoints.
          // Small per-item payloads avoid Vercel's 4.5MB body limit and bypass
          // the legacy blob sync race that makes imports flash and disappear.
          let identity = null;
          try {
            const raw = localStorage.getItem(COACH_IDENTITY_KEY);
            if (raw) identity = JSON.parse(raw);
          } catch (e) {
            console.warn('no coach identity available for library import push', e);
          }

          const headers = identity ? {
            'Content-Type': 'application/json',
            'x-coach-id': identity.coachId,
            'x-device-id': identity.deviceId,
          } : null;

          if (headers) {
            for (const ex of imported.exercises?.items || []) {
              if (!ex?.id) continue;
              try {
                await fetch(`/api/v2/library/exercises/${encodeURIComponent(ex.id)}`, {
                  method: 'PUT',
                  headers,
                  body: JSON.stringify({
                    name: ex.name ?? 'Untitled',
                    type: ex.type ?? null,
                    tags: ex.tags ?? {},
                    payload: ex.payload ?? ex,
                  }),
                });
              } catch (err) {
                console.warn('library exercise PUT failed', ex.id, err);
              }
            }
            for (const s of imported.sessions?.items || []) {
              if (!s?.id) continue;
              try {
                await fetch(`/api/v2/library/sessions/${encodeURIComponent(s.id)}`, {
                  method: 'PUT',
                  headers,
                  body: JSON.stringify({
                    name: s.name ?? 'Untitled',
                    tags: s.tags ?? {},
                    payload: s.payload ?? s,
                  }),
                });
              } catch (err) {
                console.warn('library session PUT failed', s.id, err);
              }
            }
          }

          // Update local state (merge with existing by id).
          if (imported.exercises?.items) {
            setExercises(prev => ({
              ...prev,
              items: mergeById(prev.items, imported.exercises.items),
            }));
          }
          if (imported.sessions?.items) {
            setSessions(prev => ({
              ...prev,
              items: mergeById(prev.items, imported.sessions.items),
            }));
          }
          resolve();
        } catch {
          reject(new Error('Invalid library file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }, [setExercises, setSessions]);

  // Raw setters for sync merging
  const setExercisesRaw = setExercises;
  const setSessionsRaw = setSessions;

  return {
    exercises,
    sessions,
    saveExercise,
    deleteExercise,
    clearExercises,
    saveSession,
    deleteSession,
    clearSessions,
    exportLibrary,
    importLibrary,
    // Raw setters used by sync
    setExercisesRaw,
    setSessionsRaw,
  };
}

function syncHeaders() {
  try {
    const raw = localStorage.getItem(COACH_IDENTITY_KEY);
    if (!raw) return null;
    const identity = JSON.parse(raw);
    if (!identity?.coachId || !identity?.deviceId) return null;
    return {
      'Content-Type': 'application/json',
      'x-coach-id': identity.coachId,
      'x-device-id': identity.deviceId,
    };
  } catch {
    return null;
  }
}

function pgDelete(path) {
  const headers = syncHeaders();
  if (!headers) return;
  fetch(path, { method: 'DELETE', headers })
    .catch(err => console.warn('pgDelete failed', path, err));
}

function pgPut(path, body) {
  const headers = syncHeaders();
  if (!headers) return;
  fetch(path, { method: 'PUT', headers, body: JSON.stringify(body) })
    .catch(err => console.warn('pgPut failed', path, err));
}

function mergeById(existing = [], incoming = []) {
  const byId = new Map(existing.map(x => [x.id, x]));
  for (const item of incoming) {
    if (item?.id) byId.set(item.id, item);
  }
  return [...byId.values()];
}
