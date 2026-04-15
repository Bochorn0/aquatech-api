/**
 * Central password rules for register, reset, and admin user create/update.
 * Env: PASSWORD_MIN_LENGTH (default 8, min 8), PASSWORD_MAX_LENGTH (default 128),
 * BCRYPT_ROUNDS (default 12, clamped 10–14).
 * Login does not enforce minimum length so existing accounts keep working.
 */

import bcrypt from 'bcrypt';

const BCRYPT_BYTE_LIMIT = 72;

export function getPasswordMinLength() {
  const raw = parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10);
  if (!Number.isFinite(raw)) return 8;
  return Math.min(128, Math.max(8, raw));
}

export function getPasswordMaxLength() {
  const raw = parseInt(process.env.PASSWORD_MAX_LENGTH || '128', 10);
  if (!Number.isFinite(raw)) return 128;
  return Math.min(500, Math.max(72, raw));
}

export function getBcryptRounds() {
  const raw = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
  if (!Number.isFinite(raw)) return 12;
  return Math.min(14, Math.max(10, raw));
}

/**
 * @param {unknown} plain
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validatePasswordPlaintext(plain) {
  if (typeof plain !== 'string') {
    return { ok: false, message: 'La contraseña es requerida' };
  }
  const min = getPasswordMinLength();
  const max = getPasswordMaxLength();
  if (plain.length < min) {
    return { ok: false, message: `La contraseña debe tener al menos ${min} caracteres` };
  }
  if (plain.length > max) {
    return { ok: false, message: `La contraseña no puede superar ${max} caracteres` };
  }
  if (Buffer.byteLength(plain, 'utf8') > BCRYPT_BYTE_LIMIT) {
    return { ok: false, message: 'La contraseña es demasiado larga (límite técnico de 72 bytes UTF-8)' };
  }
  return { ok: true };
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, getBcryptRounds());
}
