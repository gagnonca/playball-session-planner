import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { SESSION_TEMPLATES_KEY } from '../constants/storage';
import { uid, nowIso } from '../utils/helpers';

// User-defined session templates. A template is { id, name, exerciseIds[],
// updatedAt }. exerciseIds reference items in the library (SECTION_LIBRARY_KEY)
// — they're resolved fresh at session-creation time so library edits flow
// through to future sessions. Templates live in localStorage only for now;
// sync can be layered on later.
export default function useSessionTemplates() {
  const [store, setStore] = useLocalStorage(SESSION_TEMPLATES_KEY, {
    version: 1,
    items: [],
  });

  const templates = store.items || [];

  const saveTemplate = useCallback((template) => {
    const name = (template?.name || '').trim() || 'Untitled template';
    const exerciseIds = Array.isArray(template?.exerciseIds) ? template.exerciseIds : [];
    setStore(prev => {
      const items = prev.items || [];
      const existingIdx = template?.id ? items.findIndex(t => t.id === template.id) : -1;
      const next = {
        id: template?.id || uid(),
        name,
        exerciseIds,
        updatedAt: nowIso(),
      };
      if (existingIdx >= 0) {
        const merged = [...items];
        merged[existingIdx] = next;
        return { ...prev, items: merged };
      }
      return { ...prev, items: [...items, next] };
    });
  }, [setStore]);

  const deleteTemplate = useCallback((id) => {
    setStore(prev => ({ ...prev, items: (prev.items || []).filter(t => t.id !== id) }));
  }, [setStore]);

  return { templates, saveTemplate, deleteTemplate };
}
