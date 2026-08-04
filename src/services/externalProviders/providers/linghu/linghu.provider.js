/**
 * Linghu provider adapter (push-first; outbound client stubs for future pull APIs).
 */

import config from '../../../../config/config.js';
import { ExternalProviderAuthError } from '../../types.js';
import { LINGHU_PROVIDER_ID, normalizeLinghuPush } from './linghu.mapping.js';

function getIngestSecret() {
  return (
    process.env.LINGHU_INGEST_SECRET
    || process.env.EXTERNAL_PROVIDER_LINGHU_SECRET
    || config.LINGHU_INGEST_SECRET
    || ''
  ).trim();
}

/**
 * @param {import('express').Request} req
 * @returns {boolean}
 */
export function verifyAuth(req) {
  const expected = getIngestSecret();
  if (!expected) {
    // Fail closed in production-like envs; allow open only when explicitly disabled
    if (process.env.LINGHU_INGEST_ALLOW_INSECURE === 'true') return true;
    throw new ExternalProviderAuthError(
      'Linghu ingest secret not configured (LINGHU_INGEST_SECRET)'
    );
  }

  const header =
    req.get('x-linghu-ingest-secret')
    || req.get('x-external-provider-secret')
    || req.get('x-api-key')
    || '';

  const bearer = (req.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const provided = (header || bearer).trim();

  if (!provided || provided !== expected) {
    throw new ExternalProviderAuthError('Invalid ingest credentials');
  }

  const allow = (process.env.LINGHU_INGEST_ALLOWLIST_IPS || '').trim();
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

/** Stubs — Linghu push doc has no pull API yet. */
export async function getDeviceDetail(_externalId) {
  return {
    success: false,
    error: 'Linghu pull API not documented; use push ingest',
    data: null,
  };
}

export async function listDevices() {
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
};

export default linghuProvider;
