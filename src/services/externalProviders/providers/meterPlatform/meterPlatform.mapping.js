/**
 * Map Water/Gas management platform JSON → NormalizedReading.
 * Tolerates field name variants from deviceExtend / conn records / static list.
 */

import { ExternalProviderValidationError, externalSourceTag } from '../../types.js';

export const METER_PLATFORM_PROVIDER_ID = 'meter-platform';

const M3_TO_L = 1000;

function pick(obj, keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
      return obj[k];
    }
  }
  return undefined;
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = parseFloat(String(value).trim().replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Platform may return m³ already scaled, or raw ×1000 from protocol.
 * Heuristic: if |n| >= 1000 and looks like protocol ×1000 integer, divide; else treat as m³.
 * Override with opts.volumeUnit = 'm3' | 'm3x1000'
 */
export function toCubicMeters(value, volumeUnit = 'auto') {
  const n = toNumber(value);
  if (n === null) return null;
  if (volumeUnit === 'm3') return n;
  if (volumeUnit === 'm3x1000') return n / 1000;
  // auto: PDF live capture showed "2990 m³" already as m³ in parsed JSON;
  // protocol raw is ×1000. Prefer treating API numbers as m³ unless clearly protocol-scaled.
  return n;
}

function m3ToLiters(m3) {
  if (m3 === null) return null;
  return m3 * M3_TO_L;
}

function metric(name, type, value, unit) {
  return { name, type, value, unit };
}

function parseObservedAt(raw) {
  const s = pick(raw, [
    'terminalClock',
    'systemClock',
    'reportTime',
    'lastConnTime',
    'createTime',
    'updateTime',
    'realTimeClock',
    'clock',
    'timestamp',
    'connTime',
  ]);
  if (!s) return new Date();
  if (s instanceof Date) return s;
  const str = String(s).trim();
  // BCD-like 260808000129 → 2026-08-08 00:01:29
  if (/^\d{12}$/.test(str)) {
    const yy = 2000 + parseInt(str.slice(0, 2), 10);
    const mo = str.slice(2, 4);
    const dd = str.slice(4, 6);
    const hh = str.slice(6, 8);
    const mi = str.slice(8, 10);
    const ss = str.slice(10, 12);
    const d = new Date(`${yy}-${mo}-${dd}T${hh}:${mi}:${ss}`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const isoish = str.includes('T') ? str : str.replace(' ', 'T');
  const d = new Date(isoish);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Flatten live platform shapes:
 * - deviceExtend: { meterNo, deviceInfo: { totalMetering, … }, … }
 * - conn analyticalBody JSON: { meterReportRequest: { currentForwardUsage, … } }
 */
export function flattenMeterPlatformPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;

  let raw = body.data && typeof body.data === 'object' && !Array.isArray(body.data)
    ? { ...body, ...body.data }
    : { ...body };

  if (raw.deviceInfo && typeof raw.deviceInfo === 'object') {
    raw = { ...raw.deviceInfo, ...raw };
  }

  // Conn record row with analyticalBody string
  if (typeof raw.analyticalBody === 'string' && raw.analyticalBody.trim()) {
    try {
      const parsed = JSON.parse(raw.analyticalBody);
      raw = { ...raw, ...flattenMeterPlatformPayload(parsed) };
    } catch {
      /* ignore bad JSON */
    }
  }

  if (raw.meterReportRequest && typeof raw.meterReportRequest === 'object') {
    raw = { ...raw, ...raw.meterReportRequest };
  }

  return raw;
}

/**
 * @param {object} body - deviceExtend / parsed report / list row / conn row
 * @param {{ volumeUnit?: 'auto'|'m3'|'m3x1000' }} [opts]
 * @returns {import('../../types.js').NormalizedReading}
 */
export function normalizeMeterPlatformReading(body, opts = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ExternalProviderValidationError('Body must be a JSON object');
  }

  const raw = flattenMeterPlatformPayload(body);

  const externalDeviceId = String(
    pick(raw, ['deviceCode', 'device_code', 'meterNumber', 'meterNo', 'deviceId', 'imei']) ?? ''
  ).trim();
  if (!externalDeviceId) {
    throw new ExternalProviderValidationError('Missing deviceCode / meter number');
  }

  const imeiRaw = pick(raw, ['imei', 'IMEI']);
  const imei = imeiRaw != null ? String(imeiRaw).trim() : undefined;

  const volumeUnit = opts.volumeUnit || process.env.METER_PLATFORM_VOLUME_UNIT || 'auto';
  const forwardM3 = toCubicMeters(
    pick(raw, [
      'currentForwardUsage',
      'totalMetering',
      'totalUsage',
      'forwardUsage',
      'currentCumulativeVolume',
      'positve_volume',
      'positive_volume',
    ]),
    volumeUnit
  );
  const reverseM3 = toCubicMeters(
    pick(raw, ['currentReverseUsage', 'reverseUsage', 'reverseCumulativeVolume', 'reverse_volume']),
    volumeUnit
  );

  const observedAt = parseObservedAt(raw);
  const idempotencyKey = [
    METER_PLATFORM_PROVIDER_ID,
    externalDeviceId,
    observedAt.toISOString(),
    forwardM3 ?? '',
    reverseM3 ?? '',
  ].join('|');

  const metrics = [];
  const volPos = m3ToLiters(forwardM3);
  if (volPos !== null) metrics.push(metric('volume_positive', 'volume_positive', volPos, 'L'));
  const volRev = m3ToLiters(reverseM3);
  if (volRev !== null) metrics.push(metric('volume_reverse', 'volume_reverse', volRev, 'L'));

  const temp = toNumber(pick(raw, ['temperature', 'currentTemperature']));
  if (temp !== null) {
    // protocol ×100; if huge, scale down
    const t = temp > 200 ? temp / 100 : temp;
    metrics.push(metric('temperature', 'temperature', t, 'C'));
  }

  const pressure = toNumber(pick(raw, ['pressure', 'currentPressure']));
  if (pressure !== null) {
    const p = pressure > 50 ? pressure / 1000 : pressure;
    metrics.push(metric('pressure', 'pressure', p, 'MPa'));
  }

  let voltage = toNumber(pick(raw, ['voltage', 'batteryVoltage', 'mainPowerVoltage', 'battery']));
  if (voltage !== null) {
    // mV → V if needed
    if (voltage > 100) voltage = voltage / 1000;
    metrics.push(metric('voltage_meter', 'voltage_meter', voltage, 'V'));
  }

  const signal = toNumber(pick(raw, ['signalStrength', 'signal', 'rsrp', 'networkSignal']));
  // Live demo sometimes returns a packed int (e.g. 4289003520) — skip garbage
  if (signal !== null && Math.abs(signal) <= 200) {
    metrics.push(metric('signal_meter', 'signal_meter', signal, ''));
  }

  const valveRaw = pick(raw, ['valveStatus', 'valveState', 'valve', 'valveDesc']);
  if (valveRaw !== undefined && valveRaw !== null) {
    let valve = toNumber(valveRaw);
    if (valve === null) {
      const s = String(valveRaw).toLowerCase();
      // Chinese UI: 阀门开 / 阀门关; English open/close
      if (s.includes('open') || s.includes('开') || s === 'true') valve = 0;
      else if (s.includes('close') || s.includes('关')) valve = 1;
    }
    // Protocol: 0 open / 1 close — keep numeric if present
    if (valve !== null) metrics.push(metric('valve_status', 'valve_status', valve, ''));
  }

  const online = pick(raw, ['isOnline', 'online']);
  if (online !== undefined && online !== null) {
    const s = String(online).toLowerCase();
    const o =
      online === true
      || online === 1
      || s === '1'
      || s === 'on_line'
      || s === 'online'
        ? 1
        : 0;
    metrics.push(metric('online', 'online', o, ''));
  }

  if (metrics.length === 0) {
    throw new ExternalProviderValidationError('No numeric metrics found in platform payload', {
      externalDeviceId,
    });
  }

  const dailyUsageMap = pick(raw, ['dailyUsageMap', 'dayUsageMap', 'dailyUsage']);

  return {
    provider: METER_PLATFORM_PROVIDER_ID,
    externalDeviceId,
    imei,
    observedAt,
    idempotencyKey,
    metrics,
    alarms: {},
    raw: {
      source: externalSourceTag(METER_PLATFORM_PROVIDER_ID),
      dailyUsageMap: dailyUsageMap || undefined,
      last5DaysDailyUsage: pick(raw, ['last5DaysDailyUsage']),
      deviceType: pick(raw, ['deviceType', 'meterType']),
      iccid: pick(raw, ['iccid', 'ICCID']),
      vendor: pick(raw, ['vendor', 'manufacturer']),
      meterStatus: pick(raw, ['meterStatus']),
    },
  };
}

export function cubicMetersToLiters(m3) {
  return m3ToLiters(toCubicMeters(m3, 'm3'));
}

export default {
  METER_PLATFORM_PROVIDER_ID,
  flattenMeterPlatformPayload,
  normalizeMeterPlatformReading,
  toCubicMeters,
  cubicMetersToLiters,
};
