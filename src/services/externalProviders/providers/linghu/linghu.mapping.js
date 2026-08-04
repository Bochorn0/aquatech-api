/**
 * Linghu push payload → NormalizedReading.
 * Tolerates PDF typos (positve_volume, spaced keys, etc.).
 */

import { ExternalProviderValidationError, externalSourceTag } from '../../types.js';

export const LINGHU_PROVIDER_ID = 'linghu';

const M3_TO_L = 1000;

function pick(obj, keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
      return obj[k];
    }
  }
  // fuzzy: trim keys once
  const normalized = {};
  for (const [k, v] of Object.entries(obj)) {
    normalized[String(k).trim()] = v;
  }
  for (const k of keys) {
    const t = String(k).trim();
    if (normalized[t] !== undefined && normalized[t] !== null && String(normalized[t]).trim() !== '') {
      return normalized[t];
    }
  }
  return undefined;
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

function toByteFlag(value) {
  const n = toNumber(value);
  if (n === null) return null;
  return n;
}

function parseObservedAt(raw) {
  const s = pick(raw, ['volume_time', 'volume_time ', 'create_time', 'createTime']);
  if (!s) return new Date();
  const str = String(s).trim();
  // "yyyy-MM-dd HH:mm:ss" → treat as local-ish ISO-ish
  const isoish = str.includes('T') ? str : str.replace(' ', 'T');
  const d = new Date(isoish);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

function m3ToLiters(m3) {
  const n = toNumber(m3);
  if (n === null) return null;
  return n * M3_TO_L;
}

function metric(name, type, value, unit) {
  return { name, type, value, unit };
}

/**
 * @param {object} body - raw Linghu POST JSON
 * @returns {import('../types.js').NormalizedReading}
 */
export function normalizeLinghuPush(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ExternalProviderValidationError('Body must be a JSON object');
  }

  const externalDeviceId = String(
    pick(body, ['device_number', 'deviceNumber', 'device_id', 'deviceId']) ?? ''
  ).trim();
  if (!externalDeviceId) {
    throw new ExternalProviderValidationError('Missing device_number');
  }

  const imeiRaw = pick(body, ['imei', 'IMEI']);
  const imei = imeiRaw != null ? String(imeiRaw).trim() : undefined;

  const observedAt = parseObservedAt(body);
  const idempotencyKey = [
    LINGHU_PROVIDER_ID,
    externalDeviceId,
    observedAt.toISOString(),
    pick(body, ['positve_volume', 'positive_volume', 'positiveVolume']) ?? '',
    pick(body, ['reverse_volume', 'reverseVolume']) ?? '',
  ].join('|');

  const metrics = [];

  const volPos = m3ToLiters(pick(body, ['positve_volume', 'positive_volume', 'positiveVolume']));
  // type must be unique per sensor_latest key (codigo_tienda, type, resource_id, resource_type)
  if (volPos !== null) metrics.push(metric('volume_positive', 'volume_positive', volPos, 'L'));

  const volRev = m3ToLiters(pick(body, ['reverse_volume', 'reverseVolume']));
  if (volRev !== null) metrics.push(metric('volume_reverse', 'volume_reverse', volRev, 'L'));

  const temp = toNumber(pick(body, ['temperature']));
  if (temp !== null) metrics.push(metric('temperature', 'temperature', temp, 'C'));

  const voltage = toNumber(pick(body, ['voltage_meter', 'voltageMeter']));
  if (voltage !== null) metrics.push(metric('voltage_meter', 'voltage_meter', voltage, 'V'));

  const signal = toNumber(pick(body, ['signal_meter', 'signalMeter']));
  if (signal !== null) metrics.push(metric('signal_meter', 'signal_meter', signal, ''));

  const noise = toNumber(pick(body, ['signal_noise', 'signalNoise']));
  if (noise !== null) metrics.push(metric('signal_noise', 'signal_noise', noise, ''));

  const valve = toByteFlag(pick(body, ['valve_status', 'valveStatus']));
  if (valve !== null) metrics.push(metric('valve_status', 'valve_status', valve, ''));

  const flow = toNumber(pick(body, ['para_a', 'paraA', 'instant_flow']));
  if (flow !== null) metrics.push(metric('flow_instant', 'flow_instant', flow, 'm3'));

  const pressure = toNumber(pick(body, ['para_b', 'paraB', 'pressure']));
  if (pressure !== null) metrics.push(metric('pressure', 'pressure', pressure, 'MPa'));

  const sensorP = toNumber(pick(body, ['sensor_p', 'sensorP']));
  if (sensorP !== null) metrics.push(metric('sensor_p', 'sensor_p', sensorP, ''));

  const alarms = {
    under_voltage_status: toByteFlag(pick(body, ['under_voltage_status', 'under_voltage_st -atus', 'underVoltageStatus'])),
    electrica_fault_status: toByteFlag(pick(body, ['electrica_fault_status', 'electrical_fault_status'])),
    reverse_warning_status: toByteFlag(pick(body, ['reverse_warning_status'])),
    sensor_warning_status: toByteFlag(pick(body, ['sensor_warning_status'])),
    leakage_alarm_status: toByteFlag(pick(body, ['leakage_alarm_status', 'leakage_ala -rm_status'])),
  };

  for (const [name, value] of Object.entries(alarms)) {
    if (value !== null && value !== undefined) {
      metrics.push(metric(name, name, value, ''));
    }
  }

  if (metrics.length === 0) {
    throw new ExternalProviderValidationError('No numeric metrics found in payload', { externalDeviceId });
  }

  const dayMeter = pick(body, ['day_meter_time', 'day_meter_time ', 'dayMeterTime']);

  return {
    provider: LINGHU_PROVIDER_ID,
    externalDeviceId,
    imei,
    observedAt,
    idempotencyKey,
    metrics,
    alarms,
    raw: {
      source: externalSourceTag(LINGHU_PROVIDER_ID),
      day_meter_time: dayMeter != null ? String(dayMeter).trim() : undefined,
      para_c: pick(body, ['para_c', 'paraC']),
      imsi: pick(body, ['imsi', 'IMSI']),
    },
  };
}

export function cubicMetersToLiters(m3) {
  return m3ToLiters(m3);
}
