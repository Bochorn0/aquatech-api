/**
 * Optional outbound HTTP helpers for Linghu.
 * Credentials are always read from config/.env (never hardcoded).
 */

import config from '../../../../config/config.js';

function getCredentials() {
  return {
    clientId: String(config.LINGHU_CLIENT_ID || '').trim(),
    clientSecret: String(config.LINGHU_CLIENT_SECRET || '').trim(),
    baseUrl: String(config.LINGHU_API_URL || '').trim(),
  };
}

function missingCredsResult(extra = {}) {
  return {
    success: false,
    error: 'Set LINGHU_CLIENT_ID, LINGHU_CLIENT_SECRET (and LINGHU_API_URL when pull is available) in .env',
    data: null,
    ...extra,
  };
}

export async function getDeviceDetail(externalId) {
  const { clientId, clientSecret, baseUrl } = getCredentials();
  if (!clientId || !clientSecret) return missingCredsResult({ externalId });
  if (!baseUrl) {
    return {
      success: false,
      error: 'LINGHU_API_URL not set; Linghu push doc has no pull/detail endpoint yet',
      data: null,
      externalId,
    };
  }
  return {
    success: false,
    error: 'Not implemented: Linghu has no documented pull/detail API',
    data: null,
    externalId,
  };
}

export async function listDevices() {
  const { clientId, clientSecret, baseUrl } = getCredentials();
  if (!clientId || !clientSecret) return missingCredsResult({ data: [] });
  if (!baseUrl) {
    return {
      success: false,
      error: 'LINGHU_API_URL not set; Linghu push doc has no device list endpoint yet',
      data: [],
    };
  }
  return {
    success: false,
    error: 'Not implemented: Linghu has no documented device list API',
    data: [],
  };
}

export default { getDeviceDetail, listDevices, getCredentials };
