/**
 * Pull sync: fetch latest readings from meter platform → bindings → sensores*.
 */

import meterPlatformProvider from './providers/meterPlatform/meterPlatform.provider.js';
import { normalizeMeterPlatformReading } from './providers/meterPlatform/meterPlatform.mapping.js';
import { processNormalizedReading } from './ingest.service.js';
import DeviceBindingModel from '../../models/postgres/deviceBinding.model.js';
import ExternalIngestLogModel from '../../models/postgres/externalIngestLog.model.js';
import { ExternalProviderValidationError } from './types.js';

const PROVIDER = meterPlatformProvider.id;

/**
 * Sync one device by platform deviceCode.
 * @param {string} deviceCode
 * @param {{ persist?: boolean, volumeUnit?: string }} [opts]
 */
export async function syncDevice(deviceCode, opts = {}) {
  const persist = opts.persist !== false;
  const extend = await meterPlatformProvider.client.getDeviceExtend(deviceCode);
  if (!extend.success) {
    return { success: false, deviceCode, error: extend.error, stage: 'fetch' };
  }

  let reading;
  try {
    reading = normalizeMeterPlatformReading(extend.data || extend.raw, {
      volumeUnit: opts.volumeUnit,
    });
  } catch (err) {
    return {
      success: false,
      deviceCode,
      error: err.message,
      stage: 'normalize',
      raw: extend.data,
    };
  }

  if (!persist) {
    return { success: true, deviceCode, reading, persisted: false };
  }

  // Ensure idempotency log row exists for pull path
  try {
    await ExternalIngestLogModel.tryBegin({
      provider: PROVIDER,
      externalDeviceId: reading.externalDeviceId,
      idempotencyKey: reading.idempotencyKey,
      status: 'queued',
      payload: process.env.EXTERNAL_INGEST_STORE_PAYLOAD === 'true' ? extend.data : null,
    });
  } catch (err) {
    if (err.code !== '42P01' && err.code !== '23505') {
      console.warn('[meterPlatform.sync] ingest log begin:', err.message);
    }
  }

  try {
    const result = await processNormalizedReading(reading);
    return {
      success: true,
      deviceCode,
      reading,
      ...result,
      persisted: !result.unmapped,
    };
  } catch (err) {
    return { success: false, deviceCode, error: err.message, stage: 'persist', reading };
  }
}

/**
 * Sync all active bindings for meter-platform, or optionally discover from platform list.
 * @param {{ discover?: boolean, pageSize?: number, persist?: boolean, limit?: number }} [opts]
 */
export async function syncAll(opts = {}) {
  if (!meterPlatformProvider.hasCredentials()) {
    return {
      success: false,
      error: 'METER_PLATFORM_USERNAME / METER_PLATFORM_PASSWORD not set in .env',
      results: [],
    };
  }

  const results = [];
  let deviceCodes = [];

  if (opts.discover) {
    const list = await meterPlatformProvider.client.getDeviceInfoList({
      pageNum: 1,
      pageSize: opts.pageSize || 100,
    });
    if (!list.success) {
      return { success: false, error: list.error, results: [] };
    }
    const rows = Array.isArray(list.data)
      ? list.data
      : list.data?.rows || list.data?.list || list.data?.records || [];
    deviceCodes = rows
      .map((r) => r.deviceCode || r.device_code)
      .filter(Boolean)
      .map(String);
  } else {
    const bindings = await DeviceBindingModel.list({
      provider: PROVIDER,
      activeOnly: true,
      limit: opts.limit || 500,
    });
    deviceCodes = bindings.map((b) => b.externalDeviceId);
  }

  if (opts.limit) deviceCodes = deviceCodes.slice(0, opts.limit);

  for (const code of deviceCodes) {
    // eslint-disable-next-line no-await-in-loop
    const r = await syncDevice(code, { persist: opts.persist !== false, volumeUnit: opts.volumeUnit });
    results.push(r);
  }

  const ok = results.filter((r) => r.success).length;
  const failed = results.length - ok;
  const unmapped = results.filter((r) => r.unmapped).length;

  return {
    success: true,
    provider: PROVIDER,
    total: results.length,
    ok,
    failed,
    unmapped,
    results,
  };
}

/**
 * Upsert binding helper for onboarding a platform deviceCode → tienda.
 */
export async function ensureBinding({ deviceCode, codigoTienda, puntoventaId, clientId, imei, meta }) {
  if (!deviceCode || !codigoTienda) {
    throw new ExternalProviderValidationError('deviceCode and codigoTienda required');
  }
  return DeviceBindingModel.upsert({
    provider: PROVIDER,
    externalDeviceId: String(deviceCode).trim(),
    codigoTienda: String(codigoTienda).trim(),
    puntoventaId: puntoventaId || null,
    clientId: clientId || null,
    externalImei: imei || null,
    active: true,
    meta: meta || { source: 'meter-platform' },
  });
}

export default { syncDevice, syncAll, ensureBinding };
