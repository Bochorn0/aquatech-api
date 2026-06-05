/**
 * HTTP hardening helpers. Env:
 * - CORS_ORIGINS: comma-separated allowed browser origins (e.g. https://app.example.com,http://localhost:5173).
 *   If unset, CORS stays permissive (backward compatible until you set this in production).
 * - CORS_CREDENTIALS: "true" to send Access-Control-Allow-Credentials (requires explicit origins).
 * - TRUST_PROXY: see src/index.js — production defaults trust first proxy hop; set "0" to disable. Needed on Azure so rate limits are per-user, not shared.
 */

export function getCorsOptions() {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) {
    return undefined;
  }
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const credentials = process.env.CORS_CREDENTIALS === 'true';
  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (list.includes(origin)) {
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
