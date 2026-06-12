/**
 * HTTP hardening helpers.
 * Note: Express finalhandler sets `Content-Security-Policy: default-src 'none'` on its
 * default HTML 404 — use explicit JSON 404 handlers in index.js instead (ZAP/FEMSA).
 *
 * Env:
 * - CORS_ORIGINS: comma-separated browser origins. Production LCC example:
 *   `https://www.lcc.com.mx,https://lcc.com.mx` (include apex + www; trailing slashes OK).
 *   If unset, CORS stays permissive (backward compatible until you set this in production).
 * - CORS_CREDENTIALS: "true" to send Access-Control-Allow-Credentials (requires explicit origins).
 * - TRUST_PROXY: see src/index.js — production defaults trust first proxy hop; set "0" to disable.
 */

export function normalizeCorsOrigin(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    return `${url.protocol}//${url.host}`;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

export function parseCorsOriginList(raw) {
  if (!raw?.trim()) return [];
  const list = raw.split(',').map(normalizeCorsOrigin).filter(Boolean);
  return [...new Set(list)];
}

export function getCorsOptions() {
  const list = parseCorsOriginList(process.env.CORS_ORIGINS);
  if (list.length === 0) {
    return undefined;
  }
  const credentials = process.env.CORS_CREDENTIALS === 'true';
  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (list.includes(normalizeCorsOrigin(origin))) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials,
  };
}

export function getHelmetOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    hsts: isProd
      ? { maxAge: 15552000, includeSubDomains: true, preload: false }
      : false,
  };
}
