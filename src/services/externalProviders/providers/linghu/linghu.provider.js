/**
 * Linghu provider adapter (push-first; outbound client stubs for future pull APIs).
 *
 * Credentials always come from env via config.js:
 *   LINGHU_CLIENT_ID
 *   LINGHU_CLIENT_SECRET
 * Optional legacy alias: LINGHU_INGEST_SECRET → treated as client secret only.
 */

import config from '../../../../config/config.js';
import { ExternalProviderAuthError } from '../../types.js';
import { LINGHU_PROVIDER_ID, normalizeLinghuPush } from './linghu.mapping.js';

function getCredentials() {
  // Always prefer live process.env (populated from .env via config.js dotenv).
  // Never hardcode credentials in source.
  const clientId = String(
    process.env.LINGHU_CLIENT_ID || config.LINGHU_CLIENT_ID || ''
  ).trim();
  const clientSecret = String(
    process.env.LINGHU_CLIENT_SECRET
    || process.env.LINGHU_INGEST_SECRET
    || process.env.EXTERNAL_PROVIDER_LINGHU_SECRET
    || config.LINGHU_CLIENT_SECRET
    || ''
  ).trim();
  return { clientId, clientSecret };
}

export function hasLinghuCredentials() {
  const { clientId, clientSecret } = getCredentials();
  // Prefer both (Tuya-style). Secret-only still accepted for early pilots.
  return Boolean(clientSecret);
}

/**
 * @param {import('express').Request} req
 * @returns {boolean}
 */
export function verifyAuth(req) {
  const { clientId: expectedId, clientSecret: expectedSecret } = getCredentials();

  if (!expectedSecret) {
    if (process.env.LINGHU_INGEST_ALLOW_INSECURE === 'true') return true;
    throw new ExternalProviderAuthError(
      'Linghu credentials not configured. Set LINGHU_CLIENT_ID and LINGHU_CLIENT_SECRET in .env'
    );
  }

  const providedId = (
    req.get('x-linghu-client-id')
    || req.get('x-external-provider-client-id')
    || req.get('x-client-id')
    || ''
  ).trim();

  const providedSecret = (
    req.get('x-linghu-client-secret')
    || req.get('x-external-provider-client-secret')
    || req.get('x-linghu-ingest-secret')
    || req.get('x-external-provider-secret')
    || req.get('x-api-key')
    || (req.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
    || ''
  ).trim();

  // If CLIENT_ID is configured, require matching id header
  if (expectedId) {
    if (!providedId || providedId !== expectedId) {
      throw new ExternalProviderAuthError('Invalid Linghu client id');
    }
  }

  if (!providedSecret || providedSecret !== expectedSecret) {
    throw new ExternalProviderAuthError('Invalid Linghu client secret');
  }

  const allow = String(config.LINGHU_INGEST_ALLOWLIST_IPS || '').trim();
  if (allow) {
    const ip = (req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
    const list = allow.split(',').map((s) => s.trim()).filter(Boolean);
    if (list.length && !list.includes(ip)) {
      throw new ExternalProviderAuthError('IP not allowlisted');
    }
  }

  return true;
}

/**
 * @param {object} body
 */
export function normalizePush(body) {
  return normalizeLinghuPush(body);
}

/** Stubs — Linghu push doc has no pull API yet; credentials still loaded from .env for future use. */
export async function getDeviceDetail(_externalId) {
  if (!hasLinghuCredentials()) {
    return {
      success: false,
      error: 'Linghu credentials not configured (LINGHU_CLIENT_ID / LINGHU_CLIENT_SECRET)',
      data: null,
    };
  }
  return {
    success: false,
    error: 'Linghu pull API not documented; use push ingest',
    data: null,
  };
}

export async function listDevices() {
  if (!hasLinghuCredentials()) {
    return {
      success: false,
      error: 'Linghu credentials not configured (LINGHU_CLIENT_ID / LINGHU_CLIENT_SECRET)',
      data: [],
    };
  }
  return {
    success: false,
    error: 'Linghu pull API not documented; use push ingest',
    data: [],
  };
}

const linghuProvider = {
  id: LINGHU_PROVIDER_ID,
  displayName: 'Linghu meter platform',
  verifyAuth,
  normalizePush,
  getDeviceDetail,
  listDevices,
  hasCredentials: hasLinghuCredentials,
};

export default linghuProvider;
