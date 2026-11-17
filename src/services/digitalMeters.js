import meterPlatformClient from './externalProviders/providers/meterPlatform/meterPlatform.client.js';
import { normalizeMeterPlatformReading } from './externalProviders/providers/meterPlatform/meterPlatform.mapping.js';
import {
  catalogIsStale,
  listDigitalMeters,
  markReadingChecked,
  metersWithoutVolume,
  readingIsFresh,
  saveReading,
  upsertCatalog,
  volumesMissing,
} from '../models/postgres/digitalMeter.model.js';

function extractRows(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.rows || payload.list || payload.records || [];
}

function isOnlineFlag(value) {
  const text = String(value ?? '').toLowerCase();
  return value === true || value === 1 || text === '1' || text === 'on_line' || text === 'online';
}

function observedAt(value) {
  if (!value) return null;
  const time = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(time.getTime()) ? null : time;
}

function finiteNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function catalogFromRow(row) {
  const deviceCode = String(row?.deviceCode || row?.device_code || '').trim().slice(0, 64);
  if (!deviceCode) return null;
  return {
    deviceCode,
    deviceType: row.deviceType || row.meterType || null,
    installAddress: row.installAddress || row.address || null,
    online: isOnlineFlag(row.isOnline),
    rawForward: finiteNumber(row.totalMetering ?? row.totalUsage ?? row.currentForwardUsage),
  };
}

async function refreshCatalog() {
  const collected = [];
  for (let page = 1; page <= 3; page += 1) {
    const result = await meterPlatformClient.getDeviceInfoList({ pageNum: page, pageSize: 100 });
    if (!result.success) {
      const error = new Error(result.error || 'No se pudo leer la lista de medidores');
      error.rows = collected;
      throw error;
    }
    const rows = extractRows(result.data);
    collected.push(...rows);
    if (rows.length < 100) break;
  }

  for (const row of collected) {
    const meter = catalogFromRow(row);
    if (meter) await upsertCatalog(meter);
  }
  return collected.length;
}

async function refreshReading(deviceCode) {
  const conn = await meterPlatformClient.getConnRecordList(deviceCode, { pageNum: 1, pageSize: 8 });
  if (!conn?.success) return false;
  const rows = extractRows(conn.data);
  const report = (rows.length ? rows : extractRows(conn.raw)).find(
    (row) =>
      String(row?.direction || '').toLowerCase() === 'client'
      && String(row?.type || '').toLowerCase() === 'report'
      && row?.analyticalBody
  );
  if (!report) return false;

  const reading = normalizeMeterPlatformReading({ ...report, deviceCode });
  const forward = reading.metrics.find((metric) => metric.name === 'volume_positive');
  let request = {};
  if (typeof report.analyticalBody === 'string' && report.analyticalBody.trim()) {
    try {
      request = JSON.parse(report.analyticalBody)?.meterReportRequest || {};
    } catch {
      request = {};
    }
  }
  const rawForward = Number(request.currentForwardUsage);
  const liters = Number(forward?.value);
  await saveReading({
    deviceCode,
    deviceType: null,
    installAddress: null,
    online: null,
    litersForward: Number.isFinite(liters) ? liters : null,
    rawForward: Number.isFinite(rawForward) ? rawForward : null,
    lastReportAt: observedAt(report.createTime || reading.observedAt),
  });
  return true;
}

function cleanCodes(codes) {
  const list = Array.isArray(codes) ? codes : String(codes || '').split(',');
  return [...new Set(list.map((code) => String(code || '').trim().slice(0, 64)).filter(Boolean))].slice(0, 8);
}

/**
 * Returns the saved meter catalog. Refreshes it from the platform when the copy is older
 * than 10 minutes, and stores a reading for the meters already chosen on this controller.
 */
export async function loadDigitalMeters({ codes } = {}) {
  const assigned = cleanCodes(codes);
  let refreshed = false;
  let message = null;

  if (!meterPlatformClient.hasMeterPlatformCredentials()) {
    const rows = await listDigitalMeters();
    return {
      success: rows.length > 0,
      refreshed: false,
      message: rows.length
        ? 'La plataforma no está configurada. Se muestra la última copia guardada.'
        : 'La plataforma no está configurada y todavía no hay medidores guardados.',
      rows,
    };
  }

  try {
    if (await catalogIsStale() || await volumesMissing()) {
      await refreshCatalog();
      refreshed = true;
    }
  } catch (error) {
    message = 'La plataforma no respondió. Se muestra la última copia guardada.';
    console.error('[digitalMeters] catalog', error.message);
  }

  const pending = new Set([...(await metersWithoutVolume(20)), ...assigned]);
  for (const deviceCode of pending) {
    try {
      if (await readingIsFresh(deviceCode)) continue;
      const saved = await refreshReading(deviceCode);
      if (saved) refreshed = true;
      else await markReadingChecked(deviceCode);
    } catch (error) {
      message = message || 'No se pudo actualizar el detalle de algún medidor. Se muestra la copia guardada.';
      console.error('[digitalMeters] reading', deviceCode, error.message);
    }
  }

  const rows = await listDigitalMeters();
  const failed = Boolean(message);
  if (!message) {
    message = refreshed
      ? 'Medidores actualizados y guardados en la base.'
      : 'Medidores leídos de la base.';
  }
  return { success: !failed || rows.length > 0, refreshed, message, rows };
}
