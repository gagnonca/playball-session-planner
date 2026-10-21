import { useCallback } from 'react';
import {
  sectionToLibraryPayload,
  sessionToLibraryPayload,
  getStarterLibraryItems,
  uid,
  nowIso,
  downloadJson,
} from '../utils/helpers';
import { useStore, getState, library } from '../data/store';

/**
 * Unified library: manual exercises + sessions, plus the coach's hidden ids.
 * Reads come from the server snapshot (data/store.js); every action writes to
 * the server immediately.
 */
export default function useLibrary() {
  const exercises = useStore(s => s.library.exercises);
  const sessions = useStore(s => s.library.sessions);
  const hidden = useStore(s => s.hidden);

  // --- Exercise actions ---

  const saveExercise = useCallback((section, name, sessionContext = null) => {
    const payload = sectionToLibraryPayload(section);
    const entryName = (name || section.name || 'Untitled exercise').trim() || 'Untitled exercise';

    const tags = {
      type: section.type || '',
      ageGroup: sessionContext?.ageGroup || '',
      moment: sessionContext?.moment || '',
    };

    // Saving under an existing name replaces that item.
    const existing = getState().library.exercises.items.find(
      x => (x.name || '').toLowerCase() === entryName.toLowerCase()
    );

    library.putExercise({
      ...(existing || {}),
      id: existing?.id || uid(),
      version: existing?.version ?? null,
      name: entryName,
      type: section.type || 'Other',
      tags,
      payload,
      updatedAt: nowIso(),
    });
  }, []);

  const deleteExercise = useCallback((id) => library.removeExercise(id), []);

  const removeExercises = useCallback((ids) => Promise.all(ids.map(id => library.removeExercise(id))), []);

  // "Reset to starter items": delete every saved exercise, then add the starters.
  const clearExercises = useCallback(async () => {
    await Promise.all(getState().library.exercises.items.map(x => library.removeExercise(x.id)));
    for (const item of getStarterLibraryItems()) library.putExercise({ ...item, version: null });
  }, []);

  // --- Session actions ---

  // `payloadOverride`: a payload the caller already prepared (e.g. with
  // diagram images moved to the CDN).
  const saveSession = useCallback((session, name, payloadOverride = null) => {
    const payload = payloadOverride || sessionToLibraryPayload(session);
    const entryName = (name || session.summary?.title || 'Untitled session').trim() || 'Untitled session';

    const tags = {
      ageGroup: session.summary?.ageGroup || '',
      moment: session.summary?.moment || '',
      duration: session.summary?.duration || '',
    };

    const existing = getState().library.sessions.items.find(
      x => (x.name || '').toLowerCase() === entryName.toLowerCase()
    );

    library.putSession({
      ...(existing || {}),
      id: existing?.id || uid(),
      version: existing?.version ?? null,
      name: entryName,
      tags,
      payload,
      updatedAt: nowIso(),
    });
  }, []);

  const deleteSession = useCallback((id) => library.removeSession(id), []);

  const removeSessions = useCallback((ids) => Promise.all(ids.map(id => library.removeSession(id))), []);

  const clearSessions = useCallback(async () => {
    await Promise.all(getState().library.sessions.items.map(x => library.removeSession(x.id)));
  }, []);

  // --- Hidden (auto-derived items filtered out of the library view) ---

  const hideExercise = useCallback((id) => library.hide('exercise', id), []);
  const hideSession = useCallback((id) => library.hide('session', id), []);
  const unhideAllExercises = useCallback(() => library.unhideAll('exercise'), []);
  const unhideAllSessions = useCallback(() => library.unhideAll('session'), []);

  // --- Import / Export ---

  const exportLibrary = useCallback(() => {
    const { exercises: ex, sessions: ss } = getState().library;
    downloadJson('ppp-library.json', { exercises: ex, sessions: ss });
  }, []);

  // Each imported item is written as its own row. Items whose id already
  // exists overwrite the saved copy (the import is a deliberate act).
  const importLibrary = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        let imported;
        try {
          imported = JSON.parse(reader.result);
        } catch {
          reject(new Error('Invalid library file'));
          return;
        }
        const st = getState().library;
        for (const ex of imported.exercises?.items || []) {
          if (!ex?.id) continue;
          const existing = st.exercises.items.find(x => x.id === ex.id);
          library.putExercise({
            id: ex.id,
            name: ex.name ?? 'Untitled',
            type: ex.type ?? null,
            tags: ex.tags ?? {},
            payload: ex.payload ?? ex,
            updatedAt: nowIso(),
            version: existing?.version ?? null,
          });
        }
        for (const s of imported.sessions?.items || []) {
          if (!s?.id) continue;
          const existing = st.sessions.items.find(x => x.id === s.id);
          library.putSession({
            id: s.id,
            name: s.name ?? 'Untitled',
            tags: s.tags ?? {},
            payload: s.payload ?? s,
            updatedAt: nowIso(),
            version: existing?.version ?? null,
          });
        }
        resolve();
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }, []);

  return {
    exercises,
    sessions,
    hidden,
    saveExercise,
    deleteExercise,
    removeExercises,
    clearExercises,
    saveSession,
    deleteSession,
    removeSessions,
    clearSessions,
    hideExercise,
    hideSession,
    unhideAllExercises,
    unhideAllSessions,
    exportLibrary,
    importLibrary,
  };
}
