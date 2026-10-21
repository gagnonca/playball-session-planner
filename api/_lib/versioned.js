import { supabase } from './supabase.js';

// Compare-and-set writes against the `version` column (migration 0006).
//
//   baseVersion == null  → create. Fails with 409 if the id already exists.
//   baseVersion == n     → update only if the row is still at version n.
//
// Returns { status, body } ready for res.status(status).json(body):
//   200 { success, row }                 written; row has the new version
//   409 { error: 'conflict', current }   someone saved first; current = live row
//   410 { error: 'gone' }                row was deleted
//   403 { error: 'forbidden' }           id belongs to another coach
export async function versionedWrite(table, { id, coachId, fields, baseVersion }) {
  const now = new Date().toISOString();

  if (baseVersion === undefined) {
    return { status: 428, body: { success: false, error: 'client_outdated', message: 'Reload PlayBall to keep editing.' } };
  }

  if (baseVersion === null) {
    const { data, error } = await supabase
      .from(table)
      .insert({ id, coach_id: coachId, ...fields, updated_at: now })
      .select()
      .single();
    if (!error) return { status: 200, body: { success: true, row: data } };
    if (error.code !== '23505') throw error; // not a duplicate key
    return explainMiss(table, id, coachId);
  }

  const { data, error } = await supabase
    .from(table)
    .update({ ...fields, updated_at: now })
    .eq('id', id)
    .eq('coach_id', coachId)
    .eq('version', baseVersion)
    .is('deleted_at', null)
    .select();
  if (error) throw error;
  if (data.length === 1) return { status: 200, body: { success: true, row: data[0] } };
  return explainMiss(table, id, coachId);
}

// The write matched nothing — say why.
async function explainMiss(table, id, coachId) {
  const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return { status: 410, body: { success: false, error: 'gone' } };
  if (data.coach_id !== coachId) return { status: 403, body: { success: false, error: 'forbidden' } };
  if (data.deleted_at) return { status: 410, body: { success: false, error: 'gone' } };
  return { status: 409, body: { success: false, error: 'conflict', current: data } };
}

export async function softDelete(table, { id, coachId }) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: now, updated_at: now })
    .eq('id', id)
    .eq('coach_id', coachId)
    .is('deleted_at', null);
  if (error) throw error;
}

// Parse the client's baseVersion: absent → undefined (outdated client),
// null → create, otherwise a positive integer (garbage → undefined, rejected).
export function readBaseVersion(body) {
  if (!body || !('baseVersion' in body)) return undefined;
  if (body.baseVersion === null) return null;
  const n = Number(body.baseVersion);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}
