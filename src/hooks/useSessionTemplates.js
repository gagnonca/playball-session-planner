import { useCallback } from 'react';
import { uid, nowIso } from '../utils/helpers';
import { useStore, getState, templates as templateStore } from '../data/store';

// User-defined session templates: { id, name, exerciseIds[], version }.
// exerciseIds reference library items and are resolved fresh at
// session-creation time, so library edits flow through to future sessions.
// Stored in the coach's account (session_templates table).
export default function useSessionTemplates() {
  const templates = useStore(s => s.templates);

  const saveTemplate = useCallback((template) => {
    const existing = template?.id ? getState().templates.find(t => t.id === template.id) : null;
    templateStore.put({
      id: existing?.id || template?.id || uid(),
      version: existing?.version ?? null,
      name: (template?.name || '').trim() || 'Untitled template',
      exerciseIds: Array.isArray(template?.exerciseIds) ? template.exerciseIds : [],
      updatedAt: nowIso(),
    });
  }, []);

  const deleteTemplate = useCallback((id) => templateStore.remove(id), []);

  return { templates, saveTemplate, deleteTemplate };
}
