/**
 * Pure validation for duplicate Tuya device merge (OLD absorbed into NEW).
 * Kept separate from DB/service code so unit tests do not open Postgres connections.
 * @returns {{ ok: boolean, oldDeviceId: string, newDeviceId: string, errors: string[] }}
 */
export function validateMergeDuplicateIds(oldDeviceId, newDeviceId) {
  const old = String(oldDeviceId || '').trim();
  const newId = String(newDeviceId || '').trim();
  const errors = [];
  if (!old) errors.push('Se requiere oldDeviceId (equipo viejo).');
  if (!newId) errors.push('Se requiere newDeviceId (equipo nuevo / canónico).');
  if (old && newId && old === newId) errors.push('El equipo viejo y el nuevo deben ser distintos.');
  if (old.startsWith('_')) errors.push('El equipo viejo no puede ser un registro bloqueado (id con prefijo _).');
  if (newId.startsWith('_')) errors.push('El equipo nuevo no puede ser un registro bloqueado (id con prefijo _).');
  return { ok: errors.length === 0, oldDeviceId: old, newDeviceId: newId, errors };
}
