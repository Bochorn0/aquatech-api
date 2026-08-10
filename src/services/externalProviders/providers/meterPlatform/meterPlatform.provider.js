/**
 * Meter management platform provider (pull-first).
 * Registered id: meter-platform
 */

import * as client from './meterPlatform.client.js';
import {
  METER_PLATFORM_PROVIDER_ID,
  normalizeMeterPlatformReading,
} from './meterPlatform.mapping.js';
import { ExternalProviderAuthError } from '../../types.js';

/**
 * Push webhook is not the primary path for this vendor.
 * Keep verifyAuth for optional future push; currently rejects unless explicitly allowed.
 */
export function verifyAuth(_req) {
  throw new ExternalProviderAuthError(
    'meter-platform uses pull sync (JWT login), not push ingest. Use POST /api/v2.0/external-providers/meter-platform/sync'
  );
}

export function normalizePush(body) {
  // Allow normalizing vendor payloads if they ever push JSON to us
  return normalizeMeterPlatformReading(body);
}

export async function getDeviceDetail(externalId) {
  return client.getDeviceDetail(externalId);
}

export async function listDevices(opts) {
  return client.listDevices(opts);
}

const meterPlatformProvider = {
  id: METER_PLATFORM_PROVIDER_ID,
  displayName: 'Water/Gas meter management platform',
  mode: 'pull',
  verifyAuth,
  normalizePush,
  normalizeReading: normalizeMeterPlatformReading,
  getDeviceDetail,
  listDevices,
  hasCredentials: client.hasMeterPlatformCredentials,
  client,
};

export default meterPlatformProvider;
